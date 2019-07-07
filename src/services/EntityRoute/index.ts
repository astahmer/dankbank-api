import * as Koa from "koa";
import { Connection, ObjectType } from "typeorm";

import { IClassMetadatas } from "./types";
import { OPERATIONS_ROUTES } from "./operationsRoutes";
import { EntityRouter } from "./EntityRoute";

export async function useEntitiesRoutes(connection: Connection, app: Koa, entities: ObjectType<any>[]) {
    for (let i = 0; i < entities.length; i++) {
        const entityRouter = new EntityRouter(getEntityRouteParams(connection, entities[i]), OPERATIONS_ROUTES);
        app.use(entityRouter.makeRouter().routes());
    }
}

function getEntityRouteParams(connection: Connection, entity: ObjectType<any>): IClassMetadatas {
    return {
        connection,
        routeMetadatas: Reflect.getOwnMetadata("route", entity),
        entityMetadata: connection.getMetadata(entity),
    };
}
