import { Middleware } from "koa";
import { Connection, DeleteResult, QueryRunner, Repository, SelectQueryBuilder } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { isDev } from "@/main";

import { RouteActionClass } from "./Actions/AbstractRouteAction";
import { RouteOperation } from "./Decorators/Groups";
import { getRouteFiltersMeta, RouteFiltersMeta } from "./EntityRoute";
import { AbstractFilter, IAbstractFilterConfig, QueryParams } from "./Filters/AbstractFilter";
import { EntityMapper } from "./Mapping/EntityMapper";
import { Denormalizer, ErrorMappingItem } from "./Serializer/Denormalizer";
import { Normalizer } from "./Serializer/Normalizer";
import { QueryAliasManager } from "./Serializer/QueryAliasManager";
import { SubresourceManager, SubresourceRelation } from "./SubresourceManager";
import { isType } from "./utils";

export class ResponseManager<Entity extends AbstractEntity> {
    private filtersMeta: RouteFiltersMeta;

    constructor(
        private connection: Connection,
        private repository: Repository<Entity>,
        private subresourceManager: SubresourceManager<Entity>,
        private aliasManager: QueryAliasManager,
        private denormalizer: Denormalizer<Entity>,
        private normalizer: Normalizer,
        private mapper: EntityMapper
    ) {
        this.filtersMeta = getRouteFiltersMeta(repository.metadata.target as Function);
    }

    get metadata() {
        return this.repository.metadata;
    }

    get filters() {
        return Object.values(this.filtersMeta);
    }

