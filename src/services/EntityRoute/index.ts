import * as Koa from "koa";

import { EntityRoute, IEntityRouteOptions } from "./EntityRoute";
import { AbstractEntity } from "@/entity/AbstractEntity";
import { Entity } from "@/utils/globalTypes";

export async function useEntitiesRoutes<T extends AbstractEntity>(
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
        const entityRoute = new EntityRoute<T>(entities[i], options);
        console.log(entities[i]);
        app.use(entityRoute.makeRouter().routes());
    }
}
