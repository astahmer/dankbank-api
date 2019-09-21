import Koa = require("koa");
import Router = require("koa-router");
import bodyParser = require("koa-bodyparser");

import { Container } from "typedi";
import { useContainer as validatorUseContainer } from "class-validator";
import { getConnectionOptions, Connection, createConnection, useContainer as typeOrmUseContainer } from "typeorm";
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

/** Creates connection and returns it */
export async function getConnectionToDatabase() {
    const connectionOptions = await getConnectionOptions();

    typeOrmUseContainer(Container);
    validatorUseContainer(Container);

    return createConnection({
        ...connectionOptions,
        ...(TypeORMConfig as any),
        entities: getEntities(),
        subscribers: getSubscribers(),
    });
}

/** Make app & listen on given port & return it */
export async function makeApp(connection: Connection) {
    logger.info("Starting Koa server...");

    app.use(bodyParser());
    app.use(logRequest(logger));

    if (process.env.MAKE_FIXTURES) {
        await makeFixtures(connection);
    }

    const entities = getEntities();
    useEntitiesRoutes(app, entities);

    useCustomRoute(app);
    useGroupsRoute(connection, app);
    useRouteListAtIndex(app);

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

export function getSubscribers() {
    const context = require.context("./subscribers/", true, /\.ts$/);
    return context.keys().reduce((acc, path) => {
        const entityModule = context(path);
        const [entityName] = Object.keys(entityModule);

        acc.push(entityModule[entityName]);

        return acc;
    }, []);
}

function useRouteListAtIndex(app: Koa) {
    const router = new Router();
    router.get("/", (ctx) => (ctx.body = getAppRoutes(app.middleware)));
    app.use(router.routes());
}
