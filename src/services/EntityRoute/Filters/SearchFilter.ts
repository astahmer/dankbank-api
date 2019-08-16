import {
    AbstractFilter,
    FilterApplyParams,
    QueryParamValue,
    WhereType,
    WhereMethod,
    QueryParams,
} from "./AbstractFilter";
import { Brackets, WhereExpression } from "typeorm";
import { getObjectOnlyKey as getObjectFirstKey, isDefined, camelToSnake } from "../utils";
import { sortBy, prop } from "ramda";

export interface ISearchFilterOptions {
    defaultWhereStrategy?: WhereStrategy;
}

enum STRATEGY_TYPES {
    EXACT = "EXACT",
    IN = "IN",
    CONTAINS = "CONTAINS",
    STARTS_WITH = "STARTS_WITH",
    ENDS_WITH = "ENDS_WITH",
    LESS_THAN = "LESS_THAN",
    LESS_THAN_OR_EQUAL = "LESS_THAN_OR_EQUAL",
    GREATER_THAN = "GREATER_THAN",
    GREATER_THAN_OR_EQUAL = "GREATER_THAN_OR_EQUAL",
}
export type WhereStrategy = keyof typeof STRATEGY_TYPES;

/**
 * Add a/multiple where clause on any (deep?) properties of the decorated entity
 */
export class SearchFilter extends AbstractFilter<ISearchFilterOptions> {
    /** Enum of where condition strategy types */
    static readonly STRATEGY_TYPES = STRATEGY_TYPES;

    /** Retrieve a property default where strategy from its propName/propPath */
    protected getPropertyDefaultWhereStrategy(propPath: string) {
        const propFilter = this.config.properties.find((propFilter) =>
            typeof propFilter === "string" ? propFilter === propPath : getObjectFirstKey(propFilter) === propPath
        );

        return typeof propFilter === "string"
            ? this.config.options.defaultWhereStrategy || SearchFilter.STRATEGY_TYPES.EXACT
            : this.formatWhereStrategy(propFilter[getObjectFirstKey(propFilter)]);
    }

    /** Return where strategy formatted as a valid keyof STRATEGY_TYPES */
    protected formatWhereStrategy(strategyRaw: string) {
        return camelToSnake(strategyRaw).toUpperCase() as WhereStrategy;
    }

    protected getWhereByStrategyOperator(strategy: WhereStrategy, not: string) {
        switch (strategy) {
            case SearchFilter.STRATEGY_TYPES.EXACT:
                return (not ? "! " : "") + "=";

            case SearchFilter.STRATEGY_TYPES.IN:
                return (not ? "NOT " : "") + "IN";

            case SearchFilter.STRATEGY_TYPES.CONTAINS:
            case SearchFilter.STRATEGY_TYPES.STARTS_WITH:
            case SearchFilter.STRATEGY_TYPES.ENDS_WITH:
                return (not ? "NOT " : "") + "LIKE";

            case SearchFilter.STRATEGY_TYPES.LESS_THAN:
                return "<";

            case SearchFilter.STRATEGY_TYPES.LESS_THAN_OR_EQUAL:
                return "<=";

            case SearchFilter.STRATEGY_TYPES.GREATER_THAN:
                return ">";

            case SearchFilter.STRATEGY_TYPES.GREATER_THAN_OR_EQUAL:
                return ">=";

            default:
                throw new Error(strategy + " is not a a valid filter strategy");
        }
    }

    protected getWhereByStrategyParam(strategy: WhereStrategy, propName: string, value: QueryParamValue) {
        switch (strategy) {
            case SearchFilter.STRATEGY_TYPES.EXACT:
            case SearchFilter.STRATEGY_TYPES.IN:
            case SearchFilter.STRATEGY_TYPES.LESS_THAN:
            case SearchFilter.STRATEGY_TYPES.LESS_THAN_OR_EQUAL:
            case SearchFilter.STRATEGY_TYPES.GREATER_THAN:
            case SearchFilter.STRATEGY_TYPES.GREATER_THAN_OR_EQUAL:
                return { [propName]: value };

            case SearchFilter.STRATEGY_TYPES.CONTAINS:
                return { [propName]: "%" + value + "%" };

            case SearchFilter.STRATEGY_TYPES.STARTS_WITH:
                return { [propName]: value + "%" };

            case SearchFilter.STRATEGY_TYPES.ENDS_WITH:
                return { [propName]: "%" + value };

            default:
                throw new Error(strategy + " is not a a valid filter strategy");
        }
    }

    protected getWhereByStrategyArgs({
        strategy,
        entityPrefix,
        propName,
        value,
        propCount,
        not,
    }: {
        strategy: WhereStrategy;
        entityPrefix: string;
        propName: string;
        value: QueryParamValue;
        propCount?: number;
        not: string;
    }) {
        const paramName = propCount ? propName + "_" + propCount : propName;
        const whereOperator = this.getWhereByStrategyOperator(strategy, not);
        const whereParamSlot = strategy === SearchFilter.STRATEGY_TYPES.IN ? `(:...${paramName})` : `:${paramName}`;
        const whereParam = this.getWhereByStrategyParam(strategy, paramName, value);

        const whereCondition = `${entityPrefix}.${propName} ${whereOperator} ${whereParamSlot}`;
        return { whereOperator, whereCondition, whereParam };
    }

