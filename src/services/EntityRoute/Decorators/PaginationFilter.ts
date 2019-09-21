import { FilterProperty, IAbstractFilterConfig } from "@/services/EntityRoute/Filters/AbstractFilter";
import {
    IPaginationFilterOptions,
    getDefaultConfig,
    ORDER_DIRECTIONS,
} from "@/services/EntityRoute/Filters/PaginationFilter";
import { AbstractFilterDecorator } from "@/services/EntityRoute/Filters/AbstractFilterDecorator";

export function PaginationFilter(
    properties?: FilterProperty[],
    filterOptions?: IPaginationFilterOptions
): ClassDecorator {
    const defaultConfig = getDefaultConfig(filterOptions);

    return AbstractFilterDecorator({
        defaultConfig,
        propParamOrFilterProperties: properties,
    }) as ClassDecorator;
}

export function OrderFilter(direction?: ORDER_DIRECTIONS, relationPropName?: string): PropertyDecorator {
    const defaultConfig = getDefaultConfig();

    const withRelationPropName = relationPropName ? "." + relationPropName : "";
    const propFilterHook = (propName: string, filterConfig: IAbstractFilterConfig<IPaginationFilterOptions>) => {
        return propName + withRelationPropName + ":" + (direction || filterConfig.options.defautOrderDirection);
    };

    return AbstractFilterDecorator({
        defaultConfig,
        propParamOrFilterProperties: { direction, relationPropName },
        propFilterHook,
    });
}
