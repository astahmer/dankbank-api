import * as Koa from "koa";
import * as Router from "koa-router";
import { Repository, getRepository, ObjectType, SelectQueryBuilder, DeepPartial, DeleteResult } from "typeorm";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { Normalizer } from "./Serializer/Normalizer";
import { Operation } from "@/decorators/Groups";
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
    private repository: Repository<Entity>;
    private routeMetadata: RouteMetadata;
    private filtersMeta: RouteFiltersMeta;
    private subresourcesMeta: RouteSubresourcesMeta<Entity>;
    private actions: RouteActions;
    private globalOptions: IEntityRouteOptions;

    private entityMapper: EntityMapper<Entity>;
    private queryAliasManager: QueryAliasManager;
    private normalizer: Normalizer<Entity>;
    private denormalizer: Denormalizer<Entity>;

    constructor(entity: ObjectType<Entity>, globalOptions: IEntityRouteOptions = {}) {
        this.routeMetadata = getRouteMetadata(entity);
        this.filtersMeta = getRouteFiltersMeta(entity);
        this.subresourcesMeta = getRouteSubresourcesMetadata(entity);
        this.repository = getRepository(entity);
        this.actions = ACTIONS;
        this.globalOptions = globalOptions;

        this.entityMapper = new EntityMapper<Entity>(this);
        this.queryAliasManager = new QueryAliasManager();
        this.normalizer = new Normalizer<Entity>(this);
        this.denormalizer = new Denormalizer(this);

        entityRoutesContainer[entity.name] = this;
    }

    get routeRepository() {
        return this.repository;
    }

    get metadata() {
        return this.repository.metadata;
    }

    get mapper() {
        return this.entityMapper;
    }

    get aliasManager() {
        return this.queryAliasManager;
    }

    get filters() {
        return Object.values(this.filtersMeta);
    }

    get options() {
        return { ...this.globalOptions, ...this.routeMetadata.options };
    }

    /**
     * Make a Koa Router with given operations for this entity and return it
     *
     * @returns Koa.Router
     */
    public makeRouter() {
        const router = new Router();

        for (let i = 0; i < this.routeMetadata.operations.length; i++) {
            const operation = this.routeMetadata.operations[i];
            const verb = this.actions[operation].verb;
            const path = this.routeMetadata.path + this.actions[operation].path;

            const responseMethod = this.makeResponseMethod(operation);
            const mappingMethod = this.makeMappingMethod(operation);

            (<any>router)[verb](path, responseMethod);
            (<any>router)[verb](path + "/mapping", mappingMethod);
        }

        if (Object.keys(this.subresourcesMeta.properties).length) {
            this.makeSubresourcesRoutes(router);
        }

        return router;
    }

    private makeSubresourcesRoutes(
        router: Router,
        parentSubresource?: { currentPath: string[]; subresourcePath: string }
    ) {
        let key: string;
        let subresourceProp: SubresourceProperty<any>;
        let nestedEntityRoute: EntityRoute<any>;
        let relationTableName: string;

        // For each subresources of this entity
        for (key in this.subresourcesMeta.properties) {
            subresourceProp = this.subresourcesMeta.properties[key];
            const subresourceRelation = this.getSubresourceRelation(key);
            const subresourcePath = this.getSubresourceBasePath(
                subresourceRelation.param,
                subresourceProp,
                parentSubresource && parentSubresource.subresourcePath
            );

            relationTableName = subresourceRelation.relation.inverseEntityMetadata.tableName;
            nestedEntityRoute = entityRoutesContainer[subresourceProp.entityTarget.name];

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

        return this.getDetails({ operation: "details", entityId: insertResult.id });
    }

    private async getList({ operation, queryParams, subresourceRelation }: IActionParams<Entity>) {
        const qb = this.repository.createQueryBuilder(this.metadata.tableName);

        if (subresourceRelation) {
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

        if (this.filtersMeta) {
            this.applyFilters(queryParams, qb);
        }

        const collectionResult = await this.normalizer.getCollection(operation, qb);

        return {
            items: collectionResult[0],
            totalItems: collectionResult[1],
        } as CollectionResult<Entity>;
    }

    private async getDetails({ entityId }: IActionParams<Entity>) {
        return await this.normalizer.getItem<Entity>("details", entityId);
    }

    private async update({ values, entityId }: IActionParams<Entity>) {
        (values as any).id = entityId;
        const insertResult = await this.denormalizer.updateItem(values);

        // Has errors
        if (isType<ErrorMappingItem>(insertResult, "errors" in insertResult)) {
            return insertResult;
        }

        return this.getDetails({ operation: "details", entityId: insertResult.id });
    }

    private async delete({ entityId }: IActionParams<Entity>) {
        return this.repository
            .createQueryBuilder()
            .delete()
            .from(this.repository.metadata.target)
            .where("id = :id", { id: entityId })
            .execute();
    }

    public makeResponseMethod(operation: Operation, subresourceRelation?: SubresourceRelation): Koa.Middleware {
        return async (ctx, next) => {
            const isUpdateOrCreate = (ctx.method === "POST" || ctx.method === "PUT") && ctx.request.body;

            if (subresourceRelation) {
                subresourceRelation.id = parseInt(ctx.params[subresourceRelation.param]);
            }

            const params: IActionParams<Entity> = { operation, subresourceRelation };
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
            } else if (isType<DeleteResult>(result)) {
                response.deleted = result;
            } else {
                response = { ...response, ...result };
            }

            ctx.body = response;
            next();
        };
    }

    private makeMappingMethod(operation: Operation): Koa.Middleware {
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

    private getFilter<Filter extends AbstractFilter>(config: IAbstractFilterConfig): Filter {
        return new config.class({
            config,
            entityMetadata: this.metadata,
            normalizer: this.normalizer,
        });
    }

    private applyFilters(queryParams: QueryParams, qb: SelectQueryBuilder<Entity>) {
        if (!Object.keys(queryParams).length) {
            return;
        }

        this.filters.forEach((filterOptions) => {
            this.getFilter(filterOptions).apply({ queryParams, qb, whereExp: qb });
        });
    }
}

export type RouteMetadata = {
    path: string;
    operations: Operation[];
    options?: IEntityRouteOptions;
};

export type RouteFiltersMeta = Record<string, IAbstractFilterConfig>;

export type SubresourceOperation = "create" | "list" | "details";
export type SubresourceProperty<Entity extends AbstractEntity> = {
    path: string;
    operations: SubresourceOperation[];
    entityTarget: Entity;
};
export type RouteSubresourcesMeta<ParentEntity extends AbstractEntity> = {
    parent: ParentEntity;
    properties: Record<string, SubresourceProperty<any>>;
};
export type SubresourceRelation = {
    id?: number;
    param: string;
    propertyName: string;
    relation: RelationMetadata;
};

export interface IEntityRouteOptions {
    isMaxDepthEnabledByDefault?: boolean;
    defaultMaxDepthLvl?: number;
    shouldMaxDepthReturnRelationPropsId?: boolean;
    shouldEntityWithOnlyIdBeFlattenedToIri?: boolean;
}

const ACTIONS: RouteActions = {
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
        verb: "remove",
        method: "delete",
    },
};

interface IActionParams<Entity extends AbstractEntity> {
    operation: Operation;
    exposedProps?: string[];
    entityId?: number;
    subresourceRelation?: SubresourceRelation;
    isUpdateOrCreate?: boolean;
    values?: DeepPartial<Entity>;
    queryParams?: any;
    dumpSql?: string;
}

interface IRouteResponse {
    "@context": {
        operation: string;
        entity: string;
        totalItems?: number;
        retrievedItems?: number;
        errors?: ErrorMappingItem;
    };
    items?: any[];
    deleted?: any;
    [k: string]: any;
}

type RouteAction = {
    path: string;
    verb: string;
    method: "create" | "getList" | "getDetails" | "update" | "delete";
};
type RouteActions = Omit<Record<Operation | "delete", RouteAction>, "all">;

type CollectionResult<Entity extends AbstractEntity> = {
    items: Entity[];
    totalItems: number;
};
