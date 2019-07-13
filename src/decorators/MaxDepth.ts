export const MaxDepth = (max?: number): any => {
    return (target: Object, propName: string) => {
        target = propName ? target.constructor : target;
        const maxDepth = Reflect.getOwnMetadata("maxDepth", target) || { enabled: false, fields: {} };
        if (propName) {
            maxDepth.fields[propName] = max;
        } else {
            maxDepth.enabled = true;
        }
        Reflect.defineMetadata("maxDepth", maxDepth, target);
        console.log(maxDepth, target);
    };
};
