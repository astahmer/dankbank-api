import { Context } from "koa";
import { EntityMetadata } from "typeorm";

import { AbstractEntity } from "@/entity";
import { EntityRoute, RouteMetadata } from "../EntityRoute";

export type RouteActionContext<Entity extends AbstractEntity> = {
    entityRoute?: EntityRoute<Entity>;
    routeMetadata?: RouteMetadata;
    entityMetadata?: EntityMetadata;
};

export interface RouteAction<Entity extends AbstractEntity = null> {
    onRequest(ctx: Context, routeContext?: RouteActionContext<Entity>): any | Promise<any>;
}
