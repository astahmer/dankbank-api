import { FilterProperty, IAbstractFilterConfig } from "@/services/EntityRoute/Filters/AbstractFilter";
import {
    ISearchFilterOptions,
    SearchFilter,
    SearchFilterStrategyTypesList,
} from "@/services/EntityRoute/Filters/SearchFilter";
import { AbstractFilterDecorator } from "@/services/EntityRoute/Filters/AbstractFilterDecorator";

export function SearchFilterDecorator(strategy?: SearchFilterStrategyTypesList): PropertyDecorator;
export function SearchFilterDecorator(
    properties: FilterProperty[],
    filterOptions?: ISearchFilterOptions
): ClassDecorator;
export function SearchFilterDecorator(
    propParamOrFilterProperties?: SearchFilterStrategyTypesList | FilterProperty[],
    filterOptions?: ISearchFilterOptions
): ClassDecorator | PropertyDecorator {
    const defaultConfig: Partial<IAbstractFilterConfig<ISearchFilterOptions>> = {
        class: SearchFilter,
        usePropertyNamesAsQueryParams: true,
        options: filterOptions || {
            defaultWhereStrategy: "exact",
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
