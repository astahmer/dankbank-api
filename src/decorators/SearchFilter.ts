import { FilterProperty, IAbstractFilterConfig } from "@/services/EntityRoute/Filters/AbstractFilter";
import { ISearchFilterOptions, SearchFilter, STRATEGY_TYPES } from "@/services/EntityRoute/Filters/SearchFilter";
import { AbstractFilterDecorator } from "@/services/EntityRoute/Filters/AbstractFilterDecorator";

export function SearchFilterDecorator(strategy?: STRATEGY_TYPES): PropertyDecorator;
export function SearchFilterDecorator(
    properties: FilterProperty[],
    filterOptions?: ISearchFilterOptions
): ClassDecorator;
export function SearchFilterDecorator(
    propParamOrFilterProperties?: STRATEGY_TYPES | FilterProperty[],
    filterOptions?: ISearchFilterOptions
): ClassDecorator | PropertyDecorator {
    const defaultConfig: Partial<IAbstractFilterConfig<ISearchFilterOptions>> = {
        class: SearchFilter,
        usePropertyNamesAsQueryParams: true,
        options: filterOptions || {
            all: false,
            defaultWhereStrategy: SearchFilter.STRATEGY_TYPES.EXACT,
        },
    };

    // Property Decorator
    const propFilterHook = (propName: string, filterConfig: IAbstractFilterConfig) => {
        return { [propName]: propParamOrFilterProperties || filterConfig.options.defaultWhereStrategy };
    };

    return AbstractFilterDecorator({
        defaultConfig,
        propParamOrFilterProperties,
        propFilterHook,
    });
}
