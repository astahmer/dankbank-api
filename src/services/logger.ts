import * as pino from "pino";
import { isDev } from "@astahmer/entity-routes";

export const logger = pino({
    prettyPrint: isDev() && ({ colorize: true, translateTime: "yyyy-mm-dd HH:MM:ss", ignore: "pid,hostname" } as any),
});
