import { FilterProperty, IAbstractFilterConfig } from "@/services/EntityRoute/Filters/AbstractFilter";
import {
    ISearchFilterOptions,
    SearchFilter,
    SearchFilterStrategyTypesList,
} from "@/services/EntityRoute/Filters/SearchFilter";
import { RouteFiltersMeta, getRouteFiltersMeta, ROUTE_FILTERS_METAKEY } from "@/services/EntityRoute/EntityRoute";

export function SearchFilterDecorator(strategy?: SearchFilterStrategyTypesList): PropertyDecorator;
export function SearchFilterDecorator(properties: FilterProperty[], options?: ISearchFilterOptions): ClassDecorator;
export function SearchFilterDecorator(
    strategyOrProperties?: SearchFilterStrategyTypesList | FilterProperty[],
    options?: ISearchFilterOptions
): ClassDecorator | PropertyDecorator {
    return (target: Object | Function, propName: string, _descriptor?: PropertyDescriptor) => {
        if (typeof target === "object") {
            target = target.constructor;
        }

        const filtersMeta: RouteFiltersMeta = getRouteFiltersMeta(target as Function) || {};

        const config: Partial<IAbstractFilterConfig<ISearchFilterOptions>> = {
            class: SearchFilter,
            usePropertyNamesAsQueryParams: true,
            options: {
                defaultWhereStrategy: "exact",
            },
        };
        const filter: IAbstractFilterConfig<ISearchFilterOptions> = filtersMeta[SearchFilter.name];

        if (!Array.isArray(strategyOrProperties)) {
            const defaultWhereStrategy = filter
                ? filter.options.defaultWhereStrategy
                : config.options.defaultWhereStrategy;
            const propFilter = { [propName]: strategyOrProperties || defaultWhereStrategy };

            if (filter) {
                filter.properties.push(propFilter);
            } else {
                config.properties = [propFilter];
            }
        } else {
            config.properties = strategyOrProperties;
            config.options = options;
        }

        if (!filter) {
            filtersMeta[SearchFilter.name] = config as IAbstractFilterConfig;
        }

        Reflect.defineMetadata(ROUTE_FILTERS_METAKEY, filtersMeta, target);
    };
}
