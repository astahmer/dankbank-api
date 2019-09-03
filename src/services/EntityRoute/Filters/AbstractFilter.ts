import { SelectQueryBuilder, EntityMetadata, WhereExpression } from "typeorm";
import { pick } from "ramda";

import { Normalizer } from "../Serializer/Normalizer";
import { getObjectOnlyKey, isDefined } from "../utils";

export abstract class AbstractFilter<FilterOptions extends IDefaultFilterOptions = IDefaultFilterOptions> {
    protected config: IAbstractFilterConfig<FilterOptions>;
    protected entityMetadata: EntityMetadata;
    protected normalizer: Normalizer<any>;

    constructor({ config, entityMetadata, normalizer }: AbstractFilterConstructor) {
        this.config = config as IAbstractFilterConfig<FilterOptions>;
        this.entityMetadata = entityMetadata;
        this.normalizer = normalizer;
    }

    get aliasManager() {
        return this.normalizer.aliasManager;
    }

    /** Returns every properties of this route entity */
    get entityProperties() {
        return this.entityMetadata.columns
            .reduce((acc: string[], column) => {
                if (!column.relationMetadata) {
                    acc.push(column.propertyName);
                }
                return acc;
            }, [])
            .concat(this.entityMetadata.relations.map((relation) => relation.propertyName));
    }

    /** Returns every filterable properties  */
    get filterProperties() {
        return this.config.properties.map((prop) => (typeof prop === "string" ? prop : getObjectOnlyKey(prop)));
    }

    /** This method should add conditions to the queryBuilder using queryParams  */
    abstract apply({ queryParams, qb, whereExp }: AbstractFilterApplyArgs): void;

    /** Return true if first part of propPath exists in this entity properties */
    protected isParamInEntityProps(param: string) {
        return param.indexOf(".") !== -1
            ? this.entityProperties.indexOf(param.split(".")[0]) !== -1
            : this.entityProperties.indexOf(param) !== -1;
    }

    /**
     * Returns true if given propPath filter is enabled or property was decorated
     * Nested properties using a path require being explicitly passed in properties array of @SearchFilter ClassDecorator
     */
    protected isFilterEnabledForProperty(propPath: string) {
        if (this.config.options.all && propPath.split(".").length === 1) {
            return true;
        } else {
            return this.filterProperties.indexOf(propPath) !== -1;
        }
    }

    /** Returns an array of valid query params to filter */
    protected getPropertiesToFilter(queryParams: QueryParams) {
        return Object.keys(queryParams).reduce((acc, param: string) => {
            if (
                this.isFilterEnabledForProperty(param) &&
                this.isParamInEntityProps(param) &&
                isDefined(queryParams[param])
            ) {
                acc.push(param);
            }
            return acc;
        }, []);
    }

    protected getPropertiesQueryParamsToFilter(queryParams: QueryParams) {
        const params = this.getPropertiesToFilter(queryParams);
        return pick(params, queryParams);
    }
}

export type AbstractFilterConstructor = {
    entityMetadata: EntityMetadata;
    config: IAbstractFilterConfig;
    normalizer: Normalizer<any>;
};

export type QueryParamValue = string | string[];
export type QueryParams = Record<string, QueryParamValue>;

export type AbstractFilterApplyArgs = {
    queryParams?: QueryParams;
    qb?: SelectQueryBuilder<any>;
    whereExp?: WhereExpression;
};

export type FilterProperty = string | Record<string, string>;

export enum WhereType {
    AND = "and",
    OR = "or",
}

export type WhereMethod = "where" | "andWhere" | "orWhere";
export enum COMPARISON_OPERATOR {
    BETWEEN = "<>",
    BETWEEN_STRICT = "><",
    LESS_THAN = "<",
    LESS_THAN_OR_EQUAL = "<|",
    GREATER_THAN = ">",
    GREATER_THAN_OR_EQUAL = ">|",
}

export enum SQL_OPERATOR {
    LIKE = "LIKE",
    NOT_LIKE = "NOT LIKE",
    IN = "IN",
    NOT_IN = "NOT IN",
    IS = "IS",
    IS_NOT = "IS_NOT",
    IS_NULL = "IS NULL",
    IS_NOT_NULL = "IS NOT NULL",
}

export type WhereOperator = "=" | "!=" | COMPARISON_OPERATOR | SQL_OPERATOR;

export interface IDefaultFilterOptions {
    [key: string]: any;
    all: boolean;
}

export interface IAbstractFilterConfig<Options = IDefaultFilterOptions> {
    class: new ({ entityMetadata, config }: AbstractFilterConstructor) => any;
    properties: FilterProperty[];
    options: Options;
}

export type FilterDefaultConfig<Options = IDefaultFilterOptions> = Omit<IAbstractFilterConfig<Options>, "properties">;
