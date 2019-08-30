require("module-alias/register");
import "reflect-metadata";

import * as Koa from "koa";
import * as bodyParser from "koa-bodyparser";
import { createConnection, Connection } from "typeorm";
import { createKoaServer } from "routing-controllers";

import { TypeORMConfig } from "./ormconfig";
import { logRequest } from "@/middlewares";
import { logger } from "@/services/Logger";

import { useCustomRoute } from "@/controllers/CustomController";
import { useEntitiesRoutes } from "@/services/EntityRoute";

import { getAppRoutes } from "@/utils/getAppRoutes";
import { makeFixtures } from "@/fixtures";
import { useGroupsRoute } from "@/controllers/GroupsController";

declare const module: any;

if (module.hot && module.hot.data && module.hot.data.connection) {
    module.hot.data.connection.close().then(startApp);
} else {
    startApp();
}

function startApp() {
    createConnection({ ...(TypeORMConfig as any), entities: getEntities() })
        .then(onConnected)
        .catch((error) => console.log(error));
}

async function onConnected(connection: Connection) {
    const app: Koa = createKoaServer();
    app.use(bodyParser());
    app.use(logRequest(logger));

    await makeFixtures(connection);

    const entities = getEntities();
    useEntitiesRoutes(app, entities);
    useCustomRoute(connection, app);
    useGroupsRoute(connection, app);

    if (process.env.NODE_ENV === "development") {
        logger.info(getAppRoutes(app.middleware));
    }

    const server = app.listen(3000);
    console.log("Listening on port 3000");

    if (module.hot) {
        module.hot.accept();
        module.hot.dispose((data: any) => {
            data.connection = connection;
            server.close();
        });
    }
}

function getEntities() {
    const context = require.context("./entity/", true, /\.ts$/);
    return context.keys().reduce((acc, path) => {
        const entityModule = context(path);
        if (path.includes("AbstractEntity") || path.includes("index")) {
            return acc;
        }

        const [entityName] = Object.keys(entityModule);
        acc.push(entityModule[entityName]);
        return acc;
    }, []);
}
