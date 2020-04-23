require("dotenv").config();
import "reflect-metadata";

import { getMetadataStorage } from "class-validator";
import { Connection } from "typeorm";
import { Server } from "http";

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
    if (module?.hot?.data?.connection) {
        module.hot.data.connection.close().then(startServer);
    } else {
        startServer();
    }
}

let connection: Connection;
let server: Server;

async function startServer() {
    try {
        connection = await getConnectionToDatabase();
    } catch (error) {
        logger.error(error);
        setTimeout(startServer, 1000);
    }

    try {
        server = await makeApp(connection);
    } catch (error) {
        logger.error(error);
    }

    if (module.hot) {
        module.hot.accept((e: any) => {
            logger.error(e);
            server?.close();
            startServer();
        });
        module.hot.dispose((data: any) => {
            // On HMR we have to reset metadata storage else there will be duplicates appended on each reload
            // const validationMetaStorage = getMetadataStorage();
            // (validationMetaStorage as any).validationMetadatas = [];
            // (validationMetaStorage as any).constraintMetadatas = [];

            // Passing existing connection as data to restart it
            data.connection = connection;
            server?.close();
        });
    }
}
