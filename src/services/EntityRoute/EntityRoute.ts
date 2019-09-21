import * as Koa from "koa";
import * as Router from "koa-router";
import {
    Repository,
    getRepository,
    ObjectType,
    SelectQueryBuilder,
    DeleteResult,
    Connection,
    QueryRunner,
    getConnection,
} from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { Normalizer } from "./Serializer/Normalizer";
import { RouteOperation } from "@/services/EntityRoute/Decorators/Groups";
import { AbstractFilter, IAbstractFilterConfig, QueryParams } from "./Filters/AbstractFilter";
import { EntityMapper } from "./Mapping/EntityMapper";
import { Denormalizer, ErrorMappingItem } from "./Serializer/Denormalizer";
import { isType } from "./utils";
import { entityRoutesContainer } from ".";
import { QueryAliasManager } from "./Serializer/QueryAliasManager";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";
import { RouteAction, RouteActionClass } from "./Actions/RouteAction";

export const ROUTE_METAKEY = Symbol("route");
export const getRouteMetadata = (entity: Function): RouteMetadata => Reflect.getOwnMetadata(ROUTE_METAKEY, entity);

export const ROUTE_SUBRESOURCES = Symbol("route");
export const getRouteSubresourcesMetadata = <Entity extends AbstractEntity>(
    entity: Function
): RouteSubresourcesMeta<Entity> =>
    Reflect.getOwnMetadata(ROUTE_SUBRESOURCES, entity) || {
        parent: entity,
        properties: {},
    };

export const ROUTE_FILTERS_METAKEY = Symbol("filters");
export const getRouteFiltersMeta = (entity: Function): RouteFiltersMeta =>
    Reflect.getOwnMetadata(ROUTE_FILTERS_METAKEY, entity);

export class EntityRoute<Entity extends AbstractEntity> {
    // Entity Route specifics
    public readonly repository: Repository<Entity>;
    private actions: RouteCrudActions;
    private globalOptions: IEntityRouteOptions;
    private customActionsClasses: Record<string, RouteAction> = {};

    // Meta
    private routeMetadata: RouteMetadata;
    private filtersMeta: RouteFiltersMeta;
    private subresourcesMeta: RouteSubresourcesMeta<Entity>;

    // Managers/services
    public readonly connection: Connection;
    public readonly mapper: EntityMapper<Entity>;
    public readonly aliasManager: QueryAliasManager;
    public readonly normalizer: Normalizer<Entity>;
    public readonly denormalizer: Denormalizer<Entity>;

    constructor(entity: ObjectType<Entity>, globalOptions: IEntityRouteOptions = {}) {
        // Entity Route specifics
        this.repository = getRepository(entity) as any;
        this.actions = ACTIONS;
        this.globalOptions = globalOptions;

        // Meta
        this.routeMetadata = getRouteMetadata(entity);
        this.filtersMeta = getRouteFiltersMeta(entity);
        this.subresourcesMeta = getRouteSubresourcesMetadata(entity);

        // Managers/services
        this.connection = getConnection();
        this.mapper = new EntityMapper<Entity>(this);
        this.aliasManager = new QueryAliasManager();
        this.normalizer = new Normalizer<Entity>(this);
        this.denormalizer = new Denormalizer(this as any) as any;

        // Add this EntityRoute to the list (used by subresources)
        entityRoutesContainer[entity.name] = this as any;

        // Instanciate and store every custom action classes
        if (this.options.actions) {
            this.initCustomActions();
        }
    }

    // Computed getters

    get metadata() {
        return this.repository.metadata;
    }

    get filters() {
        return Object.values(this.filtersMeta);
    }

    get options() {
        return { ...this.globalOptions, ...this.routeMetadata.options };
    }

