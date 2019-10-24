import { Context } from "koa";
import { getManager } from "typeorm";

import { ACCESS_TOKEN_DURATION } from "@/config/jwt";
import { User } from "@/entity/User";
import { makeRouterFromCustomActions } from "@/services/EntityRoute/Actions/RouteAction";
import { ROUTE_VERB } from "@/services/EntityRoute/ResponseManager";
import { isTokenValid, makeToken } from "@/services/JWT";

export function useRefreshAuth() {
    return makeRouterFromCustomActions([
        {
            verb: ROUTE_VERB.GET,
            path: "/refresh",
            handler: refreshAccessToken,
        },
    ]);
}

async function refreshAccessToken(ctx: Context) {
    try {
        const decoded = await isTokenValid(ctx.req.headers.authorization);

        // Only allow creating new accesToken using a valid refreshToken
        if (decoded.isRefreshToken) {
            const { id, name, refreshTokenVersion } = decoded;
            const manager = getManager();
            const user = await manager.findOne(User, decoded.id, { select: ["refreshTokenVersion"] });

            // Exclude revoked refreshToken
            if (user.refreshTokenVersion !== refreshTokenVersion) {
                ctx.throw(401);
            }

            const accessToken = await makeToken({ id, name }, ACCESS_TOKEN_DURATION);
            ctx.body = {
                success: true,
                accessToken,
            };
        } else {
            ctx.throw(401);
        }
    } catch (error) {
        ctx.throw(401);
    }
}
