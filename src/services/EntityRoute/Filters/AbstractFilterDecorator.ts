import { RouteFiltersMeta, getRouteFiltersMeta, ROUTE_FILTERS_METAKEY } from "@/services/EntityRoute/EntityRoute";
import { IAbstractFilterConfig, FilterProperty } from "./AbstractFilter";

export function AbstractFilterDecorator({
    defaultConfig,
    propParamOrFilterProperties,
    propFilterHook,
}: {
    defaultConfig: Partial<IAbstractFilterConfig>;
    propParamOrFilterProperties: any | FilterProperty[];
    propFilterHook?: (propName: string, filterConfig?: any) => FilterProperty;
}): PropertyDecorator | ClassDecorator {
    return (target: object | Function, propName: string, _descriptor?: PropertyDescriptor) => {
        if (typeof target === "object") {
            target = target.constructor;
        }

        const filtersMeta: RouteFiltersMeta = getRouteFiltersMeta(target as Function) || {};
        const filter: IAbstractFilterConfig = filtersMeta[defaultConfig.class.name];

        // If all entity properties are authorized as filter, ignore this property decorator
        if (filter && filter.options.all) {
            return;
        }

        if (propName) {
            // Property Decorator
            const propFilter = propFilterHook(propName, filter || defaultConfig);

            if (filter) {
                filter.properties.push(propFilter);
            } else {
                defaultConfig.properties = [propFilter];
            }
        } else {
            // Class Decorator
            defaultConfig.properties = propParamOrFilterProperties;
        }

        // If not filter of this kind is defined on this entity yet, add it
        if (!filter) {
            filtersMeta[defaultConfig.class.name] = defaultConfig as IAbstractFilterConfig;
        }

        Reflect.defineMetadata(ROUTE_FILTERS_METAKEY, filtersMeta, target);
    };
}
