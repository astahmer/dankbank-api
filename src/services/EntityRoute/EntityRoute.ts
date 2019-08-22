import * as Koa from "koa";
import * as Router from "koa-router";
import { Repository, getRepository, ObjectType, SelectQueryBuilder } from "typeorm";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { Normalizer, AliasList } from "./Normalizer";
import { MappingMaker } from "./MappingMaker";
import { Operation } from "@/decorators/Groups";
import { AbstractFilter, IAbstractFilterConfig, QueryParams } from "./Filters/AbstractFilter";
import { validate } from "class-validator";
import { EntityMapper } from "./EntityMapper";

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
    private mappingMaker: MappingMaker<Entity>;

    constructor(entity: ObjectType<Entity>, globalOptions: IEntityRouteOptions = {}) {
        this.routeMetadata = getRouteMetadata(entity);
        this.filtersMeta = getRouteFiltersMeta(entity);
        this.repository = getRepository(entity);
        this.globalOptions = globalOptions;

        this.entityMapper = new EntityMapper<Entity>(this);
        this.normalizer = new Normalizer(this);
        this.mappingMaker = new MappingMaker(this.entityMapper);

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
        const insertPromise = this.repository
            .createQueryBuilder()
            .insert()
            .into(this.repository.metadata.tableName)
            .values(values)
            .execute();

        const insertResult = await insertPromise;
        return this.getDetails({ operation: "details", entityId: insertResult.raw });
    }

    private async getList({ dumpSql, operation, queryParams }: IActionParams<Entity>) {
        const qb = this.repository.createQueryBuilder(this.metadata.tableName);
        const aliases = {};

        if (this.filtersMeta) {
            this.applyFilters(queryParams, qb, aliases);
        }

        const collectionResult = await this.normalizer.getCollection<Entity>(operation, qb, aliases);
        const result = {
            items: collectionResult[0],
            totalItems: collectionResult[1],
            sql: undefined as any,
        };

        if (dumpSql) {
            if (dumpSql === "where") result.sql = qb.expressionMap.wheres;
            else if (dumpSql === "params") result.sql = qb.getParameters();
            else result.sql = qb.getQueryAndParameters();
        }

        return result;
    }

    private async getDetails({ dumpSql, entityId }: IActionParams<Entity>) {
        const item = await this.normalizer.getItem("details", entityId);
        const result: { item: AbstractEntity; sql?: any } = { item };

        if (dumpSql) {
            const qb = this.normalizer.currentQb;

            if (dumpSql === "where") result.sql = qb.expressionMap.wheres;
            else if (dumpSql === "params") result.sql = qb.getParameters();
            else result.sql = qb.getQueryAndParameters();
        }

        return result;
    }

    private async update({ values, entityId }: IActionParams<Entity>) {
        return this.repository
            .createQueryBuilder()
            .insert()
            .update(this.repository.metadata.tableName)
            .set(values as any)
            .where(`${this.repository.metadata.tableName}.id = :id`, { id: entityId })
            .execute();
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
            if ("dumpSql" in ctx.query) params.dumpSql = ctx.query.dumpSql;

            const method = this.actions[operation].method;
            const result: any = await this[method](params);

            let response: IRouteResponse = {
                "@context": {
                    operation,
                    entity: this.metadata.tableName,
                },
            };

            if (operation === "list") {
                response["@context"].totalItems = result.totalItems;
                response["@context"].retrievedItems = result.items.length;
                response.items = result.items;
            } else {
                response = { ...response, ...result.item };
            }

            if ("dumpSql" in ctx.query) {
                response["@context"].sql = result.sql;
                console.log(result.sql);
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
                mapping: this.mappingMaker.make(operation),
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
    values?: Entity;
    queryParams?: any;
    dumpSql?: string;
}

interface IRouteResponse {
    "@context": {
        operation: string;
        entity: string;
        totalItems?: number;
        retrievedItems?: number;
        sql?: string;
    };
    items?: any[];
    [k: string]: any;
}

type RouteAction = {
    path: string;
    verb: string;
    method: "create" | "getList" | "getDetails" | "update" | "delete";
};
type RouteActions = Omit<Record<Operation | "delete", RouteAction>, "all">;
