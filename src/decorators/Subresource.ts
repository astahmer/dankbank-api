import {
    ROUTE_SUBRESOURCES,
    RouteSubresourcesMeta,
    SubresourceOperation,
    getRouteSubresourcesMetadata,
} from "@/services/EntityRoute/EntityRoute";
import { ObjectType } from "typeorm";
import { AbstractEntity } from "@/entity";

export function Subresource(
    entityTarget: Promise<EntityReference> | EntityReference,
    path?: string,
    operations: SubresourceOperation[] = ["list", "details"]
): PropertyDecorator {
    return (target: Object, propName: string) => {
        // Wrap it in a promise to avoid circular-dependency problems where entityTarget would be undefined
        Promise.resolve(entityTarget).then((entityType) => {
            const subresourcesMeta: RouteSubresourcesMeta<any> = getRouteSubresourcesMetadata(target.constructor);
            subresourcesMeta.properties[propName] = {
                path: path || propName,
                operations,
                entityTarget: entityType(),
            };

            Reflect.defineMetadata(ROUTE_SUBRESOURCES, subresourcesMeta, target.constructor);
        });
    };
}

type EntityReference = <Entity extends AbstractEntity>(type?: any) => ObjectType<Entity>;
