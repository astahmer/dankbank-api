/**
 * Will apply MaxDepth attribute on every properties of this entity
 */
export function MaxDepth(): ClassDecorator;

/**
 * Will apply MaxDepth on that property
 * @param max depth recursion authorized
 */
export function MaxDepth(max: number): PropertyDecorator;

export function MaxDepth(max?: number): ClassDecorator | PropertyDecorator {
    return (target: Object, propName: string) => {
        // If propName is defined => PropertyDecorator, else it's a ClassDecorator
        target = propName ? target.constructor : target;
        const maxDepth = Reflect.getOwnMetadata("maxDepth", target) || { enabled: false, fields: {} };
        if (propName) {
            maxDepth.fields[propName] = max;
        } else {
            maxDepth.enabled = true;
        }
        Reflect.defineMetadata("maxDepth", maxDepth, target);
    };
}
