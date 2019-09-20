import bodyParser = require("koa-bodyparser");

import { getConnectionOptions, Connection, createConnection } from "typeorm";
import { TypeORMConfig } from "./ormconfig";

import { logger } from "./services/logger";
import { logRequest } from "./middlewares";

import { makeFixtures } from "./fixtures";
import { useEntitiesRoutes } from "./services/EntityRoute";
import { useCustomRoute } from "./actions/CustomAction";
import { useGroupsRoute } from "./actions/GroupsAction";

import { BASE_URL, app } from "./main";
import { getAppRoutes } from "./utils/getAppRoutes";
import { AbstractEntity } from "./entity/AbstractEntity";

/** Creates connection */
export async function getConnectionToDatabase() {
    const connectionOptions = await getConnectionOptions();
    return createConnection({ ...connectionOptions, ...(TypeORMConfig as any), entities: getEntities() });
}

export async function makeApp(connection: Connection) {
    logger.info("Starting Koa server...");

    app.use(bodyParser());
    app.use(logRequest(logger));

    await makeFixtures(connection);

    const entities = getEntities();
    useEntitiesRoutes(app, entities);

    useCustomRoute(app);
    useGroupsRoute(connection, app);

    if (process.env.NODE_ENV === "development") {
        logger.info(getAppRoutes(app.middleware));
    }

    const server = app.listen(3000, "0.0.0.0");
    logger.info("Listening on port 3000");
    logger.info("Server up on " + BASE_URL);

    return server;
}

export function getEntities(included?: string[]) {
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
