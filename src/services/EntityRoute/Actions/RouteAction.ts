import { Context, Middleware } from "koa";

import { EntityRoute } from "../EntityRoute";
import { NextFn } from "@/utils/globalTypes";

export type RouteActionConstructorArgs = {
    entityRoute: EntityRoute<any>;
    middlewares: Middleware[];
};

export interface RouteAction {
    onRequest(ctx: Context, next: NextFn): Promise<any>;
}

export type RouteActionClass = new (routeContext?: RouteActionConstructorArgs) => RouteAction;

export abstract class AbstractRouteAction implements RouteAction {
    protected entityRoute: EntityRoute<any>;
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

    abstract onRequest(ctx: Context, next: NextFn): Promise<any>;
}
