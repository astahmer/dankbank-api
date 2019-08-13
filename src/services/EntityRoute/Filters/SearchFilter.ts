import { AbstractFilter, FilterApplyParams } from "./AbstractFilter";
import { SelectQueryBuilder, Brackets } from "typeorm";
import { getObjectOnlyKey, isDefined } from "../utils";

export interface ISearchFilterOptions {
    defaultWhereStrategy?: string;
}

export enum SearchFilterStrategyTypes {
    EXACT = "exact",
    PARTIAL = "partial",
    STARTS_WITH = "startsWith",
    ENDS_WITH = "endsWith",
}

export type SearchFilterStrategyTypesList = "exact" | "partial" | "startsWith" | "endsWith";

/**
 * Add a/multiple where clause on any (deep?) properties of the decorated entity
 */
export class SearchFilter extends AbstractFilter<ISearchFilterOptions> {
    /** Enum of where condition strategy types */
    static readonly STRATEGY_TYPES = SearchFilterStrategyTypes;

    /** Retrieve a property whereStrategy from its propName/propPath */
    protected getPropertyWhereStrategy(propName: string) {
        const propFilter = this.config.properties.find((propFilter) =>
            typeof propFilter === "string" ? propFilter === propName : getObjectOnlyKey(propFilter) === propName
        );

        return typeof propFilter === "string"
            ? this.config.options.defaultWhereStrategy || SearchFilter.STRATEGY_TYPES.EXACT
            : propFilter[getObjectOnlyKey(propFilter)];
    }

    protected getWhereByStrategyParam(strategy: string, propName: string, value: string) {
        switch (strategy) {
            case SearchFilter.STRATEGY_TYPES.EXACT:
                return { [propName]: value };

            case SearchFilter.STRATEGY_TYPES.PARTIAL:
                return { [propName]: "%" + value + "%" };

            case SearchFilter.STRATEGY_TYPES.STARTS_WITH:
                return { [propName]: value + "%" };

            case SearchFilter.STRATEGY_TYPES.ENDS_WITH:
                return { [propName]: "%" + value };

            default:
                throw new Error(strategy + " is not a a valid strategy");
        }
    }

    protected getWhereByStrategyArgs(
        strategy: string,
        entityPrefix: string,
        propName: string,
        value: string,
        propCount?: number
    ) {
        const paramName = propCount ? propName + "_" + propCount : propName;
        const whereOperator = strategy === SearchFilter.STRATEGY_TYPES.EXACT ? "=" : "LIKE";
        const whereCondition = `${entityPrefix}.${propName} ${whereOperator} :${paramName}`;
        const whereParam = this.getWhereByStrategyParam(strategy, paramName, value);

        return { whereOperator, whereCondition, whereParam };
    }

    /** Add where condition by a given strategy type  */
    protected addWhereByStrategy(
        qb: SelectQueryBuilder<any>,
        strategy: string,
        entityPrefix: string,
        propName: string,
        value: string | string[]
    ) {
        if (Array.isArray(value)) {
            qb.andWhere(
                new Brackets((qb) => {
                    for (let i = 0; i < value.length; i++) {
                        const { whereCondition, whereParam } = this.getWhereByStrategyArgs(
                            strategy,
                            entityPrefix,
                            propName,
                            value[i],
                            i
                        );
                        qb.orWhere(whereCondition, whereParam);
                    }
                })
            );
        } else {
            const { whereCondition, whereParam } = this.getWhereByStrategyArgs(strategy, entityPrefix, propName, value);
            qb.andWhere(whereCondition, whereParam);
        }
    }

    apply({ queryParams, qb, aliases }: FilterApplyParams) {
        const params = this.getPropertiesToFilter(queryParams);
        params.forEach((propPath) => {
            const props = propPath.split(".");
            let propArray = queryParams[propPath + "[]"];

            // If there is only one value while using brackets, the value is read as string
            if (propArray && !Array.isArray(propArray)) {
                propArray = [propArray];
            }

            const value = propArray ? propArray.filter(isDefined) : queryParams[propPath];

            if (props.length === 1) {
                const whereStrategy = this.getPropertyWhereStrategy(propPath);
                this.addWhereByStrategy(qb, whereStrategy, this.entityMetadata.tableName, propPath, value);
            } else {
                const { entityPrefix, propName } = this.makeJoinsFromPropPath(
                    qb,
                    this.entityMetadata,
                    propPath,
                    aliases,
                    props[0]
                );

                const whereStrategy = this.getPropertyWhereStrategy(propPath);
                this.addWhereByStrategy(qb, whereStrategy, entityPrefix, propName, value);
            }
        });
    }
}
