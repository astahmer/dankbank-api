import "reflect-metadata";

import * as Koa from "koa";
import * as bodyParser from "koa-bodyparser";
import { createConnection } from "typeorm";
import { createKoaServer } from "routing-controllers";

import { logRequest } from "./middlewares";
import { useEntitiesRoutes } from "./services/EntityRoute";
import { logger } from "./services/Logger";
import { getAppRoutes } from "./utils/getAppRoutes";
import { User } from "./entity/User";

createConnection()
    .then(async (connection) => {
        const app: Koa = createKoaServer();
        app.use(bodyParser());
        app.use(logRequest(logger));

        useEntitiesRoutes(connection, app, [User]);

        if (process.env.NODE_ENV === "development") {
            logger.info(getAppRoutes(app.middleware));
        }

        app.listen(3000);
    })
    .catch((error) => console.log(error));
