import { Context } from "koa";

import { isAuthenticatedMw } from "@/middlewares/isAuthenticated";
import { makeRouterFromCustomActions } from "@/services/EntityRoute/Actions/RouteAction";
import { ROUTE_VERB } from "@/services/EntityRoute/ResponseManager";

export function useCustomRoute() {
    return makeRouterFromCustomActions([
        {
            verb: ROUTE_VERB.GET,
            path: "/custom",
            middlewares: [isAuthenticatedMw],
            handler: async (ctx: Context) => {
                ctx.body = ctx.get("Authorization");
            },
        },
    ]);
}
