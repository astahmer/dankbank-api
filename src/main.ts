require("dotenv").config();
import "reflect-metadata";

import { Connection } from "typeorm";

import { getConnectionToDatabase, makeApp } from "./app";
import { logger } from "./services/logger";

import Koa = require("koa");
export const BASE_URL = process.env.API_URL;
export const isDev = process.env.NODE_ENV !== "production";

declare const module: any;

export const app = new Koa();
init();

/** If there is an existing connection, close it and then restart app, else just start app */
function init() {
    if (module.hot && module.hot.data && module.hot.data.connection) {
        module.hot.data.connection.close().then(startServer);
    } else {
        startServer();
    }
}

async function startServer() {
    let connection: Connection;
    try {
        connection = await getConnectionToDatabase();
    } catch (error) {
        logger.error(error);
        setTimeout(startServer, 1000);
    }

    const server = await makeApp(connection);
    if (module.hot) {
        module.hot.accept((e: any) => {
            logger.error(e);
            server.close();
            startServer();
        });
        module.hot.dispose((data: any) => {
            data.connection = connection;
            server.close();
        });
    }
}
