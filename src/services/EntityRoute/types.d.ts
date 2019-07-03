import * as Router from "koa-router";
import { Repository, ObjectType, EntityMetadata, Connection } from "typeorm";

export interface IOperationRouteItemParams {
    repository: Repository<any>;
    tableName: string;
    entityMetadatas?: EntityMetadata;
    selectProps?: string[];
    selectData?: ISelectData;
    entityId?: number;
    values?: any;
    relations?: any[];
}

export interface IOperationRouteItem {
    path: string;
    verb: string;
    method: (params: IOperationRouteItemParams) => Promise<any>;
}

export interface IOperationsRoutes {
    [verb: string]: IOperationRouteItem;
}

export type Operation = "create" | "list" | "details" | "update" | "delete";

export interface IEntityRouteParams {
    path: string;
    operations: Operation[];
}

export type EntityRouteGroups = {
    [group in Operation]: string[];
};

export interface IEntityRouteMetadatas {
    entity: ObjectType<any>;
    route: IEntityRouteParams;
    groups: EntityRouteGroups;
}

export interface IClassMetadatas {
    connection: Connection;
    routeMetadatas: IEntityRouteMetadatas;
    entityMetadatas: EntityMetadata;
}

export interface IMapGroupsToSelectArgs {
    connection: Connection;
    operation: Operation;
    groups: EntityRouteGroups;
    entityMetadatas: EntityMetadata;
    relationName?: string;
}

export interface IRelationProp {
    target: EntityMetadata["target"];
    propertyName: string;
}

export interface ISelectData {
    relations?: IRelationProp[];
    selectProps: string[];
}
