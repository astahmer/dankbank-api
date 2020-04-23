import { compare } from "bcryptjs";
import { Context } from "koa";
import { getManager } from "typeorm";
import { makeRouterFromCustomActions, IRouteAction } from "@astahmer/entity-routes/";

import { User } from "@/entity/User";
import { makeAuthTokens } from "@/services/JWT";

export function usePasswordAuth() {
    return makeRouterFromCustomActions([
        {
            verb: "post",
            path: "/login",
            class: PasswordAuthAction,
        },
    ]);
}

class PasswordAuthAction implements IRouteAction {
    public async onRequest(ctx: Context) {
        const { name, email, password } = ctx.request.body;
        if ((!name && !email) || !password) {
            ctx.throw(400);
            return;
        }

        const manager = getManager();
        const where = name ? { name } : { email };
        const user = await manager.findOne(User, { select: ["name", "id", "password", "refreshTokenVersion"], where });
        if (user) {
            const isValid = await compare(password, user.password);
            if (isValid) {
                const { id, name, refreshTokenVersion } = user;
                const tokens = await makeAuthTokens({ id, name, refreshTokenVersion });
                ctx.body = { success: true, ...tokens };
            } else {
                ctx.throw(401);
            }
        } else {
            ctx.throw(401);
        }
    }
}