    /** Make a Koa Router for each given operations (and their associated mapping route) for this entity and its subresources and return it */
    public makeRouter() {
        const router = new Router();

        // CRUD routes
        let i = 0;
        for (i; i < this.routeMetadata.operations.length; i++) {
            const operation = this.routeMetadata.operations[i];
            const verb = this.actions[operation].verb;
            const path = this.routeMetadata.path + this.actions[operation].path;

            const responseMethod = this.makeResponseMethod(operation);
            const mappingMethod = this.makeRouteMappingMethod(operation);

            (<any>router)[verb](path, responseMethod);
            (<any>router)[verb](path + "/mapping", mappingMethod);
        }

        // Subresoures routes
        if (Object.keys(this.subresourcesMeta.properties).length) {
            this.makeSubresourcesRoutes(router);
        }

        // Custom actions routes
        if (this.options.actions) {
            i = 0;
            for (i; i < this.options.actions.length; i++) {
                const { operation, verb, path: actionPath } = this.options.actions[i];
                const path = this.routeMetadata.path + actionPath;
                const responseMethod = this.makeResponseMethod(operation, this.options.actions[i]);

                (<any>router)[verb](path, responseMethod);
            }
        }

        return router;
    }

    /** Recursively add subresources routes for this entity */
    private makeSubresourcesRoutes(
        router: Router,
        nestedPath?: { current: string[]; parent: string; maxDepths?: number[] }
    ) {
        // For each subresources of this entity
        for (let key in this.subresourcesMeta.properties) {
            const subresourceProp = this.subresourcesMeta.properties[key];
            const subresourceRelation = this.getSubresourceRelation(key);
            const subresourcePath = this.getSubresourceBasePath(
                subresourceRelation.param,
                subresourceProp,
                nestedPath && nestedPath.parent
            );

            const relationTableName = subresourceRelation.relation.inverseEntityMetadata.tableName;
            const nestedEntityRoute = entityRoutesContainer[subresourceProp.entityTarget.name];

            // If subresource entity has no EntityRoute, then it can't make a subresource out of it
            if (!nestedEntityRoute) {
                continue;
            }

            // Add one to also count root subresource
            const currentDepth = 1 + (nestedPath ? nestedPath.current.length : 0);

            // Checks for every max depth of every subresources including this one
            const hasReachedMaxDepth = nestedPath
                ? nestedPath.maxDepths.some((maxDepth) => currentDepth >= maxDepth)
                : currentDepth >= subresourceProp.maxDepth;

            const isSubresourceCircular = nestedPath && nestedPath.current.includes(relationTableName);

            // Ensures that it is not making circular subresources routes & that maxDepth isn't reached
            if (!hasReachedMaxDepth && !isSubresourceCircular) {
                // Recursively make subresources
                nestedEntityRoute.makeSubresourcesRoutes(router, {
                    parent: subresourcePath,
                    current: nestedPath ? nestedPath.current.concat(relationTableName) : [relationTableName],
                    maxDepths: nestedPath ? nestedPath.maxDepths.concat(currentDepth) : [currentDepth],
                });
            }

            const isSubresourceSingle =
                subresourceRelation.relation.isOneToOne || subresourceRelation.relation.isManyToOne;

            // Generates details endpoint at subresourcePath
            if (isSubresourceSingle && subresourceProp.operations.includes("details")) {
                subresourceProp.operations.forEach((operation) => {
                    (<any>router)[this.actions[operation].verb](
                        subresourcePath,
                        nestedEntityRoute.makeResponseMethod(operation, subresourceRelation)
                    );
                });

                continue;
            }

            // Generates endpoint at subresourcePath for each operation
            subresourceProp.operations.forEach((operation) => {
                (<any>router)[this.actions[operation].verb](
                    subresourcePath + this.actions[operation].path,
                    nestedEntityRoute.makeResponseMethod(operation, subresourceRelation)
                );
            });
        }
    }

    /** Retrieve informations on a subresource relation */
    private getSubresourceRelation(key: string) {
        const parentDetailsParam = ((this.subresourcesMeta.parent as any) as Function).name + "Id";
        const relationMeta = this.metadata.findRelationWithPropertyPath(key);
        return {
            param: parentDetailsParam,
            propertyName: key,
            relation: relationMeta,
        };
    }

    /** Returns a (nested?) subresource base path (= without operation suffix)  */
    private getSubresourceBasePath(param: string, subresourceProp: SubresourceProperty<any>, parentPath?: string) {
        const parentDetailsPath = this.actions.details.path.replace(":id", ":" + param);
        return (parentPath || this.routeMetadata.path) + parentDetailsPath + "/" + subresourceProp.path;
    }

