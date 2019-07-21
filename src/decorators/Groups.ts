import { Operation } from "../services/EntityRoute/types";
import { EntityGroupsMetadata } from "../services/EntityRoute/EntityGroupsMetadata";

export type GroupsParams = { [entityRoute: string]: Operation[] };
export type OperationGroups = { [K in Operation]?: string[] };
export type RouteGroups = { [entityRoute: string]: OperationGroups };
export type RouteGroupsByContext = { [routeContext: string]: RouteGroups };

/**
 * Expose decorated property for each operation for each listed EntityRoute context
 * @param groups An object containing a list of every EntityRoute context
 * @param groups.route Contains an array of Operation in which the decorated property will be exposed
 */
export function Groups(groups: GroupsParams): PropertyDecorator;

/**
 * Expose decorated property for each operation listed (in any EntityContext, this list is global)
 * @param operations An array containing a list of operation in which the decorated property will be exposed
 */
export function Groups(operations: Operation[]): PropertyDecorator;

export function Groups(groups: Operation[] | GroupsParams): PropertyDecorator {
    return (target: Object, propName: string) => {
        const groupsMeta = Reflect.getOwnMetadata("groups", target.constructor) || new EntityGroupsMetadata("groups");

        if (Array.isArray(groups)) {
            groupsMeta.addPropToGlobalGroups(groups, propName);
        } else {
            groupsMeta.addPropToRoutesGroups(groups, propName);
        }

        Reflect.defineMetadata("groups", groupsMeta, target.constructor);
    };
}
