import { RouteDefaultOperation } from "./Groups";
import { ROUTE_METAKEY, IEntityRouteOptions } from "@/services/EntityRoute/EntityRoute";

/**
 * @example
 *
 * [at]PaginationFilter([], { all: true })
 * [at]SearchFilter(["id", { name: "startsWith" }])
 * [at]EntityRoute("/users", ["create", "list", "details", "update", "delete"], {
 *     actions: [
 *         {
 *             verb: ROUTE_VERB.GET,
 *             path: "/custom",
 *             class: CustomAction,
 *             middlewares: [
 *                 async function(ctx, next) {
 *                     console.log("before custom action");
 *                     await next();
 *                     console.log("after custom action");
 *                 },
 *             ],
 *         },
 *     ],
 * })
 */
export const EntityRoute = (
    path: string,
    operations: RouteDefaultOperation[] = [],
    options: IEntityRouteOptions = {}
): ClassDecorator => {
    return (target: Function) => {
        Reflect.defineMetadata(ROUTE_METAKEY, { path, operations, options }, target);
    };
};
