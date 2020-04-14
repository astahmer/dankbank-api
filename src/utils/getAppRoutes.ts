import { Middleware } from "koa";
import Router = require("koa-router");

export type Entrypoints = ReturnType<typeof getAppRoutes>[0];
export type Entrypoint = Entrypoints[0];

export const getAppRoutes = (arr: Middleware[]) => {
    const returnRoute = (midw: Middleware) => {
        const formatRoute = (item: Router.Layer) => ({
            methods: item.methods,
            path: item.path,
            desc: item.methods.join(",") + " : " + item.path,
        });
        const router: Router = (midw as any).router;
        return router && router.stack.length && router.stack.map(formatRoute);
    };
    return arr.map(returnRoute).filter(Boolean);
};
