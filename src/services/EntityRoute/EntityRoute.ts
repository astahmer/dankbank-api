import * as Koa from "koa";
import * as Router from "koa-router";
import { Repository, getRepository, ObjectType, SelectQueryBuilder, DeepPartial, DeleteResult } from "typeorm";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { Normalizer, AliasList } from "./Normalizer";
import { Operation } from "@/decorators/Groups";
import { AbstractFilter, IAbstractFilterConfig, QueryParams } from "./Filters/AbstractFilter";
import { EntityMapper } from "./EntityMapper";
import { Denormalizer } from "./Denormalizer";
import { isType } from "./utils";
import { ValidationError } from "class-validator";

export const ROUTE_METAKEY = Symbol("route");
export const getRouteMetadata = (entity: Function): RouteMetadata => Reflect.getOwnMetadata(ROUTE_METAKEY, entity);

export const ROUTE_FILTERS_METAKEY = Symbol("filters");
export const getRouteFiltersMeta = (entity: Function): RouteFiltersMeta =>
    Reflect.getOwnMetadata(ROUTE_FILTERS_METAKEY, entity);

export class EntityRoute<Entity extends AbstractEntity> {
    private repository: Repository<Entity>;
    private routeMetadata: RouteMetadata;
    private filtersMeta: RouteFiltersMeta;
    private actions: RouteActions;
    private globalOptions: IEntityRouteOptions;

    private entityMapper: EntityMapper<Entity>;
    private normalizer: Normalizer<Entity>;
    private denormalizer: Denormalizer<Entity>;

    constructor(entity: ObjectType<Entity>, globalOptions: IEntityRouteOptions = {}) {
        this.routeMetadata = getRouteMetadata(entity);
        this.filtersMeta = getRouteFiltersMeta(entity);
        this.repository = getRepository(entity.name);
        this.globalOptions = globalOptions;

        this.entityMapper = new EntityMapper<Entity>(this);
        this.normalizer = new Normalizer<Entity>(this);
        this.denormalizer = new Denormalizer(this);

        this.actions = {
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
    makeRouter() {
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

        return router;
    }

    private async create({ values }: IActionParams<Entity>) {
        const insertResult = await this.denormalizer.insertItem(values);

        // Has errors
        if (Array.isArray(insertResult)) {
            return insertResult;
        }

        return this.getDetails({ operation: "details", entityId: insertResult.id });
    }

    private async getList({ operation, queryParams }: IActionParams<Entity>) {
        const qb = this.repository.createQueryBuilder(this.metadata.tableName);
        const aliases = {};

        if (this.filtersMeta) {
            this.applyFilters(queryParams, qb, aliases);
        }

        const collectionResult = await this.normalizer.getCollection(operation, qb, aliases);

        return {
            items: collectionResult[0],
            totalItems: collectionResult[1],
        } as CollectionResult<Entity>;
    }

    private async getDetails({ entityId }: IActionParams<Entity>) {
        return await this.normalizer.getItem<Entity>("details", entityId);
    }

    private async update({ values }: IActionParams<Entity>) {
        const insertResult = await this.denormalizer.insertItem(values);

        // Has errors
        if (Array.isArray(insertResult)) {
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

    private makeResponseMethod(operation: Operation): Koa.Middleware {
        return async (ctx, next) => {
            const isUpdateOrCreate = (ctx.method === "POST" || ctx.method === "PUT") && ctx.request.body;

            const params: IActionParams<Entity> = { operation };
            if (ctx.params.id) params.entityId = ctx.params.id;
            if (isUpdateOrCreate) params.values = ctx.request.body;
            if (operation === "list") params.queryParams = ctx.query;

            const method = this.actions[operation].method;
            const result = await this[method](params);

            let response: IRouteResponse = {
                "@context": {
                    operation,
                    entity: this.metadata.tableName,
                    errors: null,
                },
            };

            if (isType<CollectionResult<Entity>>(result, operation === "list")) {
                response["@context"].retrievedItems = result.items.length;
                response["@context"].totalItems = result.totalItems;
                response.items = result.items;
            } else if (isType<DeleteResult>(result)) {
                response.deleted = result;
            } else if (Array.isArray(result)) {
                response["@context"].errors = result;
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

    private applyFilters(queryParams: QueryParams, qb: SelectQueryBuilder<Entity>, aliases: AliasList) {
        if (!Object.keys(queryParams).length) {
            return;
        }

        this.filters.forEach((filterOptions) => {
            this.getFilter(filterOptions).apply({ queryParams, qb, whereExp: qb, aliases });
        });
    }
}

export type RouteMetadata = {
    path: string;
    operations: Operation[];
    options?: IEntityRouteOptions;
};

export type RouteFiltersMeta = Record<string, IAbstractFilterConfig>;

export interface IEntityRouteOptions {
    isMaxDepthEnabledByDefault?: boolean;
    defaultMaxDepthLvl?: number;
    shouldMaxDepthReturnRelationPropsId?: boolean;
    shouldEntityWithOnlyIdBeFlattenedToIri?: boolean;
}

interface IActionParams<Entity extends AbstractEntity> {
    operation: Operation;
    exposedProps?: string[];
    entityId?: number;
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
        errors?: ValidationError[];
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
