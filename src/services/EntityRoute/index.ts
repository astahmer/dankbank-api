import * as Koa from "koa";
import { Connection } from "typeorm";

import { EntityRouter, IEntityRouteOptions } from "./EntityRoute";
import { AbstractEntity } from "@/entity/AbstractEntity";
import { Entity } from "@/utils/globalTypes";

export async function useEntitiesRoutes<T extends AbstractEntity>(
    connection: Connection,
    app: Koa,
    entities: Entity<T>[],
    options: IEntityRouteOptions = {
        isMaxDepthEnabledByDefault: true,
        defaultMaxDepthLvl: 2,
        shouldMaxDepthReturnRelationPropsId: true,
        shouldEntityWithOnlyIdBeFlattenedToIri: true,
    }
) {
    for (let i = 0; i < entities.length; i++) {
        const entityRouter = new EntityRouter<T>(connection, entities[i], options);
        app.use(entityRouter.makeRouter().routes());
    }
}