    /** Joins a subresource on its inverse side property */
    private joinSubresourceOnInverseSide(qb: SelectQueryBuilder<Entity>, subresourceRelation: SubresourceRelation) {
        const alias = this.aliasManager.generate(
            this.metadata.tableName,
            subresourceRelation.relation.inverseSidePropertyPath
        );

        qb.innerJoin(
            this.metadata.tableName + "." + subresourceRelation.relation.inverseSidePropertyPath,
            alias,
            alias + ".id = :parentId",
            { parentId: subresourceRelation.id }
        );
    }

    private initCustomActions() {
        this.options.actions.forEach((action) => {
            if (!this.customActionsClasses[action.class.name]) {
                //  Cannot read property 'ImageUploadAction' of undefined
                this.customActionsClasses[action.class.name] = new action.class({
                    entityRoute: this as any,
                    routeMetadata: this.routeMetadata,
                    entityMetadata: this.metadata,
                    middlewares: action.middlewares || [],
                });
            }
        });
    }

    private async create({ values, subresourceRelation }: IActionParams<Entity>, queryRunner: QueryRunner) {
        // Auto-join subresource parent on body values
        if (subresourceRelation) {
            (values as any)[subresourceRelation.relation.inverseSidePropertyPath] = { id: subresourceRelation.id };
        }

        const insertResult = await this.denormalizer.insertItem(values, queryRunner);

        // Has errors
        if (isType<ErrorMappingItem>(insertResult, "errors" in insertResult)) {
            return insertResult;
        }

        return this.getDetails({ entityId: insertResult.id }, queryRunner);
    }

    /** Returns an entity with every mapped props (from groups) for a given id */
    private async getList({ queryParams, subresourceRelation }: IActionParams<Entity>, queryRunner: QueryRunner) {
        const repository = queryRunner.manager.getRepository<Entity>(this.metadata.target);
        const qb = repository.createQueryBuilder(this.metadata.tableName);

        // Apply a max item to retrieve
        qb.take(500);

        if (subresourceRelation) {
            this.joinSubresourceOnInverseSide(qb, subresourceRelation);
        }

        if (this.filtersMeta) {
            this.applyFilters(queryParams, qb);
        }

        const collectionResult = await this.normalizer.getCollection(qb);

        return {
            items: collectionResult[0],
            totalItems: collectionResult[1],
        } as CollectionResult<Entity>;
    }

    /** Returns an entity with every mapped props (from groups) for a given id */
    private async getDetails({ entityId, subresourceRelation }: IActionParams<Entity>, queryRunner: QueryRunner) {
        const repository = queryRunner.manager.getRepository<Entity>(this.metadata.target);
        const qb = repository.createQueryBuilder(this.metadata.tableName);

        if (subresourceRelation) {
            this.joinSubresourceOnInverseSide(qb, subresourceRelation);
        }

        return await this.normalizer.getItem<Entity>(qb, entityId);
    }

    private async update({ values, entityId }: IActionParams<Entity>, queryRunner: QueryRunner) {
        (values as any).id = entityId;
        const insertResult = await this.denormalizer.updateItem(values, queryRunner);

        // Has errors
        if (isType<ErrorMappingItem>(insertResult, "errors" in insertResult)) {
            return insertResult;
        }

        return this.getDetails({ entityId: insertResult.id }, queryRunner);
    }

    private async delete({ entityId }: IActionParams<Entity>, queryRunner: QueryRunner) {
        return this.repository
            .createQueryBuilder()
            .delete()
            .from(this.repository.metadata.target)
            .where("id = :id", { id: entityId })
            .execute();
    }

