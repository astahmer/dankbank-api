import { Operation } from "../services/EntityRoute/types";
// import { union, mergeWith } from "ramda";

export const EntityRoute = (path: string, operations: Operation[]): ClassDecorator => {
    return (target: object) => {
        Reflect.defineMetadata("route", { path, operations }, target);
        Reflect.defineMetadata("entity", target, target);
    };
};

export type Operations = "create" | "list" | "details" | "update" | "delete";

export interface IRoute {
    path: string;
    operations: Operations[];
}
