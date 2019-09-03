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
    defaultOrderDirection?: ORDER_DIRECTIONS;
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
    options: options || { all: false, defautOrderDirection: ORDER_DIRECTIONS.ASC },
});

export class PaginationFilter extends AbstractFilter<IPaginationFilterOptions> {
    protected getFilterParamsByTypes(queryParams: QueryParams) {
        return {
            orderBy: queryParams[PAGINATION_TYPES.ORDER_BY],
            take: queryParams[PAGINATION_TYPES.TAKE],
            skip: queryParams[PAGINATION_TYPES.SKIP],
        };
    }

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
        }

        if (take && typeof take === "string" && parseInt(take)) {
            qb.take(parseInt(take));
        }

        if (skip && typeof skip === "string" && parseInt(skip)) {
            qb.skip(parseInt(skip));
        }
    }
}
