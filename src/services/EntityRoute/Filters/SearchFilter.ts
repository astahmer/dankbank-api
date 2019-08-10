import { AbstractFilter, FilterApplyParams, IAbstractFilterOptions } from "./AbstractFilter";
import { SelectQueryBuilder } from "typeorm";
import { getObjectOnlyKey } from "../utils";

/**
 * Add a/multiple where clause on any (deep?) properties of the decorated entity
 */
export class SearchFilter extends AbstractFilter<ISearchFilterOptions> {
    /** Enum of where condition strategy types */
    static readonly STRATEGY_TYPES = {
        EXACT: "exact",
        PARTIAL: "partial",
        STARTS_WITH: "startsWith",
        ENDS_WITH: "endsWith",
    };

    /** Retrieve a property whereStrategy from its propName/propPath */
    protected getPropertyWhereStrategy(propName: string) {
        const propFilter = this.options.properties.find((propFilter) =>
            typeof propFilter === "string" ? propFilter === propName : getObjectOnlyKey(propFilter) === propName
        );

        return typeof propFilter === "string"
            ? SearchFilter.STRATEGY_TYPES.EXACT || this.options.defaultWhereStrategy
            : propFilter[getObjectOnlyKey(propFilter)];
    }

    /** Add where condition by a given strategy type  */
    protected addWhereByStrategy(
        qb: SelectQueryBuilder<any>,
        strategy: string,
        entityPrefix: string,
        propName: string,
        value: string
    ) {
        const whereLike = `${entityPrefix}.${propName} LIKE :${propName}`;

        switch (strategy) {
            case SearchFilter.STRATEGY_TYPES.EXACT:
                qb.andWhere(`${entityPrefix}.${propName} = :${propName}`, {
                    [propName]: value,
                });
                break;
            case SearchFilter.STRATEGY_TYPES.PARTIAL:
                qb.andWhere(whereLike, { [propName]: "%" + value + "%" });
                break;
            case SearchFilter.STRATEGY_TYPES.STARTS_WITH:
                qb.andWhere(whereLike, { [propName]: value + "%" });
                break;
            case SearchFilter.STRATEGY_TYPES.ENDS_WITH:
                qb.andWhere(whereLike, { [propName]: "%" + value });
                break;

            default:
                throw new Error(strategy + " is not a a valid strategy");
                break;
        }
    }

    apply({ queryParams, qb }: FilterApplyParams) {
        const params = this.getPropertiesToFilter(queryParams);
        params.forEach((propPath) => {
            const props = propPath.split(".");

            if (props.length === 1) {
                const whereStrategy = this.getPropertyWhereStrategy(propPath);
                this.addWhereByStrategy(
                    qb,
                    whereStrategy,
                    this.entityMetadata.tableName,
                    propPath,
                    queryParams[propPath]
                );
            } else {
                const { entityPrefix, propName } = this.makeJoinsFromPropPath(
                    qb,
                    this.entityMetadata,
                    propPath,
                    props[0]
                );

                const whereStrategy = this.getPropertyWhereStrategy(propPath);
                this.addWhereByStrategy(qb, whereStrategy, entityPrefix, propName, queryParams[propPath]);
            }
        });
    }
}

interface ISearchFilterOptions extends IAbstractFilterOptions {
    defaultWhereStrategy?: string;
}
