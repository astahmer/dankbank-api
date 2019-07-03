import { Context } from "koa";

export type NextFn = () => Promise<any>;
export type Middleware = (ctx: Context, next?: NextFn) => Promise<any>;
