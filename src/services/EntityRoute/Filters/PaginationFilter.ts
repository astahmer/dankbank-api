import {
    AbstractFilter,
    AbstractFilterApplyArgs,
    IDefaultFilterOptions,
    QueryParams,
    QueryParamValue,
    FilterDefaultConfig,
} from "./AbstractFilter";
import { SelectQueryBuilder } from "typeorm";

export interface IPaginationFilterOptions extends IDefaultFilterOptions {
    defaultOrderBys?: string | string[];
    defaultOrderDirection?: ORDER_DIRECTIONS;
    defaultRetrievedItemsLimit?: number;
}

export enum ORDER_DIRECTIONS {
    ASC = "ASC",
    DESC = "DESC",
}

export enum PAGINATION_TYPES {
    ORDER_BY = "orderBy",
    TAKE = "take",
    SKIP = "skip",
}

export const getDefaultConfig = (options: IPaginationFilterOptions): FilterDefaultConfig<IPaginationFilterOptions> => ({
    class: PaginationFilter,
    options: {
        all: false,
        defaultOrderBys: "id",
        defaultOrderDirection: ORDER_DIRECTIONS.ASC,
        defaultRetrievedItemsLimit: 100,
        ...options,
    },
});

export class PaginationFilter extends AbstractFilter<IPaginationFilterOptions> {
    protected getFilterParamsByTypes(queryParams: QueryParams) {
        return {
            orderBy: queryParams[PAGINATION_TYPES.ORDER_BY],
            take: parseInt(queryParams[PAGINATION_TYPES.TAKE] as string),
            skip: parseInt(queryParams[PAGINATION_TYPES.SKIP] as string),
        };
    }

    /**
     * Add orderBys statements for each orderBy entry in queryParam array
     * @param qb
     * @param orderBy
     *
     * @example req = /pictures/?orderBy=title:desc&orderBy=downloads:desc
     * will generate this SQL: ORDER BY `picture`.`title` DESC, `picture`.`downloads` DESC
     */
    protected addOrderBy(qb: SelectQueryBuilder<any>, orderBy: QueryParamValue) {
        if (!Array.isArray(orderBy)) {
            orderBy = [orderBy];
        }

        const orderByProps: Record<string, ORDER_DIRECTIONS> = {};
        let [i, length] = [0, orderBy.length];
        for (i; i < length; i++) {
            const [propPath, directionRaw] = orderBy[i].split(":");
            const props = propPath.split(".");
            const direction = directionRaw
                ? (directionRaw.toUpperCase() as ORDER_DIRECTIONS)
                : this.config.options.defaultOrderDirection;

            if (props.length === 1) {
                orderByProps[this.entityMetadata.tableName + "." + props] = direction;
            } else {
                const { entityAlias, propName } = this.normalizer.makeJoinsFromPropPath(
                    qb,
                    this.entityMetadata,
                    orderBy[i].replace(":" + direction, ""),
                    props[0]
                );

                orderByProps[entityAlias + "." + propName] = direction;
            }
        }

        qb.orderBy(orderByProps);
    }

    apply({ queryParams, qb }: AbstractFilterApplyArgs) {
        const { orderBy, take, skip } = this.getFilterParamsByTypes(queryParams);

        if (orderBy) {
            this.addOrderBy(qb, orderBy);
        } else {
            this.addOrderBy(qb, this.config.options.defaultOrderBys);
        }

        if (take || this.config.options.defaultRetrievedItemsLimit) {
            qb.take(take || this.config.options.defaultRetrievedItemsLimit);
        }

        if (skip) {
            qb.skip(skip);
        }
    }
}
