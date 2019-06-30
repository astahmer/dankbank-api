import * as Router from "koa-router";
import { Repository, ObjectType } from "typeorm";
import { Operations } from "../../decorators/EntityRoute";

export interface IOperationRouteItem {
    path: string;
    verb: string;
    method: (repository: Repository<any>, entityName: string, props: any[]) => Promise<[any[], number]>;
}

export interface IOperationsRoutes {
    [verb: string]: IOperationRouteItem;
}

export interface IEntityRouteMakerParams<T> {
    entity: ObjectType<T>;
    route: IEntityRouteParams;
    groups: any[];
}

export interface IEntityRouteParams {
    path: string;
    operations: Operations[];
}

export interface IEntityRouteVerb<T> {
    path: string;
    verb: string;
    method?: (repository: Repository<T>, entityName: string, props: any[]) => Promise<any>;
}
