import { Operation } from "../services/EntityRoute/types";

export const Groups = (operations: Operation[]) => {
    return (target: Object, propName: string) => {
        if (!Reflect.hasOwnMetadata("groups", target.constructor)) {
            Reflect.defineMetadata("groups", {}, target.constructor);
        }

        const groups = Reflect.getOwnMetadata("groups", target.constructor);
        for (let i = 0; i < operations.length; i++) {
            if (!groups[operations[i]]) {
                groups[operations[i]] = [];
            }
            groups[operations[i]].push(propName);
        }

        Reflect.defineMetadata("groups", groups, target.constructor);
    };
};
