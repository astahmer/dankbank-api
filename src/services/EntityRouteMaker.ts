import * as Router from "koa-router";
import { Repository, getRepository, ObjectType } from "typeorm";
import { Context } from "koa";
// import { hasPath } from "ramda";

import { Operations } from "../decorators/EntityRoute";
import { NextFn } from "../utils/globalTypes";

const OPERATIONS_ROUTES = {
    create: {
        path: "/:id",
        verb: "post",
    },
    list: {
        path: "",
        verb: "get",
        method: (repository: Repository<any>, entityName: string, props: any[]) => {
            // return repository.findAndCount();
            return repository
                .createQueryBuilder(entityName)
                .select(props)
                .getManyAndCount();
        },
    },
    details: {
        path: "/:id",
        verb: "get",
    },
    update: {
        path: "/:id",
        verb: "put",
    },
    delete: {
        path: "/:id",
        verb: "remove",
    },
};

interface IEntityRouteMakerParams<T> {
    entity: ObjectType<T>;
    route: IEntityRouteParams;
    groups: any[];
}

interface IEntityRouteParams {
    path: string;
    operations: Operations[];
}

interface IEntityRouteVerb<T> {
    path: string;
    verb: string;
    method?: (repository: Repository<T>, entityName: string, props: any[]) => Promise<any>;
}

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

const getMetaDataProps = (props: string[], entity: ObjectType<any>) => {
    const metadata: any = {};
    for (let i = 0; i < props.length; i++) {
        metadata[props[i]] = Reflect.getMetadata(props[i], entity);
    }
    return metadata;
};

export function useEntitiesRoutes(app: any, entities: ObjectType<any>[]) {
    let router;
    for (let i = 0; i < entities.length; i++) {
        router = makeEntityRouter(getMetaDataProps(["entity", "route", "groups"], entities[i]));
        app.use(router.routes());
    }
}
