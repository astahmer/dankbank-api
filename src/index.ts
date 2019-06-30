import "reflect-metadata";

import { createConnection } from "typeorm";
import { createKoaServer } from "routing-controllers";

import { User } from "./entity/User";
import { logRequest } from "./middlewares";
import { useEntitiesRoutes } from "./services/EntityRoute";
import { getAppRoutes } from "./utils/getAppRoutes";
import { logger } from "./services/Logger";

createConnection()
    .then(async (connection) => {
        connection;

        const app = createKoaServer();
        app.use(logRequest(logger));

        useEntitiesRoutes(app, [User]);

        if (process.env.NODE_ENV === "development") {
            logger.info(getAppRoutes(app.middleware));
        }

        app.listen(3000);
    })
    .catch((error) => console.log(error));