    /** Add where condition by a given strategy type  */
    protected addWhereByStrategy({
        whereExp,
        entityPrefix,
        filter,
        propName,
    }: {
        whereExp: WhereExpression;
        entityPrefix: string;
        filter: FilterParam;
        propName: string;
    }) {
        const mainMethod = (filter.type.toLowerCase() + "Where") as WhereMethod;
        const inverseMethod = ((filter.type === WhereType.AND ? WhereType.OR : WhereType.AND).toLowerCase() +
            "Where") as WhereMethod;

        if (Array.isArray(filter.value) && filter.strategy !== SearchFilter.STRATEGY_TYPES.IN) {
            whereExp[mainMethod](
                new Brackets((qb) => {
                    for (let i = 0; i < filter.value.length; i++) {
                        const { whereCondition, whereParam } = this.getWhereByStrategyArgs({
                            strategy: filter.strategy,
                            not: filter.not,
                            entityPrefix,
                            propName,
                            value: filter.value[i],
                            propCount: i,
                        });
                        qb.orWhere(whereCondition, whereParam);
                    }
                })
            );
        } else {
            const { whereCondition, whereParam } = this.getWhereByStrategyArgs({
                strategy: filter.strategy,
                not: filter.not,
                entityPrefix,
                propName,
                value: filter.value,
            });
            whereExp[mainMethod](whereCondition, whereParam);
        }
    }

    /** Return a FilterParam from splitting a string query param key */
    protected getFilterParam(key: string, rawValue: QueryParamValue): FilterParam {
        // const paramRegexOld = /(and|or)(?:\.(\w+))?:((?:\w)+\.?)(?:;(\w+))?(\!?)/i;
        const paramRegexValid = /(?:(and|or)\.?((?:\w+)*):)?((?:(?:\w)+\.?)+)(?:;(\w+))?(\!?)/i;
        // const paramRegexNewCapture = /((((and|or)|(\(\w+\))))*:)?((?:(?:\w)+\.?)+)(?:;(\w+))?(\!?))/i;
        // const paramRegex = /((?:(?:(?:and|or)|(?:\(\w+\))))*:)?((?:(?:\w)+\.?)+)(?:;(\w+))?(\!?)/i;
        const matches = key.match(paramRegexValid);

        if (!matches) {
            return;
        }

        const [, typeRaw, identifier, propPath, strategyRaw, not] = matches;
        if (
            this.filterProperties.indexOf(propPath) !== -1 &&
            this.isParamInEntityProps(propPath) &&
            isDefined(rawValue)
        ) {
            // Use type/strategy from key or defaults
            const type = typeRaw ? (typeRaw.toUpperCase() as WhereType) : WhereType.AND;
            const strategy =
                strategyRaw && !SearchFilter.STRATEGY_TYPES[strategyRaw as WhereStrategy]
                    ? this.formatWhereStrategy(strategyRaw)
                    : this.getPropertyDefaultWhereStrategy(propPath);

            // If query param value is a string and contains comma-separated values, make an array from it
            const value = !Array.isArray(rawValue)
                ? rawValue
                      .split(",")
                      .map((val) => val.trim())
                      .filter(Boolean)
                : rawValue;

            return {
                type,
                strategy,
                identifier,
                propPath,
                not,
                value,
            };
        }
    }

    protected getFilterParamList(queryParams: QueryParams) {
        const filters = [];
        const specificFilters: SpecificFilters = {};

        let key;
        for (key in queryParams) {
            const value = Array.isArray(queryParams[key])
                ? (queryParams[key] as string[]).filter(isDefined)
                : queryParams[key];
            const filter = this.getFilterParam(key, value);

            if (!filter) {
                continue;
            }

            if (filter.identifier) {
                if (!specificFilters[filter.identifier]) {
                    specificFilters[filter.identifier] = [];
                }

                specificFilters[filter.identifier].push(filter);
            } else {
                filters.push(filter);
            }
        }

        return { filters, specificFilters };
    }

    apply({ queryParams, qb, whereExp, aliases }: FilterApplyParams) {
        const { filters, specificFilters } = this.getFilterParamList(queryParams);
        filters.forEach((filter) => {
            const props = filter.propPath.split(".");

            if (props.length === 1) {
                this.addWhereByStrategy({
                    whereExp,
                    entityPrefix: this.entityMetadata.tableName,
                    filter,
                    propName: filter.propPath,
                });
            } else {
                const { entityPrefix, propName } = this.makeJoinsFromPropPath(
                    qb,
                    this.entityMetadata,
                    filter.propPath,
                    aliases,
                    props[0]
                );

                this.addWhereByStrategy({ whereExp, entityPrefix, filter, propName });
            }
        });

        console.log(specificFilters);

        // Fix TypeORM queryBuilder bug where the first parsed "where" clause is of type "OR" > it would end up as a simple where clause, losing the OR
        qb.expressionMap.wheres = sortBy(prop("type"), qb.expressionMap.wheres);
    }
}

export type FilterParam = {
    type: WhereType;
    identifier: string;
    propPath: string;
    strategy: WhereStrategy;
    not: string;
    value: QueryParamValue;
};

type SpecificFilters = Record<string, FilterParam[]>;
