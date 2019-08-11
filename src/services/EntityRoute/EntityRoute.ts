import * as Koa from "koa";
import * as Router from "koa-router";
import { Connection, EntityMetadata, Repository, getRepository, ObjectType, SelectQueryBuilder } from "typeorm";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { Normalizer, AliasList } from "./Normalizer";
import { MappingMaker } from "./MappingMaker";
import { Operation } from "@/decorators/Groups";
import { AbstractFilter, IAbstractFilterOptions } from "./Filters/AbstractFilter";

export class EntityRouter<Entity extends AbstractEntity> {
    private connection: Connection;
    private repository: Repository<Entity>;
    private routeMetadatas: RouteMetadata;
    private metadata: EntityMetadata;
    private actions: RouteActions;
    private options: IEntityRouteOptions;
    private normalizer: Normalizer;
    private mappingMaker: MappingMaker;

    constructor(connection: Connection, entity: ObjectType<Entity>, options?: IEntityRouteOptions) {
        this.connection = connection;
        this.routeMetadatas = Reflect.getOwnMetadata("route", entity);
        this.repository = getRepository(entity);
        this.metadata = this.repository.metadata;
        this.options = options;
        this.normalizer = new Normalizer(this.connection, this.metadata, this.options);
        this.mappingMaker = new MappingMaker(this.metadata, this.normalizer);

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

    get filters() {
        return this.routeMetadatas.options && this.routeMetadatas.options.filters;
    }

    /**
     * Make a Koa Router with given operations for this entity and return it
     *
     * @returns Koa.Router
     */
    makeRouter() {
        const router = new Router();

        for (let i = 0; i < this.routeMetadatas.operations.length; i++) {
            const operation = this.routeMetadatas.operations[i];
            const verb = this.actions[operation].verb;
            const path = this.routeMetadatas.path + this.actions[operation].path;

            const responseMethod = this.makeResponseMethod(operation);
            const mappingMethod = this.makeMappingMethod(operation);

            (<any>router)[verb](path, responseMethod);
            (<any>router)[verb](path + "/mapping", mappingMethod);
        }

        return router;
    }

    private async create({ values }: IActionParams) {
        return this.repository
            .createQueryBuilder()
            .insert()
            .into(this.repository.metadata.tableName)
            .values(values)
            .execute();
    }

    private async getList({ dumpSql, operation, queryParams }: IActionParams) {
        const qb = this.repository.createQueryBuilder(this.metadata.tableName);
        const aliases = {};

        if (this.filters) {
            this.applyRouteFilters(queryParams, qb, aliases);
        }

        const collectionResult = await this.normalizer.getCollection<Entity>(operation, qb, aliases);
        const result = {
            items: collectionResult[0],
            totalItems: collectionResult[1],
            sql: undefined as any,
        };

        if (dumpSql) result.sql = qb.getSql();

        return result;
    }

    private async getDetails({ dumpSql, operation, entityId }: IActionParams) {
        const selectProps = this.normalizer.getSelectProps(operation, this.metadata, true);
        const qb: SelectQueryBuilder<any> = this.repository
            .createQueryBuilder(this.metadata.tableName)
            .select(selectProps)
            .where(this.metadata.tableName + ".id = :id", { id: entityId });
        const item = await this.normalizer.getItem(operation, qb);

        const result = {
            item,
            sql: undefined as any,
        };

        if (dumpSql) result.sql = qb.getSql();

        return result;
    }

    private async update({ values, entityId }: IActionParams) {
        return this.repository
            .createQueryBuilder()
            .insert()
            .update(this.repository.metadata.tableName)
            .set(values)
            .where(`${this.repository.metadata.tableName}.id = :id`, { id: entityId })
            .execute();
    }

    private async delete({ entityId }: IActionParams) {
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

            const params: IActionParams = { operation };
            if (ctx.params.id) params.entityId = ctx.params.id;
            if (isUpdateOrCreate) params.values = ctx.request.body;
            if (operation === "list") params.queryParams = ctx.query;
            if ("dumpSql" in ctx.query) params.dumpSql = true;

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

    private getFilter<Filter extends AbstractFilter>(options: IAbstractFilterOptions): Filter {
        return new options.class({
            options,
            entityMetadata: this.metadata,
            normalizer: this.normalizer,
        });
    }

    private applyRouteFilters(queryParams: any, qb: SelectQueryBuilder<Entity>, aliases: AliasList) {
        if (!Object.keys(queryParams).length) {
            return;
        }

        this.filters.forEach((filterOptions) => {
            if (filterOptions.queryParamKey && filterOptions.queryParamKey in queryParams) {
                // TODO
            } else if (filterOptions.usePropertyNamesAsQueryParams) {
                this.getFilter(filterOptions).apply({ queryParams, qb, aliases });
            }
        });
    }
}

export type RouteMetadata = {
    path: string;
    operations: Operation[];
    options?: {
        filters?: IAbstractFilterOptions[];
    };
};

export interface IEntityRouteOptions {
    isMaxDepthEnabledByDefault?: boolean;
    defaultMaxDepthLvl?: number;
    shouldMaxDepthReturnRelationPropsId?: boolean;
    shouldEntityWithOnlyIdBeFlattenedToIri?: boolean;
}

interface IActionParams {
    operation: Operation;
    exposedProps?: string[];
    entityId?: number;
    isUpdateOrCreate?: boolean;
    values?: any;
    queryParams?: any;
    dumpSql?: Boolean;
}

interface IRouteResponse {
    "@context": {
        operation: string;
        entity: string;
        totalItems?: number;
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

type RouteActions = Omit<Record<Operation, RouteAction>, "all">;
