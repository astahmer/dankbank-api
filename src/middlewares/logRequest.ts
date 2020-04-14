import { NextFunction } from "connect";
import { Context } from "koa";
import { Logger } from "pino";

export function logRequest(logger: Logger) {
    return async (ctx: Context, next: NextFunction) => {
        const start = Date.now();
        const message = `[${ctx.status}] ${ctx.method} ${ctx.path}`;

        try {
            await next();
            const suffix = ` (${Date.now() - start}ms)`;

            if (ctx.status >= 400) {
                logger.error(message + suffix);
            } else {
                logger.info(message + suffix);
            }
        } catch (error) {
            const suffix = ` (${Date.now() - start}ms)`;
            logger.error(message + suffix + " " + error.message);
        }
    };
}