    /** Returns the response method on a given operation for this entity */
    public makeResponseMethod(operation: RouteOperation, subresourceRelation?: SubresourceRelation): Koa.Middleware;
    /** Returns the custom action method on a given operation for this entity  */
    public makeResponseMethod(operation: RouteOperation, customAction?: IRouteCustomActionItem): Koa.Middleware;
    public makeResponseMethod(
        operation: RouteOperation,
        subresourceRelationOrCustomAction?: SubresourceRelation | IRouteCustomActionItem
    ): Koa.Middleware {
        return async (ctx, next) => {
            const isUpdateOrCreate = (ctx.method === "POST" || ctx.method === "PUT") && ctx.request.body;

            let subresourceRelation: SubresourceRelation;
            let customAction: IRouteCustomActionItem;
            if (subresourceRelationOrCustomAction) {
                if (
                    isType<SubresourceRelation>(
                        subresourceRelationOrCustomAction,
                        "action" in subresourceRelationOrCustomAction
                    )
                ) {
                    subresourceRelation = subresourceRelationOrCustomAction;
                    subresourceRelation.id = parseInt(ctx.params[subresourceRelation.param]);
                } else {
                    customAction = subresourceRelationOrCustomAction;
                }
            }

            const params: IActionParams<Entity> = { subresourceRelation };
            if (ctx.params.id) params.entityId = parseInt(ctx.params.id);
            if (isUpdateOrCreate) params.values = ctx.request.body;
            if (operation === "list") params.queryParams = ctx.query;

            this.aliasManager.resetList();

            const queryRunner = this.connection.createQueryRunner();
            queryRunner.data = { requestContext: { ctx, next, params, entityRoute: this } };

            let result;
            if (!customAction) {
                const method = this.actions[operation].method;
                result = await this[method](params, queryRunner);
            } else {
                const method = (customAction.action as keyof RouteAction) || "onRequest";
                result = await this.customActionsClasses[customAction.class.name][method](ctx, next, params);
            }

            queryRunner.release();

            let response: IRouteResponse = {
                "@context": {
                    operation,
                    entity: this.metadata.tableName,
                },
            };
            if (isUpdateOrCreate) response["@context"].errors = null;

            if (isType<ErrorMappingItem>(result, "errors" in result)) {
                response["@context"].errors = result;
            } else if (isType<CollectionResult<Entity>>(result, operation === "list")) {
                response["@context"].retrievedItems = result.items.length;
                response["@context"].totalItems = result.totalItems;
                response.items = result.items;
            } else if (isType<DeleteResult>(result, "raw" in result)) {
                response.deleted = result.affected ? result.raw.insertId : null;
            } else {
                response = { ...response, ...result };
            }

            ctx.body = response;
            next();
        };
    }

    /** Returns the method of a mapping route on a given operation for this entity */
    private makeRouteMappingMethod(operation: RouteOperation): Koa.Middleware {
        return async (ctx, next) => {
            ctx.body = {
                context: {
                    operation: operation + ".mapping",
                    entity: this.metadata.tableName,
                },
                routeMapping: this.mapper.make(operation),
            };
            next();
        };
    }

    /** Creates a new instance of a given Filter */
    private getFilter<Filter extends AbstractFilter>(config: IAbstractFilterConfig): Filter {
        return new config.class({
            config,
            entityMetadata: this.metadata as any,
            normalizer: this.normalizer as any,
        });
    }

    /** Apply every registered filters on this request */
    private applyFilters(queryParams: QueryParams, qb: SelectQueryBuilder<Entity>) {
        this.filters.forEach((filterOptions) => {
            this.getFilter(filterOptions).apply({ queryParams, qb, whereExp: qb });
        });
    }
}

export type RouteMetadata = {
    /** The path prefix for every action of this route */
    path: string;
    /** List of operations to create a route for */
    operations: RouteOperation[];
    /** Specific options to be used on this EntityRoute, if none specified, will default to global options */
    options?: IEntityRouteOptions;
};

export type RouteFiltersMeta = Record<string, IAbstractFilterConfig>;

export type SubresourceOperation = "create" | "list" | "details";
export type SubresourceProperty<Entity extends AbstractEntity> = {
    /** The route path for this action */
    path: string;
    /** List of operations to create a subresource route for */
    operations: SubresourceOperation[];
    /** Subresource entity, used to retrieve its EntityRoute */
    entityTarget: Entity;
    /** Max depth of a subresource property : Limit the number of times a subresource can have another */
    maxDepth: number;
};
export type RouteSubresourcesMeta<ParentEntity extends AbstractEntity> = {
    parent: ParentEntity;
    properties: Record<string, SubresourceProperty<any>>;
};
/** Subresource relation with parent, used to auto-join on this entity's relation inverse side */
export type SubresourceRelation = {
    /** Subresource parent's entity id */
    id?: number;
    /** Route path parameter key, for example "userId" where the route path is "/users/:userId" */
    param: string;
    /** Subresource parent relation property name */
    propertyName: string;
    /** Subresource parent relationMeta */
    relation: RelationMetadata;
};

