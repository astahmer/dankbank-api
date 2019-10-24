import { EntityMetadata } from "typeorm";

import { getRouteMetadata } from "./EntityRoute";

export const isDev = () => process.env.NODE_ENV === "development";
export const lowerFirstLetter = (str: string) => str.charAt(0).toLowerCase() + str.slice(1);

export const sortObjectByKeys = (obj: any) =>
    Object.keys(obj)
        .sort()
        .reduce((acc, key) => ((acc[key] = obj[key]), acc), {} as any);

export const isType = <T>(_value: any, condition?: boolean): _value is T => condition;

export const getObjectOnlyKey = (obj: object) => Object.keys(obj)[0];
export const isDefined = (value: any) =>
    value !== undefined && value !== null && (typeof value === "string" ? value.trim() !== "" : true);

export const snakeToCamel = (str: string) => str.replace(/(_\w)/g, (group) => group[1].toUpperCase());
export const camelToSnake = (str: string) =>
    str.replace(/[\w]([A-Z])/g, (group) => group[0] + "_" + group[1]).toLowerCase();

export const setNestedKey = (obj: Record<string, any>, path: string[], value: any): Record<string, any> => {
    if (path.length === 1) {
        obj[path[0]] = value;
        return value;
    } else if (!(path[0] in obj)) {
        obj[path[0]] = {};
    }

    return setNestedKey(obj[path[0]], path.slice(1), value);
};

export const truthyRegex = /^(true|1)$/i;
export const falsyRegex = /^(false|0)$/i;
export function parseStringAsBoolean(str: string) {
    if (truthyRegex.test(str)) {
        return true;
    } else if (falsyRegex.test(str)) {
        return false;
    }

    return null;
}

export function idToIRI(entityMeta: EntityMetadata, id: number) {
    const routeMetadata = getRouteMetadata(entityMeta.target as Function);
    return routeMetadata && "/api" + routeMetadata.path + "/" + id;
}
export const iriToID = (iri: string) => parseInt(iri.split("/")[3]);
export const formatEntityId = (id: string) => (parseInt(id) ? parseInt(id) : iriToID(id));

export const getUnixTimestampFromDate = (date: Date) => Math.round(+date / 1000);
export const chunk = <T = any>(arr: T[], size: number): T[] =>
    arr.reduce((chunks, el, i) => (i % size ? chunks[chunks.length - 1].push(el) : chunks.push([el])) && chunks, []);

export const limit = (nb: number, [min, max]: [number, number]) => {
    return Math.min(Math.max(nb, min), max);
};
