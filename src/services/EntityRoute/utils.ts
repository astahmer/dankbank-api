import { COMPUTED_PREFIX, ALIAS_PREFIX } from "@/decorators/Groups";

export const lowerFirstLetter = (str: string) => str.charAt(0).toLowerCase() + str.slice(1);

export const computedPropRegex = /^(get|is|has).+/;

/**
 * Returns a formatted version of the method name
 *
 * @param computed actual method name
 */
export const makeComputedPropNameFromMethod = (computed: string) => {
    const regexResult = computed.match(computedPropRegex);
    if (regexResult) {
        return lowerFirstLetter(computed.replace(regexResult[1], ""));
    }

    throw new Error('A computed property method should start with either "get", "is", or "has".');
};

/**
 * Returns actual method name without prefixes & computed prop alias for the response
 *
 * @param computed method name prefixed with COMPUTED_PREFIX & ALIAS_PREFIX/alias if there is one
 */
export const getComputedPropMethodAndKey = (computed: string) => {
    const computedPropMethod = computed.replace(COMPUTED_PREFIX, "").split(ALIAS_PREFIX)[0];
    const alias = computed.split(ALIAS_PREFIX)[1];
    const propKey = alias || makeComputedPropNameFromMethod(computedPropMethod);
    return { computedPropMethod, propKey };
};

export const sortObjectByKeys = (obj: any) =>
    Object.keys(obj)
        .sort()
        .reduce((acc, key) => ((acc[key] = obj[key]), acc), {} as any);

export const isPrimitive = (value: any) => {
    if (typeof value === "object") {
        return value === null;
    }
    return typeof value !== "function";
};

export const getObjectOnlyKey = (obj: Object) => Object.keys(obj)[0];

export const isDefined = (value: any) =>
    value !== undefined && value !== null && (typeof value === "string" ? value.trim() !== "" : true);