export interface IEntityRouteOptions {
    actions?: IRouteCustomActionItem[];
    isMaxDepthEnabledByDefault?: boolean;
    /** Level of depth at which the nesting should stop */
    defaultMaxDepthLvl?: number;
    /** In case of max depth reached on a relation, should it at retrieve its id and then stop instead of just stopping ? */
    shouldMaxDepthReturnRelationPropsId?: boolean;
    /** In case of a relation with no other mapped props (from groups) for a request: should it unwrap "relation { id }" to relation = id ? */
    shouldEntityWithOnlyIdBeFlattenedToIri?: boolean;
}

export enum ROUTE_VERB {
    "GET" = "get",
    "POST" = "post",
    "PUT" = "put",
    "DELETE" = "delete",
}

export interface IActionParams<Entity extends AbstractEntity> {
    /** Current route entity id */
    entityId?: number;
    /** Subresource relation with parent, used to auto-join on this entity's relation inverse side */
    subresourceRelation?: SubresourceRelation;
    /** Is update or create operation ? To check if there is a body sent */
    isUpdateOrCreate?: boolean;
    /** Request body values sent */
    values?: QueryDeepPartialEntity<Entity>;
    /** Request query params */
    queryParams?: any;
}

export type RequestContext<Entity extends AbstractEntity> = {
    ctx: Koa.ParameterizedContext<any, {}>;
    next: () => Promise<any>;
    params: IActionParams<Entity>;
    entityRoute: EntityRoute<Entity>;
    subresourceRelation?: SubresourceRelation;
};

interface IRouteResponse {
    "@context": {
        /** Current route operation */
        operation: string;
        /** Current entity's route */
        entity: string;
        /** Total number of items found for this request */
        totalItems?: number;
        /** Number of items retrieved for this request */
        retrievedItems?: number;
        errors?: ErrorMappingItem;
    };
    items?: any[];
    deleted?: any;
    [k: string]: any;
}

interface IRouteCrudActionItem {
    /** The route path for this action */
    path: string;
    /** HTTP verb for this action */
    verb: ROUTE_VERB;
    /** EntityRoute method's name associated to this action or just a function */
    method?: "create" | "getList" | "getDetails" | "update" | "delete";
}

interface IRouteCustomActionItem extends IRouteCrudActionItem {
    /** Custom operation for that action */
    operation?: RouteOperation;
    /** Class that implements RouteAction, onRequest method will be called by default unless a custom action parameter is defined */
    class?: RouteActionClass;
    /** Custom method name of RouteAction class to call for this verb+path, mostly useful to re-use the same class for multiple actions */
    action?: string;
    /** List of middlewares to be called (in the same order as defined here) */
    middlewares?: Koa.Middleware[];
}

/** A list of CRUD Actions or "all" */
type RouteCrudActions = Omit<Record<RouteOperation | "delete", IRouteCrudActionItem>, "all">;

const ACTIONS: RouteCrudActions = {
    create: {
        path: "",
        verb: ROUTE_VERB.POST,
        method: "create",
    },
    list: {
        path: "",
        verb: ROUTE_VERB.GET,
        method: "getList",
    },
    details: {
        path: "/:id(\\d+)",
        verb: ROUTE_VERB.GET,
        method: "getDetails",
    },
    update: {
        path: "/:id(\\d+)",
        verb: ROUTE_VERB.PUT,
        method: "update",
    },
    delete: {
        path: "/:id(\\d+)",
        verb: ROUTE_VERB.DELETE,
        method: "delete",
    },
};

/** Return type of EntityRoute.getList */
type CollectionResult<Entity extends AbstractEntity> = {
    items: Entity[];
    totalItems: number;
};
