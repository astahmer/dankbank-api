import {
    FilterProperty, IAbstractFilterConfig
} from "@/services/EntityRoute/Filters/AbstractFilter";
import { AbstractFilterDecorator } from "@/services/EntityRoute/Filters/AbstractFilterDecorator";
import {
    getDefaultConfig, ISearchFilterOptions, STRATEGY_TYPES
} from "@/services/EntityRoute/Filters/SearchFilter";

/**
 * SearchFilter PropertyDecorator
 * @example [at]SearchFilter(STRATEGY_TYPES.EXISTS)
 */
export function SearchFilter(strategy?: STRATEGY_TYPES): PropertyDecorator;

/**
 * SearchFilter ClassDecorator
 * @example [at]SearchFilter({ all: true })
 */
export function SearchFilter(options?: ISearchFilterOptions): ClassDecorator;

/**
 * SearchFilter ClassDecorator
 * @example
 * [at]SearchFilter(["id", "banks.id", ["banks.coverPicture", "STRATEGY_TYPES.EXISTS"]], {
 *      defaultWhereStrategy: STRATEGY_TYPES.STARTS_WIT
 * })
 */
export function SearchFilter(properties: FilterProperty[], options?: ISearchFilterOptions): ClassDecorator;

export function SearchFilter(
    propParamOrFilterPropertiesOrOptions?: STRATEGY_TYPES | FilterProperty[] | ISearchFilterOptions,
    options?: ISearchFilterOptions
): ClassDecorator | PropertyDecorator {
    // If ClassDecorator & skipping properties
    if (
        !Array.isArray(propParamOrFilterPropertiesOrOptions) &&
        typeof propParamOrFilterPropertiesOrOptions === "object"
    ) {
        options = propParamOrFilterPropertiesOrOptions;
    }
    const defaultConfig = getDefaultConfig(options);

    // Property Decorator
    const propFilterHook = (propName: string, filterConfig: IAbstractFilterConfig<ISearchFilterOptions>) => {
        return [propName, propParamOrFilterPropertiesOrOptions || filterConfig.options.defaultWhereStrategy];
    };

    return AbstractFilterDecorator({
        defaultConfig,
        propsOrOptions: propParamOrFilterPropertiesOrOptions as any,
        propFilterHook: propFilterHook as any,
    });
}
