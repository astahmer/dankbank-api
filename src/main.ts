require("dotenv").config();
import "reflect-metadata";

import Koa = require("koa");
import { getConnectionToDatabase, makeApp } from "./app";
import { logger } from "./services/logger";
import { Connection } from "typeorm";

export const BASE_URL = `http://api.${process.env.PROJECT_NAME}.lol`;
export const isDev = process.env.NODE_ENV !== "production";

declare const module: any;

export const app = new Koa();
init();

/** If there is an existing connection, close it and then restart app, else just start app */
async function init() {
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
        module.hot.accept();
        module.hot.dispose((data: any) => {
            data.connection = connection;
            server.close();
        });
    }
}
