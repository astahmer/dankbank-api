import * as Router from "koa-router";
import { Repository, ObjectType, EntityMetadata, Connection } from "typeorm";
import { AbstractEntity } from "../../entity/AbstractEntity";

export type Entity<T extends AbstractEntity> = ObjectType<T>;

export interface IOperationRouteItemParams {
    repository: Repository<any>;
    tableName: string;
    entityMetadata?: EntityMetadata;
    selectProps?: string[];
    selectData?: ISelectsData;
    exposedProps: any;
    entityId?: number;
    values?: any;
    relations?: any[];
    joins?: any;
}

export interface IOperationRouteItem {
    path: string;
    verb: string;
    method: (params: IOperationRouteItemParams) => Promise<any>;
}

export interface IOperationsRoutes {
    [verb: string]: IOperationRouteItem;
}

export interface IRouteAction {
    path: string;
    verb: string;
    method: (params: IOperationRouteItemParams) => Promise<any>;
}

export interface IRouteActions {
    [verb: string]: IOperationRouteItem;
}

export type Operation = "create" | "list" | "details" | "update" | "delete";

export interface IEntityRouteMetadatas {
    path: string;
    operations: Operation[];
}

export type EntityRouteGroups = {
    [group in Operation]: string[];
};

export interface IMapGroupsToSelectArgs {
    connection: Connection;
    operation: Operation;
    groups: EntityRouteGroups;
    entityMetadata: EntityMetadata;
    relationName?: string;
}

export interface IRelationProp {
    target: EntityMetadata["target"];
    propertyName: string;
}

export interface IRelationJoin {
    alias: string;
    propertyName: string;
    nestedRelations: IRelationJoin;
}

export interface ISelectsData {
    selects: string[];
    joins?: IRelationJoin[];
}

export interface IEntityRouteMapping {
    [tableName: string]: {
        metadata?: EntityMetadata;
        mapping: IEntityRouteMapping;
        exposedProps?: any;
        relationProps?: any;
    };
}
