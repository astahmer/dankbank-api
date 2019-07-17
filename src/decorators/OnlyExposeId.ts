export function OnlyExposeId(): PropertyDecorator {
    return (target: Object, propName: string) => {
        const onlyExposeId = Reflect.getOwnMetadata("onlyExposeId", target.constructor) || {};
        onlyExposeId[propName] = true;

        Reflect.defineMetadata("onlyExposeId", onlyExposeId, target.constructor);
    };
}
