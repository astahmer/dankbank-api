import * as Koa from "koa";
import * as Router from "koa-router";
import * as bodyParser from "koa-bodyparser";
import * as session from "koa-session";

// TODO Remove all require()

import { getMetadataStorage } from "class-validator";
import { Container } from "typedi";
import { Connection, createConnection, getConnectionOptions } from "typeorm";

import { useAuthRoutes } from "./actions/Authentication";
import { useCustomRoute } from "./actions/CustomAction";
import { useGroupsRoute } from "./actions/GroupsAction";
import { AbstractEntity } from "./entity/AbstractEntity";
import { makeFixtures } from "./fixtures";
import { logRequest } from "./middlewares";
import { adaptRowsToDocuments, ElasticSearchManager } from "./services/ElasticSearch/ESManager";
import { logger } from "./services/logger";
import { getAppRoutes } from "./utils/getAppRoutes";
import { useEntitiesRoutes } from "@astahmer/entity-routes/";
import { config } from "./ormconfig";

/** Creates connection and returns it */
export async function createConnectionToDatabase() {
    const connectionOptions = await getConnectionOptions();

    const options = {
        ...connectionOptions,
        ...(config as any),
        entities: getEntities(),
        subscribers: getSubscribers(),
    };

    return createConnection(options);
}

/** Make app & listen on given port & return it */
export async function makeApp(connection: Connection) {
    const app = new Koa();
    logger.info("Starting; Koa server...");

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

    app.use(useRouteListAtIndex(app).routes());
    app.use(useCustomRoute().routes());
    app.use(useGroupsRoute().routes());
    app.use(useAuthRoutes().routes());

    const entities = getEntities();
    useEntitiesRoutes({ app, connections: [connection], entities });

    // Always validate when no groups are passed on validators
    entities.forEach(setEntityValidatorsDefaultOption);

    const port = parseInt(process.env.PORT);
    const server = app.listen(port, "0.0.0.0");
    logger.info("Listening on port " + port);
    logger.info("Server up on " + process.env.API_URL);

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

function useRouteListAtIndex(app: Koa) {
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