    public async create({ operation, values, subresourceRelation }: IActionParams<Entity>, queryRunner: QueryRunner) {
        // Auto-join subresource parent on body values
        if (
            subresourceRelation &&
            (subresourceRelation.relation.isOneToOne || subresourceRelation.relation.isManyToOne)
        ) {
            (values as any)[subresourceRelation.relation.inverseSidePropertyPath] = { id: subresourceRelation.id };
        }

        if (!Object.keys(values).length) {
            return { error: "Body can't be empty on create operation" };
        }

        const insertResult = await this.denormalizer.insertItem(values, { operation, queryRunner });

        // Has errors
        if (isType<ErrorMappingItem>(insertResult, "errors" in insertResult)) {
            return insertResult;
        }

        if (
            subresourceRelation &&
            (subresourceRelation.relation.isOneToMany || subresourceRelation.relation.isManyToMany)
        ) {
            const repository = queryRunner.manager.getRepository<Entity>(this.metadata.target);
            const qb = repository.createQueryBuilder(this.metadata.tableName);
            await qb
                .relation(subresourceRelation.relation.target, subresourceRelation.relation.propertyName)
                .of(subresourceRelation.id)
                .add(insertResult);
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

    public async delete({ entityId, subresourceRelation }: IActionParams<Entity>, queryRunner: QueryRunner) {
        // Remove relation if used on a subresource
        if (subresourceRelation) {
            const repository = queryRunner.manager.getRepository<Entity>(this.metadata.target);
            const qb = repository.createQueryBuilder(this.metadata.tableName);

            const query = qb
                .relation(subresourceRelation.relation.target, subresourceRelation.relation.propertyName)
                .of(subresourceRelation.id);

            if (subresourceRelation.relation.isOneToOne || subresourceRelation.relation.isManyToOne) {
                await query.set(null);
            } else if (subresourceRelation.relation.isOneToMany || subresourceRelation.relation.isManyToMany) {
                await query.remove(entityId);
            }
            return { affected: 1, raw: { insertId: entityId } };
        } else {
            return this.repository
                .createQueryBuilder()
                .delete()
                .from(this.repository.metadata.target)
                .where("id = :id", { id: entityId })
                .execute();
        }
    }

    public makeRequestContextMiddleware(
        operation: RouteOperation,
        subresourceRelation?: SubresourceRelation
    ): Middleware {
        return async (ctx, next) => {
            if (subresourceRelation) {
                subresourceRelation = subresourceRelation;
                subresourceRelation.id = parseInt(ctx.params[subresourceRelation.param]);
            }

            const params: IActionParams<Entity> = {
                subresourceRelation,
                isUpdateOrCreate: ctx.request.body && (ctx.method === "POST" || ctx.method === "PUT"),
            };

            if (ctx.params.id) params.entityId = parseInt(ctx.params.id);
            if (params.isUpdateOrCreate) params.values = ctx.request.body;
            if (operation === "list") params.queryParams = ctx.query;

            this.aliasManager.resetList();

            // Create query runner to retrieve requestContext in subscribers
            const queryRunner = this.connection.createQueryRunner();
            const requestContext: RequestContext<Entity> = { params };
            queryRunner.data = { requestContext };

            ctx.state.requestContext = requestContext;
            ctx.state.queryRunner = queryRunner;

            await next();

            if (!ctx.state.queryRunner.isReleased) {
                ctx.state.queryRunner.release();
            }
        };
    }

    /** Returns the response method on a given operation for this entity */
    public makeResponseMiddleware(operation: RouteOperation): Middleware {
        return async (ctx) => {
            const {
                requestContext: { params },
                queryRunner,
            } = ctx.state;

            const method = CRUD_ACTIONS[operation].method;
            let response: IRouteResponse = {
                "@context": {
                    operation,
                    entity: this.metadata.tableName,
                },
            };
            if (params.isUpdateOrCreate) response["@context"].errors = null;

            try {
                const result = await this[method]({ operation, ...params }, queryRunner);

                if (isType<ErrorMappingItem>(result, "errors" in result)) {
                    response["@context"].errors = result;
                    ctx.status = 400;
                } else if ("error" in result) {
                    response["@context"].error = result.error;
                    ctx.status = 400;
                } else if (isType<CollectionResult<Entity>>(result, operation === "list")) {
                    response["@context"].retrievedItems = result.items.length;
                    response["@context"].totalItems = result.totalItems;
                    response.items = result.items;
                } else if (isType<DeleteResult>(result, "raw" in result)) {
                    response.deleted = result.affected ? result.raw.insertId : null;
                } else {
                    response = { ...response, ...result };
                }
            } catch (error) {
                response["@context"].error = isDev ? error.message : "Bad request";
                ctx.status = 400;
            }

            ctx.body = response;
        };
    }

    /** Returns the method of a mapping route on a given operation for this entity */
    public makeRouteMappingMiddleware(operation: RouteOperation): Middleware {
        return async (ctx, next) => {
            const pretty = ctx.query.pretty;
            ctx.body = {
                context: {
                    operation: operation + ".mapping",
                    entity: this.metadata.tableName,
                },
                routeMapping: this.mapper.make(operation, pretty),
            };
            next();
        };
    }

    /** Creates a new instance of a given Filter */
    private makeFilter<Filter extends AbstractFilter>(config: IAbstractFilterConfig): Filter {
        return new config.class({
            config,
            entityMetadata: this.metadata,
            normalizer: this.normalizer,
            aliasManager: this.aliasManager,
        });
    }

    /** Apply every registered filters on this route */
    private applyFilters(queryParams: QueryParams, qb: SelectQueryBuilder<Entity>) {
        this.filters.forEach((filterOptions) => {
            this.makeFilter(filterOptions).apply({ queryParams, qb, whereExp: qb });
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
    /** List of middlewares to be called (in the same order as defined here) */
    middlewares?: Middleware[];
}

export interface IRouteCustomActionItemClass extends IRouteCustomActionItem {
    /** Class that implements RouteAction, onRequest method will be called by default unless a custom action parameter is defined */
    class?: RouteActionClass;
    /** Custom method name of RouteAction class to call for this verb+path, mostly useful to re-use the same class for multiple actions */
    action?: string;
}

export interface IRouteCustomActionItemFunction extends IRouteCustomActionItem {
    /** Custom handler (actually is a middleware) */
    handler?: Function;
}

export type RouteCustomAction = IRouteCustomActionItemClass | IRouteCustomActionItemFunction;

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
    params: IActionParams<Entity>;
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
        /** Entity validation errors */
        errors?: ErrorMappingItem;
        /** Global response error */
        error?: string;
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
