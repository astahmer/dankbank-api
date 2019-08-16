import {
    AbstractFilter,
    AbstractFilterApplyArgs,
    QueryParamValue,
    WhereType,
    WhereMethod,
    QueryParams,
    WhereOperator,
} from "./AbstractFilter";
import { Brackets, WhereExpression } from "typeorm";
import {
    getObjectOnlyKey as getObjectFirstKey,
    isDefined,
    camelToSnake,
    setNestedKey,
    sortObjectByKeys,
} from "../utils";
import { sortBy, prop, path } from "ramda";

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

    /** Returns where strategy formatted as a valid keyof STRATEGY_TYPES */
    protected formatWhereStrategy(strategyRaw: string) {
        return camelToSnake(strategyRaw).toUpperCase() as WhereStrategy;
    }

    protected getWhereOperatorByStrategy(strategy: WhereStrategy, not: boolean): WhereOperator {
        switch (strategy) {
            case SearchFilter.STRATEGY_TYPES.EXACT:
                return ((not ? "! " : "") + "=") as WhereOperator;

            case SearchFilter.STRATEGY_TYPES.IN:
                return ((not ? "NOT " : "") + "IN") as WhereOperator;

            case SearchFilter.STRATEGY_TYPES.CONTAINS:
            case SearchFilter.STRATEGY_TYPES.STARTS_WITH:
            case SearchFilter.STRATEGY_TYPES.ENDS_WITH:
                return ((not ? "NOT " : "") + "LIKE") as WhereOperator;

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

    protected getWhereParamByStrategy(strategy: WhereStrategy, propName: string, value: QueryParamValue) {
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

    /** Returns where arguments for a filter param: operator, condition and parameter */
    protected getWhereArgs({
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
        not: boolean;
    }) {
        const paramName = propCount ? propName + "_" + propCount : propName;
        const whereOperator = this.getWhereOperatorByStrategy(strategy, not);
        const whereParamSlot = strategy === SearchFilter.STRATEGY_TYPES.IN ? `(:...${paramName})` : `:${paramName}`;
        const whereParam = this.getWhereParamByStrategy(strategy, paramName, value);

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

        if (Array.isArray(filter.value) && filter.strategy !== SearchFilter.STRATEGY_TYPES.IN) {
            whereExp[mainMethod](
                new Brackets((qb) => {
                    for (let i = 0; i < filter.value.length; i++) {
                        const { whereCondition, whereParam } = this.getWhereArgs({
                            strategy: filter.strategy,
                            not: filter.not,
                            entityPrefix,
                            propName,
                            value: filter.value[i],
                            propCount: i,
                        });

                        // When a queryParam value is an array, check if any element pass the condition
                        qb.orWhere(whereCondition, whereParam);
                    }
                })
            );
        } else {
            const { whereCondition, whereParam } = this.getWhereArgs({
                strategy: filter.strategy,
                not: filter.not,
                entityPrefix,
                propName,
                value: filter.value,
            });
            whereExp[mainMethod](whereCondition, whereParam);
        }
    }

    /** Returns a FilterParam from splitting a string query param key */
    protected getFilterParam(key: string, rawValue: QueryParamValue): FilterParam {
        const paramRegex = /(?:((?:(?:(and|or)|(?:\(\w+\))))*):)?((?:(?:\w)+\.?)+)(?:;(\w+))?(\!?)/i;
        const matches = key.match(paramRegex);

        if (!matches) {
            return;
        }

        const [, nestedConditionRaw, typeRaw, propPath, strategyRaw, not] = matches;
        if (
            this.filterProperties.indexOf(propPath) !== -1 &&
            this.isParamInEntityProps(propPath) &&
            isDefined(rawValue)
        ) {
            const isNestedConditionFilter = nestedConditionRaw !== typeRaw;
            // Use type/strategy from key or defaults
            const type = typeRaw ? (typeRaw.toUpperCase() as WhereType) : WhereType.AND;
            const strategy =
                strategyRaw && !SearchFilter.STRATEGY_TYPES[strategyRaw as WhereStrategy]
                    ? this.formatWhereStrategy(strategyRaw)
                    : this.getPropertyDefaultWhereStrategy(propPath);

            // Remove actual filter WhereType from nested condition
            const nestedCondition = typeRaw ? nestedConditionRaw.slice(0, -typeRaw.length) : nestedConditionRaw;

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
                isNestedConditionFilter,
                nestedCondition,
                propPath,
                not: Boolean(not),
                value,
            };
        }
    }

    /** Returns filters & complex filters using nested conditions */
    protected getFiltersLists(queryParams: QueryParams) {
        const filters = [];
        const nestedConditionsFilters: NestedConditionsFilters = {};

        let key;
        for (key in queryParams) {
            const value = Array.isArray(queryParams[key])
                ? (queryParams[key] as string[]).filter(isDefined)
                : queryParams[key];
            const filter = this.getFilterParam(key, value);

            if (!filter) {
                continue;
            }

            if (filter.isNestedConditionFilter) {
                this.addFilterParamToNestedConditionsFilters(nestedConditionsFilters, filter);
            } else {
                filters.push(filter);
            }
        }

        return { filters, nestedConditionsFilters };
    }

    /** Add given filter param to its nested condition key */
    protected addFilterParamToNestedConditionsFilters(
        nestedConditionsFilters: NestedConditionsFilters,
        filter: FilterParam
    ) {
        const regex = /(and|or)|(\((\w+)\))/i;
        const conditionPath = [];
        let matches;
        let str = filter.nestedCondition;
        let wasPreviousMatchIdentifier = filter.nestedCondition.startsWith("(");

        while ((matches = regex.exec(str)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (matches.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            const [, type, identifierRaw, identifier] = matches;

            // Since previousMatch was an identifier and is now followed by another identifier
            // AND was implicit so we add it manually here
            if (wasPreviousMatchIdentifier && identifierRaw) {
                conditionPath.push(WhereType.AND.toLowerCase());
            }

            // Keep track of this match kind (either whereType or condition identifier)
            wasPreviousMatchIdentifier = Boolean(identifierRaw);

            // Move on to the next possible match
            str = str.replace(type || identifierRaw, "");

            // Push w/e was found
            conditionPath.push(type ? type : identifier);
        }

        if (!path(conditionPath, nestedConditionsFilters)) {
            setNestedKey(nestedConditionsFilters, conditionPath, []);
        }

        const filters: FilterParam[] = path(conditionPath, nestedConditionsFilters);
        filters.push(filter);
    }

    /** Apply a filter param by adding a where clause to its property & add needed joins if the property is nested */
    protected applyFilterParam({ qb, whereExp, aliases, filter }: ApplyFilterParamArgs) {
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
    }

    /** Recursively browse through every nested conditions object and add them */
    protected applyNestedConditionsFilters({
        qb,
        whereExp,
        aliases,
        nestedConditionsFilters,
    }: ApplyNestedConditionFiltersArgs) {
        const recursiveBrowseFilter = (
            object: Record<string, any>,
            whereExp: WhereExpression,
            isWhereType: boolean
        ) => {
            for (let property in sortObjectByKeys(object)) {
                if (Array.isArray(object[property])) {
                    // Avoid losing the "OR" if it's parsed first
                    const sortedFilters = sortBy(prop("type"), object[property]);

                    // Add parenthesis around condition identifier
                    whereExp.andWhere(
                        new Brackets((nestedWhereExp) => {
                            sortedFilters.forEach((filter: FilterParam) => {
                                console.log(filter.nestedCondition);
                                this.applyFilterParam({ qb, whereExp: nestedWhereExp, aliases, filter });
                            });
                        })
                    );
                } else if (typeof object[property] === "object" && isWhereType) {
                    whereExp[(property.toLowerCase() + "Where") as WhereMethod](
                        new Brackets((nestedWhereExp) => {
                            recursiveBrowseFilter(object[property], nestedWhereExp, false);
                        })
                    );
                } else {
                    recursiveBrowseFilter(object[property], whereExp, true);
                }
            }
        };

        recursiveBrowseFilter(nestedConditionsFilters, whereExp, true);
    }

    apply({ queryParams, qb, whereExp, aliases }: AbstractFilterApplyArgs) {
        const { filters, nestedConditionsFilters } = this.getFiltersLists(queryParams);

        filters.forEach((filter) => this.applyFilterParam({ qb, whereExp, aliases, filter }));
        this.applyNestedConditionsFilters({ qb, whereExp, aliases, nestedConditionsFilters });

        // Fix TypeORM queryBuilder bug where the first parsed "where" clause is of type "OR" > it would end up as a simple where clause, losing the OR
        qb.expressionMap.wheres = sortBy(prop("type"), qb.expressionMap.wheres);
    }
}

export type FilterParam = {
    type: WhereType;
    isNestedConditionFilter: boolean;
    nestedCondition?: string;
    propPath: string;
    strategy: WhereStrategy;
    not: boolean;
    value: QueryParamValue;
};

type NestedConditionsFilters = Record<string, any>;

interface ApplyFilterParamArgs extends AbstractFilterApplyArgs {
    filter: FilterParam;
}

interface ApplyNestedConditionFiltersArgs extends AbstractFilterApplyArgs {
    nestedConditionsFilters: NestedConditionsFilters;
}
