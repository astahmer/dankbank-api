import * as Router from "koa-router";

import { useLogoutAction } from "./LogoutAuthAction";
import { usePasswordAuth } from "./PasswordAuthAction";
import { useRefreshAuth } from "./RefreshAuthAction";
import { useTwitterAuth } from "./TwitterAuthAction";
import { useVerifyJwtAuth } from "./VerifyJwtAuthAction";

export function useAuthRoutes() {
    const router = new Router({ prefix: "/auth" });

    router.use(usePasswordAuth().routes());
    router.use(useVerifyJwtAuth().routes());
    router.use(useRefreshAuth().routes());
    router.use(useLogoutAction().routes());
    router.use(useTwitterAuth().prefix("/twitter").routes());

    return router;
}
