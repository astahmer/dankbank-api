import { SelectQueryBuilder } from "typeorm";

import { isType } from "../utils";
import {
    AbstractFilter,
    AbstractFilterApplyArgs,
    FilterDefaultConfig,
    IDefaultFilterOptions,
    QueryParams,
    QueryParamValue,
} from "./AbstractFilter";

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

export const getDefaultConfig = (
    options?: IPaginationFilterOptions
): FilterDefaultConfig<IPaginationFilterOptions> => ({
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
    /** Returns every filterable properties  */
    get filterProperties() {
        return this.config.properties
            ? this.config.properties.map((prop) => (typeof prop === "string" ? prop : prop[0]).split(":")[0])
            : [];
    }

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

        let [i, length] = [0, orderBy.length];
        for (i; i < length; i++) {
            let [propPath, directionRaw] = orderBy[i].split(":");
            const props = propPath.split(".");
            const direction = directionRaw ? directionRaw.toUpperCase() : this.config.options.defaultOrderDirection;

            // Checks that given direction is valid & that filter is both enabled & valid
            const isValidParam = this.isParamInEntityProps(propPath);
            if (
                !isType<ORDER_DIRECTIONS>(direction, direction in ORDER_DIRECTIONS) ||
                !this.isFilterEnabledForProperty(propPath) ||
                !isValidParam
            ) {
                continue;
            }

            // If last part of propPath is a relation (instead of a column), append ".id" to it
            if (
                this.entityMetadata.findRelationWithPropertyPath(props[0]) &&
                isValidParam.propertyName === "id" &&
                !propPath.endsWith(".id")
            ) {
                propPath += ".id";
                props.push("id");
            }

            if (props.length === 1) {
                qb.addOrderBy(this.entityMetadata.tableName + "." + props, direction);
            } else {
                const { entityAlias, propName } = this.normalizer.makeJoinsFromPropPath(
                    qb,
                    this.entityMetadata,
                    propPath,
                    props[0]
                );

                qb.addOrderBy(entityAlias + "." + propName, direction);
            }
        }
    }

    apply({ queryParams, qb }: AbstractFilterApplyArgs) {
        // Apply filter for each property decorator
        this.filterProperties.forEach((orderBy) => {
            this.addOrderBy(qb, orderBy);
        });

        // Apply filter for each query params
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
