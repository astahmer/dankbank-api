import { AbstractEntity } from "@/entity/AbstractEntity";

import Application = require("koa");
import session = require("koa-session");

declare global {
    type PartialRecord<K extends keyof any, T> = Partial<Record<K, T>>;
}
export type Props<T extends AbstractEntity> = NonFunctionKeys<T>;

// https://github.com/piotrwitek/utility-types#nonfunctionkeyst
export type NonUndefined<A> = A extends undefined ? never : A;
export type NonFunctionKeys<T extends object> = {
    [K in keyof T]-?: NonUndefined<T[K]> extends Function ? never : K;
}[keyof T];
export type FunctionKeys<T extends object> = Exclude<keyof T, NonFunctionKeys<T>>;

export type ObjectKeys<T extends object> = {
    [K in keyof T]: T[K] extends object ? (T[K] extends Function ? never : T[K] extends Date ? never : K) : never;
}[keyof T];

export type EntityKeys<T extends AbstractEntity> = {
    [K in keyof T]: T[K] extends AbstractEntity ? K : never;
}[keyof T];
