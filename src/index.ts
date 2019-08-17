require("module-alias/register");
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
import { useGroupsRoute } from "./controllers/GroupsController";

createConnection()
    .then(async (connection) => {
        const app: Koa = createKoaServer();
        app.use(bodyParser());
        app.use(logRequest(logger));

        await makeFixtures(connection);
        useEntitiesRoutes(connection, app, [Category, Meme, Picture, Team, User]);
        useCustomRoute(connection, app);
        useGroupsRoute(connection, app);

        if (process.env.NODE_ENV === "development") {
            logger.info(getAppRoutes(app.middleware));
        }

        app.listen(3000);
        console.log("Listening on port 3000");
    })
    .catch((error) => console.log(error));
