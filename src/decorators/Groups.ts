import { EntityGroupsMetadata } from "../services/EntityRoute/GroupsMetadata/EntityGroupsMetadata";
import { PartialRecord } from "@/utils/globalTypes";

/**
 * Expose decorated property for each operation for each listed EntityRoute context
 *
 * @param groups An object containing a list of every EntityRoute context
 * @param groups.route Contains an array of Operation in which the decorated property will be exposed
 */
export function Groups(groups: RouteOperations): PropertyDecorator;

/**
 * Expose decorated property for each operation listed (in any EntityContext, this list is global)
 *
 * @param operations An array containing a list of operation in which the decorated property will be exposed
 */
export function Groups(operations: OperationsOrAll): PropertyDecorator;

/**
 * Expose decorated computed property (method) for each operation for each listed EntityRoute context
 *
 * @param groups  An array containing a list of operation in which the decorated property will be exposed / An object containing a list of every EntityRoute context
 * @param groups.route Contains an array of Operation in which the decorated property will be exposed
 * @param alias Override default generated name for this computed property in response
 */
export function Groups(groups: OperationsOrAll | RouteOperations, alias?: string): MethodDecorator;

export function Groups(groups: OperationsOrAll | RouteOperations, alias?: string): PropertyDecorator | MethodDecorator {
    return (target: Object, propName: string, descriptor: PropertyDescriptor) => {
        let groupsMeta: EntityGroupsMetadata = Reflect.getOwnMetadata("groups", target.constructor);
        if (!groupsMeta) {
            groupsMeta = new EntityGroupsMetadata("groups", target.constructor);
        }

        // Is a computed property (method decorator)
        if (descriptor) {
            propName = COMPUTED_PREFIX + propName + (alias ? ALIAS_PREFIX + alias : "");
        }

        if (Array.isArray(groups)) {
            groupsMeta.addPropToGlobalGroups(groups, propName);
        } else if (groups === "all") {
            groupsMeta.addPropToGlobalGroups(ALL_OPERATIONS, propName);
        } else {
            groupsMeta.addPropToRoutesGroups(groups, propName);
        }

        Reflect.defineMetadata("groups", groupsMeta, target.constructor);
    };
}

export type Operation = "create" | "list" | "details" | "update" | "delete";

// Types only used as params for @Groups decorator
export type OperationsOrAll = Operation[] | "all";
export type RouteOperations = Record<string, OperationsOrAll>;

/** An object with Operation as keys and an array of entity props as values  */
export type OperationGroups = PartialRecord<Operation, string[]>;

/**
 * An object containing many routeContext (keys) associated to OperationsGroups (values)
 * A route context key is the tableName of the EntityRoute (/users => user, /pictures => picture).
 */
export type ContextOperations = Record<string, OperationGroups>;

export const ALL_OPERATIONS: Operation[] = ["create", "list", "details", "update", "delete"];
export const COMPUTED_PREFIX = "_COMPUTED_";
export const ALIAS_PREFIX = "_ALIAS_";
