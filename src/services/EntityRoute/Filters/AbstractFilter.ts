import { SelectQueryBuilder, EntityMetadata, WhereExpression } from "typeorm";
import { pick } from "ramda";

import { Normalizer, AliasList } from "../Normalizer";
import { getObjectOnlyKey, isDefined } from "../utils";

export abstract class AbstractFilter<FilterOptions extends IDefaultFilterOptions = IDefaultFilterOptions> {
    protected config: IAbstractFilterConfig<FilterOptions>;
    protected entityMetadata: EntityMetadata;
    protected normalizer: Normalizer;

    constructor({ config, entityMetadata, normalizer }: AbstractFilterConstructor) {
        this.config = config as IAbstractFilterConfig<FilterOptions>;
        this.entityMetadata = entityMetadata;
        this.normalizer = normalizer;

        if (!config.whereType) config.whereType = WhereType.AND;
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
    abstract apply({ queryParams, qb, whereExp, aliases }: AbstractFilterApplyArgs): void;

    /**
     *Add left joins to get a nested property

     * @param qb current queryBuilder instance
     * @param entityMetadata current meta to search column or relation in
     * @param propPath dot delimited property path leading to a nested property
     * @param currentProp current propPath part used, needed to find column or relation meta
     * @param prevAlias previous alias used to joins on current entity props
     */
    protected makeJoinsFromPropPath(
        qb: SelectQueryBuilder<any>,
        entityMetadata: EntityMetadata,
        propPath: string,
        aliases: AliasList,
        currentProp: string,
        prevAlias?: string
    ): any {
        const column = entityMetadata.findColumnWithPropertyName(currentProp);
        const relation = column ? column.relationMetadata : entityMetadata.findRelationWithPropertyPath(currentProp);

        // Flat primitive property
        if (column && !relation) {
            return {
                entityAlias: prevAlias,
                propName: column.databaseName,
                columnMeta: column,
            };
        } else {
            // Relation

            const isJoinAlreadyMade = qb.expressionMap.joinAttributes.find(
                (join) => join.entityOrProperty === relation.entityMetadata.tableName + "." + relation.propertyName
            );
            let alias = this.normalizer.getPropertyLastAlias(
                aliases,
                relation.entityMetadata.tableName,
                relation.propertyName
            );

            if (!isJoinAlreadyMade) {
                alias = this.normalizer.generateAlias(
                    aliases,
                    relation.entityMetadata.tableName,
                    relation.propertyName
                );
                qb.leftJoin((prevAlias || relation.entityMetadata.tableName) + "." + relation.propertyName, alias);
            }

            const splitPath = propPath.split(".");
            const nextPropPath = splitPath.slice(1).join(".");

            return this.makeJoinsFromPropPath(
                qb,
                relation.inverseEntityMetadata,
                nextPropPath,
                aliases,
                splitPath[1],
                alias
            );
        }
    }

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

    protected getQueryParamsToFilter(queryParams: QueryParams) {
        const params = this.getPropertiesToFilter(queryParams);
        return pick(params, queryParams);
    }
}

export type AbstractFilterConstructor = {
    entityMetadata: EntityMetadata;
    config: IAbstractFilterConfig;
    normalizer: Normalizer;
};

export type QueryParamValue = string | string[];
export type QueryParams = Record<string, QueryParamValue>;

export type AbstractFilterApplyArgs = {
    queryParams?: QueryParams;
    qb?: SelectQueryBuilder<any>;
    whereExp?: WhereExpression;
    aliases?: AliasList;
};

export type FilterProperty = string | Record<string, string>;

export enum WhereType {
    AND = "and",
    OR = "or",
}

export type WhereMethod = "where" | "andWhere" | "orWhere";
export enum COMPARISON_OPERATOR {
    LESS_THAN = "<",
    LESS_THAN_OR_EQUAL = "<=",
    GREATER_THAN = ">",
    GREATER_THAN_OR_EQUAL = ">=",
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
    whereType: WhereType;
    properties: FilterProperty[];
    usePropertyNamesAsQueryParams?: boolean;
    queryParamKey?: string;
    options: Options;
}
