import { Operation } from "../services/EntityRoute/types";

export const Groups = (operations: Operation[]): PropertyDecorator => {
    return (target: Object, propName: string) => {
        const groups = Reflect.getOwnMetadata("groups", target.constructor) || {};
        for (let i = 0; i < operations.length; i++) {
            if (!groups[operations[i]]) {
                groups[operations[i]] = [];
            }
            groups[operations[i]].push(propName);
        }

        Reflect.defineMetadata("groups", groups, target.constructor);
    };
};
