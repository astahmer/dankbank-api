import { Middleware, ParameterizedContext } from "koa";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import { ErrorMappingItem } from "./Serializer/Denormalizer";
import { AbstractEntity } from "@/entity/AbstractEntity";
import { EntityRoute, getRouteFiltersMeta, RouteFiltersMeta } from "./EntityRoute";
import { QueryRunner, DeleteResult, SelectQueryBuilder } from "typeorm";
import { isType } from "./utils";
import { RouteOperation } from "./Decorators/Groups";
import { SubresourceRelation } from "./SubresourceManager";
import { RouteActionClass } from "./Actions/RouteAction";
import { AbstractFilter, IAbstractFilterConfig, QueryParams } from "./Filters/AbstractFilter";

export class ResponseManager<Entity extends AbstractEntity> {
    private filtersMeta: RouteFiltersMeta;

    get connection() {
        return this.entityRoute.connection;
    }
    get repository() {
        return this.entityRoute.repository;
    }
    get metadata() {
        return this.entityRoute.repository.metadata;
    }
    get routeMetadata() {
        return this.entityRoute.routeMetadata;
    }
    get subresourceManager() {
        return this.entityRoute.subresourceManager;
    }
    get aliasManager() {
        return this.entityRoute.aliasManager;
    }
    get denormalizer() {
        return this.entityRoute.denormalizer;
    }
    get normalizer() {
        return this.entityRoute.normalizer;
    }
    get mapper() {
        return this.entityRoute.mapper;
    }
    get customActions() {
        return this.entityRoute.customActions;
    }
    get filters() {
        return Object.values(this.filtersMeta);
    }

    constructor(private entityRoute: EntityRoute<Entity>) {
        this.filtersMeta = getRouteFiltersMeta(entityRoute.repository.metadata.target as Function);
    }

    public async create({ operation, values, subresourceRelation }: IActionParams<Entity>, queryRunner: QueryRunner) {
        // Auto-join subresource parent on body values
        if (subresourceRelation) {
            (values as any)[subresourceRelation.relation.inverseSidePropertyPath] = { id: subresourceRelation.id };
        }

        const insertResult = await this.denormalizer.insertItem(values, { operation, queryRunner });

        // Has errors
        if (isType<ErrorMappingItem>(insertResult, "errors" in insertResult)) {
            return insertResult;
        }

        return this.getDetails({ operation, entityId: insertResult.id }, queryRunner);
    }

    /** Returns an entity with every mapped props (from groups) for a given id */
    public async getList(
        { operation, queryParams, subresourceRelation }: IActionParams<Entity>,
        queryRunner: QueryRunner
    ) {
        const repository = queryRunner.manager.getRepository<Entity>(this.metadata.target);
        const qb = repository.createQueryBuilder(this.metadata.tableName);

        // Apply a max item to retrieve
        qb.take(500);

        if (subresourceRelation) {
            this.subresourceManager.joinSubresourceOnInverseSide(qb, subresourceRelation);
        }

        if (this.filtersMeta) {
            this.applyFilters(queryParams, qb);
        }

        const collectionResult = await this.normalizer.getCollection(qb, operation || "list");

        return {
            items: collectionResult[0],
            totalItems: collectionResult[1],
        } as CollectionResult<Entity>;
    }

    /** Returns an entity with every mapped props (from groups) for a given id */
    public async getDetails(
        { operation, entityId, subresourceRelation }: IActionParams<Entity>,
        queryRunner: QueryRunner
    ) {
        const repository = queryRunner.manager.getRepository<Entity>(this.metadata.target);
        const qb = repository.createQueryBuilder(this.metadata.tableName);

        if (subresourceRelation) {
            this.subresourceManager.joinSubresourceOnInverseSide(qb, subresourceRelation);
        }

        return await this.normalizer.getItem<Entity>(qb, entityId, operation || "details");
    }

    public async update({ operation, values, entityId }: IActionParams<Entity>, queryRunner: QueryRunner) {
        (values as any).id = entityId;
        const insertResult = await this.denormalizer.updateItem(values, { operation, queryRunner });

        // Has errors
        if (isType<ErrorMappingItem>(insertResult, "errors" in insertResult)) {
            return insertResult;
        }

        return this.getDetails({ operation, entityId: insertResult.id }, queryRunner);
    }

