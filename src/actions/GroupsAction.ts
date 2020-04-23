import * as Koa from "koa";
import { Connection, getConnection } from "typeorm";
import { EntityGroupsMetadata } from "@astahmer/entity-routes/";

import { isAuthenticatedMw } from "@/middlewares/isAuthenticated";
import { makeRouterFromCustomActions, IRouteAction } from "@astahmer/entity-routes/";

export function useGroupsRoute() {
    return makeRouterFromCustomActions([
        {
            verb: "get",
            path: "/groups/:tableName",
            middlewares: [isAuthenticatedMw],
            class: GroupsAction,
        },
    ]);
}

class GroupsAction implements IRouteAction {
    private connection: Connection;

    constructor() {
        this.connection = getConnection();
    }

    public async onRequest(ctx: Koa.Context) {
        try {
            const repository = this.connection.getRepository(ctx.params.tableName);
            const entityMetadata = repository.metadata;
            const groupsMeta: EntityGroupsMetadata = Reflect.getOwnMetadata("groups", entityMetadata.target);
            ctx.body = { groupsMeta };
            return;
        } catch (error) {
            ctx.body = { error };
        }
    }
}
