import { Operation } from "./Groups";

export const EntityRoute = (path: string, operations: Operation[] = []): ClassDecorator => {
    return (target: object) => {
        Reflect.defineMetadata("route", { path, operations }, target);
    };
};

export type Operations = "create" | "list" | "details" | "update" | "delete";

export interface IRoute {
    path: string;
    operations: Operations[];
}
