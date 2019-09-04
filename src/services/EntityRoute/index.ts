import * as Koa from "koa";

import { EntityRoute, IEntityRouteOptions, getRouteMetadata } from "./EntityRoute";
import { AbstractEntity } from "@/entity/AbstractEntity";
import { Entity } from "@/utils/globalTypes";

/** Make an EntityRoute out of each given entities and assign them a global options object (overridable with @EntityRoute) */
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
    // Instanciate every EntityRoute
    const entityRoutes = entities.reduce((acc, entity) => {
        const routeMeta = getRouteMetadata(entity);
        if (routeMeta) {
            acc.push(new EntityRoute<T>(entity, options));
        }

        return acc;
    }, []);

    // Make router for each of them
    entityRoutes.forEach((entityRoute) => app.use(entityRoute.makeRouter().routes()));
}

export const entityRoutesContainer: Record<string, EntityRoute<any>> = {};
