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
    const entityRoutes = entities.map((entity) => new EntityRoute<T>(entity, options));
    entityRoutes.forEach((entityRoute) => app.use(entityRoute.makeRouter().routes()));
}

export const entityRoutesContainer: Record<string, EntityRoute<any>> = {};
