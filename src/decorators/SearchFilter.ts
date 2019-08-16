import { FilterProperty, IAbstractFilterConfig } from "@/services/EntityRoute/Filters/AbstractFilter";
import { ISearchFilterOptions, SearchFilter, WhereStrategy } from "@/services/EntityRoute/Filters/SearchFilter";
import { AbstractFilterDecorator } from "@/services/EntityRoute/Filters/AbstractFilterDecorator";

export function SearchFilterDecorator(strategy?: WhereStrategy): PropertyDecorator;
export function SearchFilterDecorator(
    properties: FilterProperty[],
    filterOptions?: ISearchFilterOptions
): ClassDecorator;
export function SearchFilterDecorator(
    propParamOrFilterProperties?: WhereStrategy | FilterProperty[],
    filterOptions?: ISearchFilterOptions
): ClassDecorator | PropertyDecorator {
    const defaultConfig: Partial<IAbstractFilterConfig<ISearchFilterOptions>> = {
        class: SearchFilter,
        usePropertyNamesAsQueryParams: true,
        options: filterOptions || {
            defaultWhereStrategy: SearchFilter.STRATEGY_TYPES.EXACT,
        },
    };

    const propFilterHook = (propName: string, filterConfig: IAbstractFilterConfig) => {
        return { [propName]: propParamOrFilterProperties || filterConfig.options.defaultWhereStrategy };
    };

    return AbstractFilterDecorator({
        defaultConfig,
        propParamOrFilterProperties,
        propFilterHook,
    });
}
