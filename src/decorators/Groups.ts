import { Operation } from "../services/EntityRoute/types";

type GroupsParams = {
    [entityRoute: string]: Operation[];
};

export type OperationGroups = {
    [K in Operation]?: string[];
};

export type RouteGroups = {
    [entityRoute: string]: OperationGroups;
};

export type GroupsMeta = {
    routes?: RouteGroups;
    all?: OperationGroups;
};

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
        const groupsMeta: GroupsMeta = Reflect.getOwnMetadata("groups", target.constructor) || {};

        if (Array.isArray(groups)) {
            for (let i = 0; i < groups.length; i++) {
                if (!groupsMeta.all) {
                    groupsMeta.all = { [groups[i]]: [] };
                } else if (!groupsMeta.all[groups[i]]) {
                    groupsMeta.all[groups[i]] = [];
                }
                groupsMeta.all[groups[i]].push(propName);
            }
        } else {
            let route;
            for (route in groups) {
                let i = 0;
                for (i; i < groups[route].length; i++) {
                    if (!groupsMeta.routes) {
                        groupsMeta.routes = { [route]: {} };
                    } else if (!groupsMeta.routes[route]) {
                        groupsMeta.routes[route] = {};
                    }

                    if (!groupsMeta.routes[route][groups[route][i]]) {
                        groupsMeta.routes[route][groups[route][i]] = [];
                    }

                    groupsMeta.routes[route][groups[route][i]].push(propName);
                }
            }
        }

        Reflect.defineMetadata("groups", groupsMeta, target.constructor);
    };
}
