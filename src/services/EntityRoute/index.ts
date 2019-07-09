import * as Koa from "koa";
import { Connection } from "typeorm";

import { OPERATIONS_ROUTES } from "./operationsRoutes";
import { EntityRouter } from "./EntityRoute";
import { AbstractEntity } from "../../entity/AbstractEntity";
import { Entity } from "./types";

export async function useEntitiesRoutes<T extends AbstractEntity>(
    connection: Connection,
    app: Koa,
    entities: Entity<T>[]
) {
    for (let i = 0; i < entities.length; i++) {
        const entityRouter = new EntityRouter<T>(connection, entities[i], OPERATIONS_ROUTES);
        app.use(entityRouter.makeRouter().routes());
    }
}
