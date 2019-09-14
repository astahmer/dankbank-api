import "reflect-metadata";

import * as Koa from "koa";
import * as bodyParser from "koa-bodyparser";
import { createConnection, Connection, getConnectionOptions } from "typeorm";
import { createKoaServer } from "routing-controllers";

import { TypeORMConfig } from "./ormconfig";
import { logRequest } from "@/middlewares";
import { logger } from "@/services/logger";

import { useImageUploadRoute } from "./services/EntityRoute/Actions/ImageUploadAction";
import { useCustomRoute } from "@/actions/CustomAction";
import { useGroupsRoute } from "@/actions/GroupsAction";

import { useEntitiesRoutes } from "@/services/EntityRoute";
import { getAppRoutes } from "@/utils/getAppRoutes";
import { makeFixtures } from "@/fixtures";
import { AbstractEntity } from "./entity/AbstractEntity";

declare const module: any;

init();

/** If there is an existing connection, close it and then restart app, else just start app */
function init() {
    if (module.hot && module.hot.data && module.hot.data.connection) {
        module.hot.data.connection.close().then(connectToDatabase);
    } else {
        connectToDatabase();
    }
}

/** Creates connection */
async function connectToDatabase() {
    const connectionOptions = await getConnectionOptions();
    createConnection({ ...connectionOptions, ...(TypeORMConfig as any), entities: getEntities() })
        .then(startApp)
        .catch((error) => {
            logger.error(error);
            setTimeout(connectToDatabase, 1000);
        });
}

async function startApp(connection: Connection) {
    logger.info("Starting Koa server...");
    const app: Koa = createKoaServer();
    app.use(bodyParser());
    app.use(logRequest(logger));

    await makeFixtures(connection);

    const entities = getEntities();
    useEntitiesRoutes(app, entities);

    useImageUploadRoute(connection, app);
    useCustomRoute(app);
    useGroupsRoute(connection, app);

    if (process.env.NODE_ENV === "development") {
        logger.info(getAppRoutes(app.middleware));
    }

    const server = app.listen(3000, "0.0.0.0");
    logger.info("Listening on port 3000");

    // TODO restart if not hot if .env.USE_HMR === true
    if (module.hot) {
        module.hot.accept();
        module.hot.dispose((data: any) => {
            data.connection = connection;
            server.close();
        });
    }
}

function getEntities(included?: string[]) {
    const context = require.context("./entity/", true, /\.ts$/);
    return context.keys().reduce((acc, path) => {
        const entityModule = context(path);
        const [entityName] = Object.keys(entityModule);

        if (entityModule[entityName] && entityModule[entityName].prototype instanceof AbstractEntity) {
            // Skip not explicitly included entities
            if (included && !included.includes(entityName)) {
                return acc;
            }

            acc.push(entityModule[entityName]);
        }

        return acc;
    }, []);
}

export const BASE_URL = "http://localhost:3000";
