import { Operation } from "./Groups";

export const EntityRoute = (path: string, operations: Operation[] = [], options?: {}): ClassDecorator => {
    return (target: object) => {
        Reflect.defineMetadata("route", { path, operations, options }, target);
    };
};

export type Operations = "create" | "list" | "details" | "update" | "delete";

export interface IRoute {
    path: string;
    operations: Operations[];
}
