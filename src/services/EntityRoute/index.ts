import * as Koa from "koa";
import { Connection } from "typeorm";

import { EntityRouter } from "./EntityRoute";
import { AbstractEntity } from "@/entity/AbstractEntity";
import { Entity, IEntityRouteOptions } from "./types";

export async function useEntitiesRoutes<T extends AbstractEntity>(
    connection: Connection,
    app: Koa,
    entities: Entity<T>[],
    options: IEntityRouteOptions = { isMaxDepthEnabledByDefault: true, shouldMaxDepthReturnRelationPropsIri: true }
) {
    for (let i = 0; i < entities.length; i++) {
        const entityRouter = new EntityRouter<T>(connection, entities[i], options);
        app.use(entityRouter.makeRouter().routes());
    }
}
