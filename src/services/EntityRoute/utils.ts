export const lowerFirstLetter = (str: string) => str.charAt(0).toLowerCase() + str.slice(1);

export const sortObjectByKeys = (obj: any) =>
    Object.keys(obj)
        .sort()
        .reduce((acc, key) => ((acc[key] = obj[key]), acc), {} as any);

export const isType = <T>(_value: any, condition?: boolean): _value is T => condition;

export const isPrimitive = (value: any) => {
    if (typeof value === "object") {
        return value === null;
    }
    return typeof value !== "function";
};

export const isObject = (item: any) => item && typeof item === "object" && !Array.isArray(item);
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

export type PropertyHook = ({ item, key: parentProperty, prop: object, currentPath, index }: PropertyHookArgs) => any;

export type PropertyHookArgs = { parentProperty: string } & Omit<RecursiveBrowseArgs, "propHook">;
export type RecursiveBrowseArgs = {
    item: any;
    key?: string;
    prop: any;
    propHook: PropertyHook;
    currentPath: string[];
    index?: number;
};
export function recursiveBrowse({
    item,
    key: parentProperty,
    currentPath,
    index,
    prop,
    propHook,
}: RecursiveBrowseArgs) {
    if (parentProperty) {
        if (parentProperty) {
            currentPath.push(parentProperty);
        }
    }

    for (let key in prop) {
        if (Array.isArray(prop[key])) {
            propHook({ item, key, parentProperty, currentPath, prop: prop[key] });

            prop[key].forEach((element: any, index: number) => {
                propHook({ item, key, parentProperty, index, currentPath, prop: element });
                recursiveBrowse({ item, key, index, currentPath, prop: element, propHook });
            });
        } else if (typeof prop[key] === "object") {
            propHook({ item, key, parentProperty, index, currentPath, prop: prop[key] });
            recursiveBrowse({ item, key, currentPath, prop: prop[key], propHook });
        } else if (isPrimitive(prop[key])) {
            propHook({ item, key, parentProperty, index, currentPath, prop: prop[key] });
        }
    }
}

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
