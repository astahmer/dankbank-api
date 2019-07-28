import { Context } from "koa";
import { ObjectType } from "typeorm";

import { AbstractEntity } from "@/entity/AbstractEntity";

export type NextFn = () => Promise<any>;
export type Middleware = (ctx: Context, next?: NextFn) => Promise<any>;
export type PartialRecord<K extends keyof any, T> = Partial<Record<K, T>>;
export type Entity<T extends AbstractEntity> = ObjectType<T>;