    public async delete({ entityId }: IActionParams<Entity>, _queryRunner: QueryRunner) {
        return this.repository
            .createQueryBuilder()
            .delete()
            .from(this.repository.metadata.target)
            .where("id = :id", { id: entityId })
            .execute();
    }

    /** Returns the response method on a given operation for this entity */
    public makeResponseMethod(operation: RouteOperation, subresourceRelation?: SubresourceRelation): Middleware;
    public makeResponseMethod(
        operation: RouteOperation,
        subresourceRelationOrCustomAction?: SubresourceRelation
    ): Middleware {
        return async (ctx, next) => {
            const isUpdateOrCreate = (ctx.method === "POST" || ctx.method === "PUT") && ctx.request.body;

            let subresourceRelation: SubresourceRelation;
            let customAction: IRouteCustomActionItem;
            if (subresourceRelationOrCustomAction) {
                subresourceRelation = subresourceRelationOrCustomAction;
                subresourceRelation.id = parseInt(ctx.params[subresourceRelation.param]);
            }

            const params: IActionParams<Entity> = { subresourceRelation };
            if (ctx.params.id) params.entityId = parseInt(ctx.params.id);
            if (isUpdateOrCreate) params.values = ctx.request.body;
            if (operation === "list") params.queryParams = ctx.query;

            this.aliasManager.resetList();

            // Create query runner to retrieve requestContext in subscribers
            const queryRunner = this.connection.createQueryRunner();
            const requestContext: RequestContext<Entity> = { ctx, params, entityRoute: this as any };
            queryRunner.data = { requestContext };

            const method = CRUD_ACTIONS[operation].method;
            const result = await this[method](params, queryRunner);

            queryRunner.release();

            let response: IRouteResponse = {
                "@context": {
                    operation,
                    entity: this.metadata.tableName,
                },
            };
            if (isUpdateOrCreate) response["@context"].errors = null;

            if (!customAction) {
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
            }

            ctx.body = response;

            next();
        };
    }

    /** Returns the method of a mapping route on a given operation for this entity */
    public makeRouteMappingMethod(operation: RouteOperation): Middleware {
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

    /** Apply every registered filters on this route */
    private applyFilters(queryParams: QueryParams, qb: SelectQueryBuilder<Entity>) {
        this.filters.forEach((filterOptions) => {
            this.getFilter(filterOptions).apply({ queryParams, qb, whereExp: qb });
        });
    }
}

type RouteCrudActions = Omit<Record<RouteOperation | "delete", IRouteCrudActionItem>, "all">;

export enum ROUTE_VERB {
    "GET" = "get",
    "POST" = "post",
    "PUT" = "put",
    "DELETE" = "delete",
}

export const CRUD_ACTIONS: RouteCrudActions = {
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

export interface IRouteCrudActionItem {
    /** The route path for this action */
    path: string;
    /** HTTP verb for this action */
    verb: ROUTE_VERB;
    /** EntityRoute method's name associated to this action or just a function */
    method?: "create" | "getList" | "getDetails" | "update" | "delete";
}

export interface IRouteCustomActionItem extends Omit<IRouteCrudActionItem, "method"> {
    /** Custom operation for that action */
    operation?: RouteOperation;
    /** Class that implements RouteAction, onRequest method will be called by default unless a custom action parameter is defined */
    class?: RouteActionClass;
    /** Custom method name of RouteAction class to call for this verb+path, mostly useful to re-use the same class for multiple actions */
    action?: string;
    /** List of middlewares to be called (in the same order as defined here) */
    middlewares?: Middleware[];
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
    /** Custom operation for a custom action */
    operation?: RouteOperation;
}

export type RequestContext<Entity extends AbstractEntity> = {
    ctx: ParameterizedContext<any, {}>;
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

/** Return type of EntityRoute.getList */
type CollectionResult<Entity extends AbstractEntity> = {
    items: Entity[];
    totalItems: number;
};
