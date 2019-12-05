import * as Koa from "koa";
import { Connection, getConnection } from "typeorm";

import { isAuthenticatedMw } from "@/middlewares/isAuthenticated";
import {
    IRouteAction, makeRouterFromCustomActions
} from "@/services/EntityRoute/Actions/AbstractRouteAction";
import { EntityGroupsMetadata } from "@/services/EntityRoute/GroupsMetadata/EntityGroupsMetadata";
import { ROUTE_VERB } from "@/services/EntityRoute/ResponseManager";

export function useGroupsRoute() {
    return makeRouterFromCustomActions([
        {
            verb: ROUTE_VERB.GET,
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
