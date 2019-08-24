import { EntityGroupsMetadata } from "../services/EntityRoute/GroupsMetadata/EntityGroupsMetadata";
import { PartialRecord } from "@/utils/globalTypes";
import { GroupsMetadata } from "@/services/EntityRoute/GroupsMetadata/GroupsMetadata";
import { EntityMetadata } from "typeorm";

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
export function Groups(operations: GroupsOperationOrAll): PropertyDecorator;

/**
 * Expose decorated computed property (method) for each operation for each listed EntityRoute context
 *
 * @param groups  An array containing a list of operation in which the decorated property will be exposed / An object containing a list of every EntityRoute context
 * @param groups.route Contains an array of Operation in which the decorated property will be exposed
 * @param alias Override default generated name for this computed property in response
 */
export function Groups(groups: GroupsOperationOrAll | RouteOperations, alias?: string): MethodDecorator;

export function Groups(
    groups: GroupsOperationOrAll | RouteOperations,
    alias?: string
): PropertyDecorator | MethodDecorator {
    return AbstractGroupsDecorator<EntityGroupsMetadata>({
        metaKey: "groups",
        metaClass: EntityGroupsMetadata,
        groups,
        alias,
    });
}

export function AbstractGroupsDecorator<G extends GroupsMetadata>({
    metaKey,
    metaClass,
    groups,
    alias,
    propNameHook,
    groupsMetaHook,
}: {
    metaKey: string;
    metaClass: new (metaKey: string, entityOrMeta: EntityMetadata | Function) => G;
    groups: GroupsOperationOrAll | RouteOperations;
    alias?: string;
    propNameHook?: Function;
    groupsMetaHook?: Function;
}) {
    return (target: object, propName: string, descriptor: PropertyDescriptor) => {
        let groupsMeta: G = Reflect.getOwnMetadata(metaKey, target.constructor);
        if (!groupsMeta) {
            groupsMeta = new metaClass(metaKey, target.constructor);
        }

        // Is a computed property (method decorator)
        if (descriptor) {
            propName = COMPUTED_PREFIX + propName + (alias ? ALIAS_PREFIX + alias : "");
        }

        if (propNameHook) {
            propName = propNameHook(propName);
        }

        if (Array.isArray(groups)) {
            groupsMeta.addPropToGlobalGroups(groups, propName);
        } else if (groups === "all") {
            groupsMeta.addPropToGlobalGroups(ALL_OPERATIONS, propName);
        } else {
            groupsMeta.addPropToRoutesGroups(groups, propName);
        }

        if (groupsMetaHook) {
            groupsMeta = groupsMetaHook(groupsMeta);
        }

        Reflect.defineMetadata(metaKey, groupsMeta, target.constructor);
    };
}

export type Operation = "create" | "list" | "details" | "update" | "delete";

// Types only used as params for @Groups decorator
export type GroupsOperation = "create" | "list" | "details" | "update";
export type GroupsOperationOrAll = GroupsOperation[] | "all";
export type RouteOperations = Record<string, GroupsOperationOrAll>;

/** An object with Operation as keys and an array of entity props as values  */
export type OperationGroups<PropNameType = string> = PartialRecord<Operation, PropNameType[]>;

/**
 * An object containing many routeContext (keys) associated to OperationsGroups (values)
 * A route context key is the tableName of the EntityRoute (/users => user, /pictures => picture).
 */
export type ContextOperations<PropName = string> = Record<string, OperationGroups<PropName>>;

export const ALL_OPERATIONS: GroupsOperation[] = ["create", "list", "details", "update"];
export const COMPUTED_PREFIX = "_COMPUTED_";
export const ALIAS_PREFIX = "_ALIAS_";
