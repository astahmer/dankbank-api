import * as Koa from "koa";
import * as Router from "koa-router";
import { Connection } from "typeorm";
import { EntityGroupsMetadata } from "@/services/EntityRoute/GroupsMetadata/EntityGroupsMetadata";

export function useGroupsRoute(connection: Connection, app: Koa) {
    const router = new Router();
    router.get("/groups/:tableName", async (ctx) => {
        try {
            const repository = connection.getRepository(ctx.params.tableName);
            const entityMetadata = repository.metadata;
            const groupsMeta: EntityGroupsMetadata = Reflect.getOwnMetadata("groups", entityMetadata.target);
            ctx.body = { groupsMeta };
            return;
        } catch (error) {
            ctx.body = { error };
        }
    });
    app.use(router.routes());
}
