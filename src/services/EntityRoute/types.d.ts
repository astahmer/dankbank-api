import * as Router from "koa-router";
import { Repository, ObjectType, EntityMetadata, Connection } from "typeorm";
import { AbstractEntity } from "../../entity/AbstractEntity";
import { EntityRouter } from "./EntityRoute";

export type Entity<T extends AbstractEntity> = ObjectType<T>;

export interface IActionParams {
    operation: Operation;
    exposedProps: string[];
    entityId?: number;
    isUpserting?: boolean;
    values?: any;
}

export type ActionMethod = "create" | "getList" | "getDetails" | "update" | "delete";

export interface IAction {
    path: string;
    verb: string;
    method: ActionMethod;
}

export type RouteActions = {
    [K in Operation]: IAction;
};
export type Operation = "create" | "list" | "details" | "update" | "delete";

export interface IRouteMetadatas {
    path: string;
    operations: Operation[];
}

export type EntityRouteGroups = {
    [group in Operation]: string[];
};

export interface IMappingItem {
    metadata?: EntityMetadata;
    mapping: IMapping;
    exposedProps?: any;
    relationProps?: any;
}

export interface IMapping {
    [tableName: string]: IMappingItem;
}

export interface IMaxDeptMetas {
    [tableName: string]: IMaxDeptMetasItem;
}

export interface IMaxDeptMetasItem {
    enabled?: EntityMetadata;
    fields: {
        [propName: string]: number;
    };
}
