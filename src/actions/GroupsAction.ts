import * as Koa from "koa";
import * as Router from "koa-router";
import { Connection } from "typeorm";

import { RouteAction } from "@/services/EntityRoute/Actions/RouteAction";
import { EntityGroupsMetadata } from "@/services/EntityRoute/GroupsMetadata/EntityGroupsMetadata";

export function useGroupsRoute(connection: Connection, app: Koa) {
    const router = new Router();
    const action = new GroupsAction(connection);

    router.get("/groups/:tableName", action.onRequest);
    app.use(router.routes());
}

class GroupsAction implements RouteAction {
    constructor(private connection: Connection) {}

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
