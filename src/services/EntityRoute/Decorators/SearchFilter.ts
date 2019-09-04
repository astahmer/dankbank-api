import { FilterProperty, IAbstractFilterConfig } from "@/services/EntityRoute/Filters/AbstractFilter";
import { ISearchFilterOptions, STRATEGY_TYPES, getDefaultConfig } from "@/services/EntityRoute/Filters/SearchFilter";
import { AbstractFilterDecorator } from "@/services/EntityRoute/Filters/AbstractFilterDecorator";

export function SearchFilter(strategy?: STRATEGY_TYPES): PropertyDecorator;
export function SearchFilter(properties: FilterProperty[], filterOptions?: ISearchFilterOptions): ClassDecorator;
export function SearchFilter(
    propParamOrFilterProperties?: STRATEGY_TYPES | FilterProperty[],
    filterOptions?: ISearchFilterOptions
): ClassDecorator | PropertyDecorator {
    const defaultConfig = getDefaultConfig(filterOptions);

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
