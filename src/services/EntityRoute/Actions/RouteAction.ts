import { Context, Middleware } from "koa";
import { EntityMetadata } from "typeorm";

import { EntityRoute, RouteMetadata, IActionParams } from "../EntityRoute";
import { NextFn } from "@/utils/globalTypes";

export type RouteActionConstructorArgs = {
    entityRoute: EntityRoute<any>;
    routeMetadata: RouteMetadata;
    entityMetadata: EntityMetadata;
    middlewares: Middleware[];
};

export interface RouteAction {
    onRequest(ctx: Context, next: NextFn, params: IActionParams<any>): Promise<any>;
}

export type RouteActionClass = new (routeContext?: RouteActionConstructorArgs) => RouteAction;

export abstract class AbstractRouteAction implements RouteAction {
    protected entityRoute: EntityRoute<any>;
    protected routeMetadata: RouteMetadata;
    protected entityMetadata: EntityMetadata;
    protected middlewares: Middleware[];

    constructor(routeContext: RouteActionConstructorArgs) {
        const { entityRoute, routeMetadata, entityMetadata, middlewares } = routeContext;
        this.entityRoute = entityRoute;
        this.routeMetadata = routeMetadata;
        this.entityMetadata = entityMetadata;
        this.middlewares = middlewares;
    }

    abstract onRequest(ctx: Context, next: NextFn, params: IActionParams<any>): Promise<any>;

    async useMiddlewares(ctx: Context, next: NextFn) {
        let i = 0;
        for (i; i < this.middlewares.length; i++) {
            await this.middlewares[i](ctx, next);
        }
        next();
    }
}
