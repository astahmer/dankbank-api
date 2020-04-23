import { Context } from "koa";
import { makeRouterFromCustomActions } from "@astahmer/entity-routes/";

import { isAuthenticatedMw } from "@/middlewares/isAuthenticated";

export function useVerifyJwtAuth() {
    return makeRouterFromCustomActions([
        {
            verb: "get",
            path: "/verify",
            middlewares: [isAuthenticatedMw],
            handler: async (ctx: Context) => (ctx.body = { success: true }),
        },
    ]);
}
