import { Operation } from "./Groups";
import { IAbstractFilterConfig } from "@/services/EntityRoute/Filters/AbstractFilter";
import { ROUTE_METAKEY } from "@/services/EntityRoute/EntityRoute";

export const EntityRoute = (
    path: string,
    operations: Operation[] = [],
    options: EntityRouteOptions = {}
): ClassDecorator => {
    return (target: Function) => {
        Reflect.defineMetadata(ROUTE_METAKEY, { path, operations, options }, target);
    };
};

export type Operations = "create" | "list" | "details" | "update" | "delete";

type EntityRouteOptions = {
    filters?: IAbstractFilterConfig[];
};
