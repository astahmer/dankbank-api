import Router = require("koa-router");
import bodyParser = require("koa-bodyparser");
import session = require("koa-session");

import { useContainer as validatorUseContainer, getMetadataStorage } from "class-validator";
import { Container } from "typedi";
import { Connection, createConnection, getConnectionOptions, useContainer as typeOrmUseContainer } from "typeorm";

import { useAuthRoutes } from "./actions/Authentication";
import { useCustomRoute } from "./actions/CustomAction";
import { useGroupsRoute } from "./actions/GroupsAction";
import { AbstractEntity } from "./entity/AbstractEntity";
import { makeFixtures } from "./fixtures";
import { app, BASE_URL } from "./main";
import { logRequest } from "./middlewares";
import { TypeORMConfig } from "./ormconfig";
import { adaptRowsToDocuments, ElasticSearchManager } from "./services/ElasticSearch/ESManager";
import { useEntitiesRoutes } from "./services/EntityRoute";
import { logger } from "./services/logger";
import { getAppRoutes } from "./utils/getAppRoutes";

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

    const esManager = Container.get(ElasticSearchManager);
    await esManager.waitForConnection();
    logger.info("Connection with ElasticSearch successful");

    if (process.env.MAKE_FIXTURES === "true") {
        await makeFixtures(connection);
    }

    if (process.env.ADAPT_ROWS === "true") {
        await adaptRowsToDocuments();
    }

    app.keys = [process.env.SESSION_KEY];
    app.use(session(app));

    app.use(bodyParser());
    app.use(logRequest(logger));

    app.use(useRouteListAtIndex().routes());
    app.use(useCustomRoute().routes());
    app.use(useGroupsRoute().routes());
    app.use(useAuthRoutes().routes());

    const entities = getEntities();
    useEntitiesRoutes(app, entities);

    // Always validate when no groups are passed on validators
    entities.forEach(setEntityValidatorsDefaultOption);

    const port = parseInt(process.env.PORT);
    const server = app.listen(port, "0.0.0.0");
    logger.info("Listening on port " + port);
    logger.info("Server up on " + BASE_URL);

    return server;
}

export function getEntities(included?: string[]): Function[] {
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

function useRouteListAtIndex() {
    const router = new Router();
    const filterRoutes = (routers: ReturnType<typeof getAppRoutes>, filter: string) =>
        routers.map((routes) => routes.filter((item) => item.path.includes(filter))).filter((routes) => routes.length);

    router.get("/", (ctx) => {
        const filter = ctx.query.filter;
        const entrypoints = getAppRoutes(app.middleware);
        const routers = filter ? filterRoutes(entrypoints, filter) : entrypoints;
        ctx.body = routers.map((router) => router.map((entrypoint) => entrypoint.desc));
    });
    return router;
}

/** Set "always" validator option to true when no groups are passed to validation decorators */
function setEntityValidatorsDefaultOption(entity: Function) {
    const validationMetaStorage = getMetadataStorage();
    const metadatas = validationMetaStorage.getTargetValidationMetadatas(entity, entity.name);

    let i = 0;
    for (i; i < metadatas.length; i++) {
        if (!metadatas[i].groups || !metadatas[i].groups?.length) {
            metadatas[i].always = true;
        }
    }
}
