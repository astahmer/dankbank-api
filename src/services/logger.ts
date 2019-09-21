import * as pino from "pino";

export const logger = pino({
    prettyPrint: { colorize: true, translateTime: "yyyy-mm-dd HH:MM:ss", ignore: "pid,hostname" },
});
