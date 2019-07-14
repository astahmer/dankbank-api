import "reflect-metadata";

import * as Koa from "koa";
import * as bodyParser from "koa-bodyparser";
import { createConnection } from "typeorm";
import { createKoaServer } from "routing-controllers";

import { logRequest } from "./middlewares";
import { logger } from "./services/Logger";

import { useCustomRoute } from "./controllers/CustomController";
import { useEntitiesRoutes } from "./services/EntityRoute";

import { getAppRoutes } from "./utils/getAppRoutes";
import { Category, Meme, Picture, Team, User } from "./entity";
import { makeFixtures } from "./fixtures";

createConnection()
    .then(async (connection) => {
        const app: Koa = createKoaServer();
        app.use(bodyParser());
        app.use(logRequest(logger));

        makeFixtures(connection);
        useEntitiesRoutes(connection, app, [Category, Meme, Picture, Team, User], { isMaxDepthEnabledByDefault: true });
        useCustomRoute(connection, app);

        if (process.env.NODE_ENV === "development") {
            logger.info(getAppRoutes(app.middleware));
        }

        app.listen(3000);
    })
    .catch((error) => console.log(error));
