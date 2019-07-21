import * as Router from "koa-router";
import { Repository, ObjectType, EntityMetadata, Connection } from "typeorm";
import { AbstractEntity } from "../../entity/AbstractEntity";
import { EntityRouter } from "./EntityRoute";
import { GroupsMetadata } from "./GroupsMetadata";
import { type } from "os";

export type Entity<T extends AbstractEntity> = ObjectType<T>;

export interface IActionParams {
    operation: Operation;
    exposedProps?: string[];
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

export type RouteActions = { [K in Operation]: IAction };
export type Operation = "create" | "list" | "details" | "update" | "delete";

export interface IEntityRouteOptions {
    isMaxDepthEnabledByDefault: boolean;
}

export interface IRouteMetadatas {
    path: string;
    operations: Operation[];
}

export type EntityRouteGroups = { [group in Operation]: string[] };
export type GroupsMetaByRoutes<G extends GroupsMetadata> = { [routeName: string]: G };

export interface IMappingItem {
    metadata?: EntityMetadata;
    mapping: Mapping;
    exposedProps?: any;
    selectProps?: any;
    relationProps?: any;
}

export type Mapping = { [tableName: string]: IMappingItem };

export type IMaxDeptMetas = { [tableName: string]: IMaxDeptMetasItem };
export interface IMaxDeptMetasItem {
    enabled?: EntityMetadata;
    fields: {
        [propName: string]: number;
    };
}
