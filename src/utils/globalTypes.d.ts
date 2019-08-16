import { Context } from "koa";
import { ObjectType } from "typeorm";

import { AbstractEntity } from "@/entity/AbstractEntity";

export type NextFn = () => Promise<any>;
export type Middleware = (ctx: Context, next?: NextFn) => Promise<any>;
export type PartialRecord<K extends keyof any, T> = Partial<Record<K, T>>;
export type Entity<T extends AbstractEntity> = ObjectType<T>;
export type EntityProps<T extends AbstractEntity> = NonFunctionKeys<Entity<T>>;

// https://github.com/piotrwitek/utility-types#nonfunctionkeyst
export type NonUndefined<A> = A extends undefined ? never : A;
export type NonFunctionKeys<T extends object> = {
    [K in keyof T]-?: NonUndefined<T[K]> extends Function ? never : K;
}[keyof T];
