import { Context } from "koa";
import { makeRouterFromCustomActions } from "@astahmer/entity-routes/";

import { isAuthenticatedMw } from "@/middlewares/isAuthenticated";

export function useCustomRoute() {
    return makeRouterFromCustomActions([
        {
            verb: "get",
            path: "/custom",
            middlewares: [isAuthenticatedMw],
            handler: async (ctx: Context) => {
                ctx.body = ctx.get("Authorization");
            },
        },
    ]);
}
