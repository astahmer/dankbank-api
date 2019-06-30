import { Context } from "koa";
import { Logger } from "pino";
import { NextFn } from "../utils/globalTypes";

export function logRequest(logger: Logger) {
    return async (ctx: Context, next: NextFn) => {
        const start = Date.now();

        await next();

        const message = `[${ctx.status}] ${ctx.method} ${ctx.path} (${Date.now() - start}ms)`;

        if (ctx.status >= 400) {
            logger.error(message);
        } else {
            logger.info(message);
        }
    };
}
