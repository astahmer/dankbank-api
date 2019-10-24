import { hash } from "bcryptjs";
import { Context } from "koa";

import { User } from "@/entity/User";
import {
    AbstractRouteAction, RouteActionConstructorArgs
} from "@/services/EntityRoute/Actions/RouteAction";
import { ROUTE_VERB } from "@/services/EntityRoute/ResponseManager";
import { makeAuthTokens } from "@/services/JWT";

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
            const tokens = await makeAuthTokens({ id, name });

            ctx.body = { ...serialized, tokens };
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                this.throw(ctx, "Username already taken.");
            }
        }
    }
}

export const userCreationMw = {
    verb: ROUTE_VERB.POST,
    path: "/",
    class: UserCreationAction,
};
