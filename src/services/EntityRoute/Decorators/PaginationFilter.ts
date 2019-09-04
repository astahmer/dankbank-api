import { FilterProperty, IAbstractFilterConfig } from "@/services/EntityRoute/Filters/AbstractFilter";
import {
    IPaginationFilterOptions,
    ORDER_DIRECTIONS,
    getDefaultConfig,
} from "@/services/EntityRoute/Filters/PaginationFilter";
import { AbstractFilterDecorator } from "@/services/EntityRoute/Filters/AbstractFilterDecorator";

export function PaginationFilter(direction?: ORDER_DIRECTIONS): PropertyDecorator;
export function PaginationFilter(
    properties: FilterProperty[],
    filterOptions?: IPaginationFilterOptions
): ClassDecorator;
export function PaginationFilter(
    propParamOrFilterProperties?: ORDER_DIRECTIONS | FilterProperty[],
    filterOptions?: IPaginationFilterOptions
): ClassDecorator | PropertyDecorator {
    const defaultConfig = getDefaultConfig(filterOptions);

    // Property Decorator
    const propFilterHook = (propName: string, filterConfig: IAbstractFilterConfig) => {
        return { [propName]: propParamOrFilterProperties || filterConfig.options.defautOrderDirection };
    };

    return AbstractFilterDecorator({
        defaultConfig,
        propParamOrFilterProperties,
        propFilterHook,
    });
}
