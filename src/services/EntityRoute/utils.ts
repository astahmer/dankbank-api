export const lowerFirstLetter = (str: string) => str.charAt(0).toLowerCase() + str.slice(1);

export const computedPropRegex = /^(get|is|has).+/;

export const formatComputedProp = (computed: string) => {
    const regexResult = computed.match(computedPropRegex);
    if (regexResult) {
        return lowerFirstLetter(computed.replace(regexResult[1], ""));
    }

    throw new Error('A computed property should start with either "get", "is", or "has".');
};

export const sortObjectByKeys = (obj: any) =>
    Object.keys(obj)
        .sort()
        .reduce((acc, key) => ((acc[key] = obj[key]), acc), {} as any);
