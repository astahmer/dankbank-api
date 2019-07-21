import { GroupsParams } from "./Groups";
import { Operation } from "../services/EntityRoute/types";
import { OnlyExposeIdGroupsMetadata } from "../services/EntityRoute/OnlyExposeIdGroupsMetadata";

/**
 * Only expose id of decorated property for each operation for each listed EntityRoute context
 * @param groups An object containing a list of every EntityRoute context
 * @param groups.route Contains an array of Operation in which the decorated property will be exposed
 */
export function OnlyExposeId(groups: GroupsParams): PropertyDecorator;

/**
 * Only expose id of decorated property for each operation listed (in any EntityContext, this list is global)
 * @param operations An array containing a list of operation in which the decorated property will be exposed
 *
 */
export function OnlyExposeId(operations: Operation[]): PropertyDecorator;

/**
 * Always only expose id of decorated property
 */
export function OnlyExposeId(): PropertyDecorator;

export function OnlyExposeId(groups?: Operation[] | GroupsParams): PropertyDecorator {
    return (target: Object, propName: string) => {
        const onlyExposeIdMeta =
            Reflect.getOwnMetadata("onlyExposeId", target.constructor) ||
            new OnlyExposeIdGroupsMetadata("onlyExposeId");

        if (!groups) {
            onlyExposeIdMeta.addPropAsAlwaysEnabled(propName);
        } else if (Array.isArray(groups)) {
            onlyExposeIdMeta.addPropToGlobalGroups(groups, propName);
        } else {
            onlyExposeIdMeta.addPropToRoutesGroups(groups, propName);
        }

        Reflect.defineMetadata("onlyExposeId", onlyExposeIdMeta, target.constructor);
    };
}
