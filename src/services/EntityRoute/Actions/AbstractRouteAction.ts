import { NextFunction } from "connect";
import { Context, Middleware } from "koa";
import { QueryRunner } from "typeorm";

import { AbstractEntity } from "@/entity/AbstractEntity";

import { GroupsOperation } from "../Decorators/Groups";
import { EntityRoute } from "../EntityRoute";
import { IRouteCustomActionItemClass, RouteCustomAction } from "../ResponseManager";

import Router = require("koa-router");
import { isType } from "@/functions/asserts";

export type RouteActionConstructorArgs = {
    entityRoute?: EntityRoute<any>;
    middlewares: Middleware[];
};

export interface IRouteAction {
    onRequest(ctx: Context, next: NextFunction): Promise<any>;
}

export type RouteActionClass = new (routeContext?: RouteActionConstructorArgs, ...args: any) => IRouteAction;

export abstract class AbstractRouteAction<Entity extends AbstractEntity = AbstractEntity> implements IRouteAction {
    protected entityRoute: EntityRoute<Entity>;
    protected middlewares: Middleware[];

    get routeMetadata() {
        return this.entityRoute.routeMetadata;
    }

    get entityMetadata() {
        return this.entityRoute.repository.metadata;
    }

    constructor(routeContext: RouteActionConstructorArgs) {
        const { entityRoute, middlewares } = routeContext;
        this.entityRoute = entityRoute;
        this.middlewares = middlewares;
    }

    abstract onRequest(ctx: Context, next: NextFunction): Promise<any>;

    protected getQueryRunner(ctx: Context): QueryRunner {
        return ctx.state.queryRunner;
    }

    protected async serializeItem<Entity extends AbstractEntity = AbstractEntity>(
        entity: Entity,
        operation: GroupsOperation = "details"
    ) {
        const cleaned = this.entityRoute.denormalizer.cleanItem(operation, entity as any);
        const entityInstance: Entity = entity.repository.manager.create(
            entity.getEntityMetadata().targetName,
            cleaned as any
        );

        return this.entityRoute.normalizer.recursiveFormatItem(entityInstance, operation);
    }

    protected throw(ctx: Context, message: string) {
        ctx.body = { error: message };
        ctx.status = 400;
    }
}

export function makeRouterFromCustomActions(actions: RouteCustomAction[]) {
    const router = new Router();
    actions.forEach((actionItem) => {
        const { verb, path, middlewares } = actionItem;
        let customActionMw;

        if (isType<IRouteCustomActionItemClass>(actionItem, "class" in actionItem)) {
            const { action, class: actionClass, middlewares } = actionItem;
            const instance = new actionClass({ middlewares });
            const method = (action as keyof IRouteAction) || "onRequest";

            customActionMw = instance[method].bind(instance);
        } else {
            customActionMw = actionItem.handler;
        }

        router[verb](path, ...(middlewares || []), customActionMw);
    });

    return router;
}
