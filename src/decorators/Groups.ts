import { Operations } from "./EntityRoute";

export interface IGroups {
    operations: Operations[];
    propName: string;
    propType: any;
}

export const Groups = (operations: Operations[]): PropertyDecorator => {
    return (target, propName: string): void => {
        /*
        if (!Reflect.hasMetadata("groups", target.constructor)) {
            Reflect.defineMetadata("groups", [], target.constructor);
        }

        const groups = Reflect.getMetadata("groups", target.constructor) as IGroups[];
        const propType = Reflect.getMetadata("design:type", target, propName);
        groups.push({ operations, propName, propType });
        */
        if (!Reflect.hasMetadata("groups", target.constructor)) {
            Reflect.defineMetadata("groups", {}, target.constructor);
        }

        const groups = Reflect.getMetadata("groups", target.constructor);
        for (let i = 0; i < operations.length; i++) {
            if (!groups[operations[i]]) {
                groups[operations[i]] = [];
            }
            groups[operations[i]].push(propName);
        }

        Reflect.defineMetadata("groups", groups, target.constructor);
    };
};
