import { SelectQueryBuilder, EntityMetadata, WhereExpression } from "typeorm";
import { pick } from "ramda";

import { Normalizer, AliasList } from "../Normalizer";
import { getObjectOnlyKey, isDefined } from "../utils";

export abstract class AbstractFilter<FilterOptions = Record<string, any>> {
    protected config: IAbstractFilterConfig<FilterOptions>;
    protected entityMetadata: EntityMetadata;
    protected normalizer: Normalizer;

    constructor({ config, entityMetadata, normalizer }: AbstractFilterConstructor) {
        this.config = <IAbstractFilterConfig<FilterOptions>>config;
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
    abstract apply({ queryParams, qb, whereExp, aliases }: FilterApplyParams): void;

    /**
     *Add inner joins to get a nested property

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
                entityPrefix: prevAlias,
                propName: column.databaseName,
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
                qb.innerJoin((prevAlias || relation.entityMetadata.tableName) + "." + relation.propertyName, alias);
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

    /** Returns an array of valid query params to filter */
    protected getPropertiesToFilter(queryParams: QueryParams) {
        return Object.keys(queryParams).reduce((acc, param: string) => {
            if (
                this.filterProperties.indexOf(param) !== -1 &&
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

export type FilterApplyParams = {
    queryParams?: QueryParams;
    qb?: SelectQueryBuilder<any>;
    whereExp: WhereExpression;
    aliases: AliasList;
};

export type FilterProperty = string | Record<string, string>;

export enum WhereType {
    AND = "AND",
    OR = "OR",
}

export type WhereMethod = "where" | "andWhere" | "orWhere";

export interface IAbstractFilterConfig<Options = Record<string, any>> {
    class: new ({ entityMetadata, config }: AbstractFilterConstructor) => any;
    whereType: keyof typeof WhereType;
    properties: FilterProperty[];
    usePropertyNamesAsQueryParams?: boolean;
    queryParamKey?: string;
    options: Options;
}
