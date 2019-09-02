import * as Koa from "koa";
import * as Router from "koa-router";

import { RouteAction } from "@/services/EntityRoute/Actions/RouteAction";

export function useCustomRoute(app: Koa) {
    const router = new Router();
    const action = new CustomAction();
    router.get("/custom", action.onRequest);

    app.use(router.routes());
}

class CustomAction implements RouteAction {
    public onRequest(ctx: Koa.Context) {
        ctx.body = "yes";
    }
}
