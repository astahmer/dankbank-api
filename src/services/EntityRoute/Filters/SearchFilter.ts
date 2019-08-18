import {
    AbstractFilter,
    AbstractFilterApplyArgs,
    QueryParamValue,
    WhereType,
    WhereMethod,
    QueryParams,
    WhereOperator,
    IDefaultFilterOptions,
    COMPARISON_OPERATOR,
} from "./AbstractFilter";
import { Brackets, WhereExpression } from "typeorm";
import {
    getObjectOnlyKey as getObjectFirstKey,
    isDefined,
    camelToSnake,
    setNestedKey,
    sortObjectByKeys,
    parseStringAsBoolean,
} from "../utils";
import { sortBy, prop, path } from "ramda";
import { ColumnMetadata } from "typeorm/metadata/ColumnMetadata";

export interface ISearchFilterOptions extends IDefaultFilterOptions {
    defaultWhereStrategy?: WhereStrategy;
}

enum STRATEGY_TYPES {
    EXACT = "EXACT",
    IN = "IN",
    IS = "IS",
    EXISTS = "EXISTS",
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
        // If all entity props are authorized as filters, return default where strategy
        if (this.config.options.all) {
            return this.config.options.defaultWhereStrategy || STRATEGY_TYPES.EXACT;
        }

        const propFilter = this.config.properties.find((propFilter) =>
            typeof propFilter === "string" ? propFilter === propPath : getObjectFirstKey(propFilter) === propPath
        );

