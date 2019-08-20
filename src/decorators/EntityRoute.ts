import { Operation } from "./Groups";
import { ROUTE_METAKEY, IEntityRouteOptions } from "@/services/EntityRoute/EntityRoute";

export const EntityRoute = (
    path: string,
    operations: Operation[] = [],
    options: IEntityRouteOptions = {}
): ClassDecorator => {
    return (target: Function) => {
        Reflect.defineMetadata(ROUTE_METAKEY, { path, operations, options }, target);
    };
};
