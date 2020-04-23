import { hash } from "bcryptjs";
import { Context } from "koa";
import { AbstractRouteAction, RouteActionConstructorArgs } from "@astahmer/entity-routes/";

import { User } from "@/entity/User";
import { makeAuthTokens } from "@/services/JWT";
import { CustomActionClass } from "@astahmer/entity-routes/";

// TODO move dans RegisterAuthAction en externalisant les fonctions d'EntityRoute (mapper, serializers, etc)
class UserCreationAction extends AbstractRouteAction<User> {
    constructor(routeContext: RouteActionConstructorArgs) {
        super(routeContext);
    }

    public async onRequest(ctx: Context) {
        const { name, email, password } = ctx.request.body;
        const hashResult = await hash(password, 10);

        const queryRunner = this.getQueryRunner(ctx);
        const user = queryRunner.manager.create(User, {
            name,
            email,
            password: hashResult,
        });

        try {
            const result = await queryRunner.manager.save(user);
            const serialized = await this.serializeItem(result);

            const { id, name } = serialized;
            const tokens = await makeAuthTokens({ id, name, refreshTokenVersion: 0 });

            ctx.body = { ...serialized, tokens };
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                this.throw(ctx, "Username already taken.");
            }
        }
    }
}

export const userCreationMw: CustomActionClass = {
    verb: "post",
    path: "/",
    class: UserCreationAction,
};
