import * as Koa from "koa";
import * as Router from "koa-router";

export function useCustomRoute(app: Koa) {
    const router = new Router();
    router.get("/custom", async (ctx) => {
        ctx.body = "yes";
    });

    app.use(router.routes());
}
