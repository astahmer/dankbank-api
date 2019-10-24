import { NextFunction } from "connect";
import { Context } from "koa";

import { isTokenValid } from "@/services/JWT";

export async function isAuthenticatedMw(ctx: Context, next: NextFunction) {
    try {
        const decoded = await isTokenValid(ctx.req.headers.authorization);

        // Only authorize accessToken
        if (decoded.isRefreshToken) {
            ctx.throw(401);
        }
        next(decoded);
    } catch (error) {
        ctx.throw(401);
    }
}

export async function isAnonymousMw(ctx: Context, next: NextFunction) {
    if (ctx.req.headers.authorization) {
        ctx.redirect("/");
    } else {
        next();
    }
}
