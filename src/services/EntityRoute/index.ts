import * as Koa from "koa";
import { Connection } from "typeorm";

import { makeEntityRouter } from "./makeEntityRouter";
import { IClassMetadatas } from "./types";

const getOwnMetaDataProps = (props: string[], entity: any) => {
    const metadata: any = {};
    for (let i = 0; i < props.length; i++) {
        metadata[props[i]] = Reflect.getOwnMetadata(props[i], entity);
    }
    console.log(metadata);
    return metadata;
};

export async function useEntitiesRoutes(connection: Connection, app: Koa, entities: object[]) {
    for (let i = 0; i < entities.length; i++) {
        const router = makeEntityRouter(getClassMetadatas(connection, entities[i]));
        app.use(router.routes());
    }
}

function getClassMetadatas(connection: Connection, entity: object): IClassMetadatas {
    return {
        connection,
        routeMetadatas: getOwnMetaDataProps(["entity", "route", "groups"], entity),
        entityMetadatas: connection.getMetadata("User"),
    };
}
