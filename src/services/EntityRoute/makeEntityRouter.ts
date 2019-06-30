import * as Router from "koa-router";
import { getRepository } from "typeorm";
import { Context } from "koa";

import { NextFn } from "../../utils/globalTypes";
import { IEntityRouteMakerParams, IEntityRouteVerb } from "./types";
import { OPERATIONS_ROUTES } from "./operationsRoutes";

export function makeEntityRouter<T>({ entity, route, groups }: IEntityRouteMakerParams<T>) {
    console.log(groups);
    const router = new Router();
    const repository = getRepository(entity);

    let op: IEntityRouteVerb<T>, verb, path, select, responseMethod, entityName: string, props: any;
    for (let i = 0; i < route.operations.length; i++) {
        op = OPERATIONS_ROUTES[route.operations[i]];
        verb = op.verb;
        path = route.path + op.path;
        console.log(op, path, verb);
        entityName = entity.name.toLowerCase();
        props = (<any>groups)[route.operations[i]].map((v: string) => entityName + "." + v);

        responseMethod = async (ctx: Context, next: NextFn) => {
            const result = await op.method(repository, entityName, props);
            console.log(result);
            ctx.body = {
                operation: route.operations[i],
                entity: entity.name,
                items: result[0],
                totalItems: result[1],
                mapping: null,
            };
            next();
        };

        (<any>router)[verb](path, responseMethod);
    }

    return router;
}
