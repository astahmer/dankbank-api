export const EntityRoute = (path: string, operations: Operations[]): ClassDecorator => {
    return (target: any) => {
        const route: IRoute = { path, operations };
        Reflect.defineMetadata("route", route, target);
        Reflect.defineMetadata("entity", target, target);
    };
};

export type Operations = "create" | "list" | "details" | "update" | "delete";

export interface IRoute {
    path: string;
    operations: Operations[];
}
