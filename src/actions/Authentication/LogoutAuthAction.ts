import { Context } from "koa";
import { getManager } from "typeorm";

import { User } from "@/entity/User";
import { makeRouterFromCustomActions } from "@/services/EntityRoute/Actions/AbstractRouteAction";
import { ROUTE_VERB } from "@/services/EntityRoute/ResponseManager";
import { isTokenValid } from "@/services/JWT";

export function useLogoutAction() {
    return makeRouterFromCustomActions([
        {
            verb: ROUTE_VERB.GET,
            path: "/logout",
            handler: logout,
        },
    ]);
}

async function logout(ctx: Context) {
    try {
        const decoded = await isTokenValid(ctx.req.headers.authorization);

        // Use current refreshToken to revoke itself
        if (decoded.isRefreshToken) {
            const manager = getManager();
            const userRepo = manager.getRepository(User);
            try {
                await userRepo.increment({ id: decoded.id }, "refreshTokenVersion", 1);
                ctx.status = 200;
            } catch (error) {
                ctx.throw(400);
            }
        } else {
            ctx.throw(401);
        }
    } catch (error) {
        ctx.throw(401);
    }
}
