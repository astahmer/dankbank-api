import * as Koa from "koa";
import * as Router from "koa-router";
import { Repository, getRepository, ObjectType, SelectQueryBuilder, DeleteResult } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { Normalizer } from "./Serializer/Normalizer";
import { Operation } from "@/services/EntityRoute/decorators/Groups";
import { AbstractFilter, IAbstractFilterConfig, QueryParams } from "./Filters/AbstractFilter";
import { EntityMapper } from "./Mapping/EntityMapper";
import { Denormalizer, ErrorMappingItem } from "./Serializer/Denormalizer";
import { isType } from "./utils";
import { entityRoutesContainer } from ".";
import { QueryAliasManager } from "./Serializer/QueryAliasManager";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";

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

    // Meta
    private routeMetadata: RouteMetadata;
    private filtersMeta: RouteFiltersMeta;
    private subresourcesMeta: RouteSubresourcesMeta<Entity>;

    // Managers/services
    public readonly mapper: EntityMapper<Entity>;
    public readonly aliasManager: QueryAliasManager;
    public readonly normalizer: Normalizer<Entity>;
    public readonly denormalizer: Denormalizer<Entity>;

    constructor(entity: ObjectType<Entity>, globalOptions: IEntityRouteOptions = {}) {
        // Entity Route specifics
        this.repository = getRepository(entity);
        this.actions = ACTIONS;
        this.globalOptions = globalOptions;

        // Meta
        this.routeMetadata = getRouteMetadata(entity);
        this.filtersMeta = getRouteFiltersMeta(entity);
        this.subresourcesMeta = getRouteSubresourcesMetadata(entity);

        // Managers/services
        this.mapper = new EntityMapper<Entity>(this);
        this.aliasManager = new QueryAliasManager();
        this.normalizer = new Normalizer<Entity>(this);
        this.denormalizer = new Denormalizer(this);

        // Add this EntityRoute to the list (used by subresources)
        entityRoutesContainer[entity.name] = this;
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

        for (let i = 0; i < this.routeMetadata.operations.length; i++) {
            const operation = this.routeMetadata.operations[i];
            const verb = this.actions[operation].verb;
            const path = this.routeMetadata.path + this.actions[operation].path;

            const responseMethod = this.makeResponseMethod(operation);
            const mappingMethod = this.makeRouteMappingMethod(operation);

            (<any>router)[verb](path, responseMethod);
            (<any>router)[verb](path + "/mapping", mappingMethod);
        }

        if (Object.keys(this.subresourcesMeta.properties).length) {
            this.makeSubresourcesRoutes(router);
        }

        return router;
    }

    /** Recursively add subresources routes for this entity */
    private makeSubresourcesRoutes(
        router: Router,
        parentSubresource?: { currentPath: string[]; subresourcePath: string }
    ) {
        // For each subresources of this entity
        for (let key in this.subresourcesMeta.properties) {
            const subresourceProp = this.subresourcesMeta.properties[key];
            const subresourceRelation = this.getSubresourceRelation(key);
            const subresourcePath = this.getSubresourceBasePath(
                subresourceRelation.param,
                subresourceProp,
                parentSubresource && parentSubresource.subresourcePath
            );

            const relationTableName = subresourceRelation.relation.inverseEntityMetadata.tableName;
            const nestedEntityRoute = entityRoutesContainer[subresourceProp.entityTarget.name];

            // If subresource entity has no EntityRoute, then it can't make a subresource out of it
            if (!nestedEntityRoute) {
                continue;
            }

            // Ensures that it is not making circular subresources routes
            if (!parentSubresource || !parentSubresource.currentPath.includes(relationTableName)) {
                // Recursively make subresources
                nestedEntityRoute.makeSubresourcesRoutes(router, {
                    subresourcePath,
                    currentPath: parentSubresource
                        ? parentSubresource.currentPath.concat(relationTableName)
                        : [relationTableName],
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

                return;
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

    private async create({ values, subresourceRelation }: IActionParams<Entity>) {
        // Auto-join subresource parent on body values
        if (subresourceRelation) {
            (values as any)[subresourceRelation.relation.inverseSidePropertyPath] = { id: subresourceRelation.id };
        }

        const insertResult = await this.denormalizer.insertItem(values);

        // Has errors
        if (isType<ErrorMappingItem>(insertResult, "errors" in insertResult)) {
            return insertResult;
        }

        return this.getDetails({ entityId: insertResult.raw.insertId });
    }

    /** Returns an entity with every mapped props (from groups) for a given id */
    private async getList({ queryParams, subresourceRelation }: IActionParams<Entity>) {
        const qb = this.repository.createQueryBuilder(this.metadata.tableName);

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
    private async getDetails({ entityId, subresourceRelation }: IActionParams<Entity>) {
        const qb = this.repository.createQueryBuilder(this.metadata.tableName);

        if (subresourceRelation) {
            this.joinSubresourceOnInverseSide(qb, subresourceRelation);
        }

        return await this.normalizer.getItem<Entity>(qb, entityId);
    }

    private async update({ values, entityId }: IActionParams<Entity>) {
        (values as any).id = entityId;
        const insertResult = await this.denormalizer.updateItem(values);

        // Has errors
        if (isType<ErrorMappingItem>(insertResult, "errors" in insertResult)) {
            return insertResult;
        }

        return this.getDetails({ entityId: insertResult.raw.insertId });
    }

    private async delete({ entityId }: IActionParams<Entity>) {
        return this.repository
            .createQueryBuilder()
            .delete()
            .from(this.repository.metadata.target)
            .where("id = :id", { id: entityId })
            .execute();
    }

    /** Returns the response method on a given operation for this entity */
    public makeResponseMethod(operation: Operation, subresourceRelation?: SubresourceRelation): Koa.Middleware {
        return async (ctx, next) => {
            const isUpdateOrCreate = (ctx.method === "POST" || ctx.method === "PUT") && ctx.request.body;

            if (subresourceRelation) {
                subresourceRelation.id = parseInt(ctx.params[subresourceRelation.param]);
            }

            const params: IActionParams<Entity> = { subresourceRelation };
            if (ctx.params.id) params.entityId = parseInt(ctx.params.id);
            if (isUpdateOrCreate) params.values = ctx.request.body;
            if (operation === "list") params.queryParams = ctx.query;

            this.aliasManager.resetList();
            const method = this.actions[operation].method;
            const result = await this[method](params);

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
    private makeRouteMappingMethod(operation: Operation): Koa.Middleware {
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
            entityMetadata: this.metadata,
            normalizer: this.normalizer,
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
    operations: Operation[];
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
    isMaxDepthEnabledByDefault?: boolean;
    /** Level of depth at which the nesting should stop */
    defaultMaxDepthLvl?: number;
    /** In case of max depth reached on a relation, should it at retrieve its id and then stop instead of just stopping ? */
    shouldMaxDepthReturnRelationPropsId?: boolean;
    /** In case of a relation with no other mapped props (from groups) for a request: should it unwrap "relation { id }" to relation = id ? */
    shouldEntityWithOnlyIdBeFlattenedToIri?: boolean;
}

/**
 * @property operation - le oui mais oui
 */
interface IActionParams<Entity extends AbstractEntity> {
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

type RouteCrudActionItem = {
    /** The route path for this action */
    path: string;
    /** HTTP verb for this action */
    verb: string;
    /** EntityRoute's method associated to this action */
    method: "create" | "getList" | "getDetails" | "update" | "delete";
};
/** A list of CRUD Actions or "all" */
type RouteCrudActions = Omit<Record<Operation | "delete", RouteCrudActionItem>, "all">;

const ACTIONS: RouteCrudActions = {
    create: {
        path: "",
        verb: "post",
        method: "create",
    },
    list: {
        path: "",
        verb: "get",
        method: "getList",
    },
    details: {
        path: "/:id(\\d+)",
        verb: "get",
        method: "getDetails",
    },
    update: {
        path: "/:id(\\d+)",
        verb: "put",
        method: "update",
    },
    delete: {
        path: "/:id(\\d+)",
        verb: "delete",
        method: "delete",
    },
};

/** Return type of EntityRoute.getList */
type CollectionResult<Entity extends AbstractEntity> = {
    items: Entity[];
    totalItems: number;
};