        return typeof propFilter === "string"
            ? this.config.options.defaultWhereStrategy || STRATEGY_TYPES.EXACT
            : this.formatWhereStrategy(propFilter[getObjectFirstKey(propFilter)]);
    }

    /** Returns where strategy formatted as a valid keyof STRATEGY_TYPES */
    protected formatWhereStrategy(strategyRaw: string) {
        return camelToSnake(strategyRaw).toUpperCase() as WhereStrategy;
    }

    protected getWhereOperatorByStrategy(strategy: WhereStrategy, not: boolean): WhereOperator {
        let operator;
        switch (strategy) {
            default:
            case STRATEGY_TYPES.EXACT:
                operator = (not ? "!" : "") + "=";
                break;

            case STRATEGY_TYPES.IN:
                operator = (not ? "NOT " : "") + "IN";
                break;

            case STRATEGY_TYPES.IS:
                operator = "IS" + (not ? " NOT" : "");
                break;

            case STRATEGY_TYPES.EXISTS:
                operator = "IS" + (not ? " NOT" : "") + " NULL";
                break;

            case STRATEGY_TYPES.CONTAINS:
            case STRATEGY_TYPES.STARTS_WITH:
            case STRATEGY_TYPES.ENDS_WITH:
                operator = (not ? "NOT " : "") + "LIKE";
                break;

            case STRATEGY_TYPES.LESS_THAN:
                operator = "<";
                break;

            case STRATEGY_TYPES.LESS_THAN_OR_EQUAL:
                operator = "<=";
                break;

            case STRATEGY_TYPES.GREATER_THAN:
                operator = ">";
                break;

            case STRATEGY_TYPES.GREATER_THAN_OR_EQUAL:
                operator = ">=";
                break;
        }

        return operator as WhereOperator;
    }

    protected getWhereParamByStrategy(strategy: WhereStrategy, propName: string, value: string | boolean | Date) {
        switch (strategy) {
            default:
                return { [propName]: value };

            case STRATEGY_TYPES.EXISTS:
                return {};

            case STRATEGY_TYPES.CONTAINS:
                return { [propName]: "%" + value + "%" };

            case STRATEGY_TYPES.STARTS_WITH:
                return { [propName]: value + "%" };

            case STRATEGY_TYPES.ENDS_WITH:
                return { [propName]: "%" + value };
        }
    }

    protected getWhereParamSlotByStrategy(strategy: WhereStrategy, paramName: string) {
        if (strategy === STRATEGY_TYPES.IN) {
            return `(:...${paramName})`;
        } else if (strategy === STRATEGY_TYPES.EXISTS) {
            return "";
        } else {
            return `:${paramName}`;
        }
    }

    protected getWhereParamValueByStrategy(
        strategy: WhereStrategy,
        column: ColumnMetadata,
        value: string,
        not?: boolean
    ) {
        // If property is a datetime and the searched value only contains Date (=without time)
        if (column.type === "datetime" && value.indexOf(":") === -1) {
            // add start/end of day with time
            if (STRATEGY_TYPES.LESS_THAN_OR_EQUAL === strategy || STRATEGY_TYPES.GREATER_THAN === strategy) {
                return value + " 23:59:59";
            } else if (STRATEGY_TYPES.GREATER_THAN_OR_EQUAL === strategy || STRATEGY_TYPES.LESS_THAN === strategy) {
                return value + " 00:00:00";
            }
        } else if (typeof column.type === "function" && column.type.name === "Boolean") {
            // Returns string converted to boolean (inversed by not operator)
            return not ? !parseStringAsBoolean(value) : parseStringAsBoolean(value);
        }

        return value;
    }

    /** Get the associated strategy of a comparison operator */
    protected getWhereStrategyByComparison(comparison: COMPARISON_OPERATOR) {
        switch (comparison) {
            case COMPARISON_OPERATOR.LESS_THAN:
                return STRATEGY_TYPES.LESS_THAN;

            case COMPARISON_OPERATOR.LESS_THAN_OR_EQUAL:
                return STRATEGY_TYPES.LESS_THAN_OR_EQUAL;

            case COMPARISON_OPERATOR.GREATER_THAN:
                return STRATEGY_TYPES.GREATER_THAN;

            case COMPARISON_OPERATOR.GREATER_THAN_OR_EQUAL:
                return STRATEGY_TYPES.GREATER_THAN_OR_EQUAL;
        }
    }

    /** Returns where arguments for a filter param: operator, condition and parameter */
    protected getWhereArgs({
        strategy,
        entityAlias,
        propName,
        rawValue,
        propCount,
        not,
        column,
    }: {
        strategy: WhereStrategy;
        entityAlias: string;
        propName: string;
        rawValue: string;
        propCount?: number;
        not: boolean;
        column: ColumnMetadata;
    }) {
        const paramName = propCount ? propName + "_" + propCount : propName;
        const value = this.getWhereParamValueByStrategy(strategy, column, rawValue);

        if (STRATEGY_TYPES.EXISTS === strategy) {
            not = not ? !parseStringAsBoolean(rawValue) : parseStringAsBoolean(rawValue);
        }

        const whereOperator = this.getWhereOperatorByStrategy(strategy, not);
        const whereParamSlot = this.getWhereParamSlotByStrategy(strategy, paramName);
        const whereParam = this.getWhereParamByStrategy(strategy, paramName, value);

        const whereCondition = `${entityAlias}.${propName} ${whereOperator} ${whereParamSlot}`;
        return { whereOperator, whereCondition, whereParam };
    }

    /** Add where condition by a given strategy type  */
    protected addWhereByStrategy({
        whereExp,
        entityAlias,
        filter,
        propName,
        column,
    }: {
        whereExp: WhereExpression;
        entityAlias: string;
        filter: FilterParam;
        propName: string;
        column: ColumnMetadata;
    }) {
        const mainMethod = (filter.type.toLowerCase() + "Where") as WhereMethod;

        if (Array.isArray(filter.value) && filter.strategy !== STRATEGY_TYPES.IN) {
            whereExp[mainMethod](
                new Brackets((qb) => {
                    for (let i = 0; i < filter.value.length; i++) {
                        const { whereCondition, whereParam } = this.getWhereArgs({
                            strategy: filter.strategy,
                            not: filter.not,
                            entityAlias: entityAlias,
                            propName,
                            rawValue: filter.value[i],
                            propCount: i,
                            column,
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
                entityAlias: entityAlias,
                propName,
                rawValue: filter.value as string,
                column,
            });
            whereExp[mainMethod](whereCondition, whereParam);
        }
    }

    /** Returns strategy given from queryParamKey or default one for this propPath if none given/not valid */
    protected getWhereStrategyIdentifier(
        strategyRaw: string,
        propPath: string,
        comparison: COMPARISON_OPERATOR
    ): WhereStrategy {
        let strategyIdentifier: WhereStrategy;
        if (strategyRaw) {
            if (STRATEGY_TYPES[strategyRaw as WhereStrategy]) {
                // Valid identifier was directly used in queryParamKey
                return strategyRaw as WhereStrategy;
            } else {
                // Format strategy to a proper strategy identifier
                strategyIdentifier = this.formatWhereStrategy(strategyRaw);

                // Check that strategy identifier is a valid one
                if (STRATEGY_TYPES[strategyIdentifier as WhereStrategy]) {
                    return strategyIdentifier as WhereStrategy;
                }
            }
        } else if (comparison) {
            // If no strategy was defined but there is a comparison operator, use it as shortcut for a strategy
            return this.getWhereStrategyByComparison(comparison);
        }

        // Either no strategy/comparison was given in queryParamKey or the strategy is not a valid one
        return this.getPropertyDefaultWhereStrategy(propPath);
    }

    /** Returns a FilterParam from splitting a string query param key */
    protected getFilterParam(key: string, rawValue: QueryParamValue): FilterParam {
        const complexFilterRegex = /(?:((?:(?:(and|or)|(?:\(\w+\))))*):)?/;
        const propRegex = /((?:(?:\w)+\.?)+)/;
        const strategyRegex = /(?:(?:(?:;(\w+))|(<=|>=|<|>|)?))?(!?)/;

        const regex = new RegExp(complexFilterRegex.source + propRegex.source + strategyRegex.source, "i");
        const matches = key.match(regex);

        if (!matches) {
            return;
        }

        const [, nestedConditionRaw, typeRaw, propPath, strategyRaw, comparison, not] = matches;
        if (this.isFilterEnabledForProperty(propPath) && this.isParamInEntityProps(propPath) && isDefined(rawValue)) {
            const isNestedConditionFilter = nestedConditionRaw !== typeRaw;
            // Use type/strategy from key or defaults
            const type = typeRaw ? (typeRaw as WhereType) : WhereType.AND;
            const strategy = this.getWhereStrategyIdentifier(strategyRaw, propPath, comparison as COMPARISON_OPERATOR);

            // Remove actual filter WhereType from nested condition
            const nestedCondition = typeRaw ? nestedConditionRaw.slice(0, -typeRaw.length) : nestedConditionRaw;

            // If query param value is a string and contains comma-separated values, make an array from it
            const value =
                typeof rawValue === "string"
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
                comparison: comparison as COMPARISON_OPERATOR,
            };
        }
    }

    /**
     * Fix query params with "<=" or ">=" in key
     * Koa transforms them into a queryParam with a wrong key and an array of duplicated value
     * {
     *      ...,
     *      "queryParamKey<": [
     *          ""=queryParamValue",
     *          ""=queryParamValue"
     *      ]
     * }
     * instead of { ..., "queryParamKey<=": queryParamValue }
     *
     * Note how the "=" should be in the key instead of value
     */
    protected fixQueryParamsWithComparisonEquals(queryParams: QueryParams) {
        const comparisonOperators = Object.values(COMPARISON_OPERATOR);
        let key, value;
        for (key in queryParams) {
            if (comparisonOperators.includes(key.slice(-1)) && Array.isArray(queryParams[key])) {
                value = queryParams[key];
                delete queryParams[key];
                queryParams[key + "="] = value[0].slice(1);
            }
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
                conditionPath.push(WhereType.AND);
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
            const column = this.entityMetadata.findColumnWithPropertyName(filter.propPath);

            this.addWhereByStrategy({
                whereExp,
                entityAlias: this.entityMetadata.tableName,
                filter,
                propName: filter.propPath,
                column,
            });
        } else {
            const { entityAlias, propName, columnMeta: column } = this.makeJoinsFromPropPath(
                qb,
                this.entityMetadata,
                filter.propPath,
                aliases,
                props[0]
            );

            this.addWhereByStrategy({ whereExp, entityAlias, filter, propName, column });
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
        this.fixQueryParamsWithComparisonEquals(queryParams);
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
    comparison: COMPARISON_OPERATOR;
};

type NestedConditionsFilters = Record<string, any>;

interface ApplyFilterParamArgs extends AbstractFilterApplyArgs {
    filter: FilterParam;
}

interface ApplyNestedConditionFiltersArgs extends AbstractFilterApplyArgs {
    nestedConditionsFilters: NestedConditionsFilters;
}
