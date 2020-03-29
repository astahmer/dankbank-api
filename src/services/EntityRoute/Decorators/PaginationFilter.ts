import { FilterProperty, IAbstractFilterConfig } from "@/services/EntityRoute/Filters/AbstractFilter";
import { AbstractFilterDecorator } from "@/services/EntityRoute/Filters/AbstractFilterDecorator";
import {
    getDefaultConfig,
    IPaginationFilterOptions,
    ORDER_DIRECTIONS,
} from "@/services/EntityRoute/Filters/PaginationFilter";

/**
 * PaginationFilter ClassDecorator without properties
 * @example
 * [at]PaginationFilter()
 * [at]PaginationFilter({ all: true })
 */
export function PaginationFilter(options?: IPaginationFilterOptions): ClassDecorator;

/**
 * PaginationFilter ClassDecorator with properties
 * @example [at]PaginationFilter(["id", ["name", "desc"], { defaultRetrievedItemsLimit: 10 })
 */
export function PaginationFilter(properties?: FilterProperty[], options?: IPaginationFilterOptions): ClassDecorator;

export function PaginationFilter(
    propertiesOrOptions?: FilterProperty[] | IPaginationFilterOptions,
    options?: IPaginationFilterOptions
) {
    let properties: any[] = [];
    // If ClassDecorator & skipping properties
    if (!Array.isArray(propertiesOrOptions)) {
        options = propertiesOrOptions;
    }

    const defaultConfig = getDefaultConfig(options);

    return AbstractFilterDecorator({
        defaultConfig,
        propsOrOptions: properties,
    }) as ClassDecorator;
}

/**
 * PaginationFilter PropertyDecorator
 * @example [at]OrderBy(ORDER_DIRECTIONS.ASC, "user.name")
 * @example [at]OrderBy(ORDER_DIRECTIONS.DESC)
 */
export function OrderBy(direction?: ORDER_DIRECTIONS, relationPropName?: string): PropertyDecorator {
    const defaultConfig = getDefaultConfig();

    const withRelationPropName = relationPropName ? "." + relationPropName : "";
    const propFilterHook = (propName: string, filterConfig: IAbstractFilterConfig<IPaginationFilterOptions>) => {
        return propName + withRelationPropName + ":" + (direction || filterConfig.options.defautOrderDirection);
    };

    return AbstractFilterDecorator({
        defaultConfig,
        propsOrOptions: { direction, relationPropName },
        propFilterHook,
    });
}
