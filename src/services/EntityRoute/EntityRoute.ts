import * as Koa from "koa";
import * as Router from "koa-router";
import { Connection, EntityMetadata, Repository, getRepository, ObjectType } from "typeorm";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { Normalizer } from "./Normalizer";
import { MappingMaker } from "./MappingMaker";
import { Operation } from "@/decorators/Groups";

export class EntityRouter<T extends AbstractEntity> {
    private connection: Connection;
    private repository: Repository<T>;
    private routeMetadatas: RouteMetadata;
    private metadata: EntityMetadata;
    private actions: RouteActions;
    private options: IEntityRouteOptions;
    private normalizer: Normalizer;
    private mappingMaker: MappingMaker;

    constructor(connection: Connection, entity: ObjectType<T>, options?: IEntityRouteOptions) {
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

    private async getList({ operation }: { operation: Operation }): Promise<[T[], number]> {
        const selectProps = this.normalizer.getSelectProps(operation, this.metadata);
        const qb = this.repository.createQueryBuilder(this.metadata.tableName);
        qb.select(selectProps);
        const baseItems = await qb.getManyAndCount();

        const items = await this.normalizer.setNestedExposedPropsInCollection(
            baseItems[0],
            operation,
            this.metadata,
            this.metadata.tableName
        );

        return [items, baseItems[1]];
    }

    private async getDetails({ operation }: { operation: Operation }): Promise<[T, number]> {
        const selectProps = this.normalizer.getSelectProps(operation, this.metadata);
        const qb = this.repository.createQueryBuilder(this.metadata.tableName);
        qb.select(selectProps);
        const baseItem = await qb.getOne();

        if (!baseItem) {
            return [null, 0];
        }

        const item = await this.normalizer.setNestedExposedPropsOnItem(
            baseItem,
            operation,
            this.metadata,
            this.metadata.tableName
        );

        return [item, 1];
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
            const isUpserting = (ctx.method === "POST" || ctx.method === "PUT") && ctx.request.body;
            const params: IActionParams = {
                operation,
                ...(ctx.params.id && { entityId: ctx.params.id }),
                ...(isUpserting && { values: ctx.request.body }),
            };

            const method = this.actions[operation].method;
            const result = await this[method](params);

            let items, totalItems;
            // if (!isUpserting) {
            //     [items, totalItems] = result;
            // } else {
            //     items = [result];
            //     totalItems = 1;
            // }

            ctx.body = {
                context: {
                    operation,
                    entity: this.metadata.tableName,
                },
                items,
                totalItems,
                result,
            };
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
}

export type RouteMetadata = {
    path: string;
    operations: Operation[];
};

export interface IEntityRouteOptions {
    isMaxDepthEnabledByDefault?: boolean;
    shouldMaxDepthReturnRelationPropsIri?: boolean;
}

interface IActionParams {
    operation: Operation;
    exposedProps?: string[];
    entityId?: number;
    isUpserting?: boolean;
    values?: any;
}

type RouteAction = {
    path: string;
    verb: string;
    method: "create" | "getList" | "getDetails" | "update" | "delete";
};

type RouteActions = Omit<Record<Operation, RouteAction>, "all">;
