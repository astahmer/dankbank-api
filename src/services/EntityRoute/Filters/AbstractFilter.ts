import { SelectQueryBuilder, EntityMetadata } from "typeorm";
import { Normalizer, AliasList } from "../Normalizer";
import { getObjectOnlyKey, isDefined } from "../utils";

export abstract class AbstractFilter<FilterOptions = Record<string, any>> {
    protected config: IAbstractFilterConfig<FilterOptions>;
    protected entityMetadata: EntityMetadata;
    protected normalizer: Normalizer;

    constructor({ config: config, entityMetadata, normalizer }: AbstractFilterConstructor) {
        this.config = <IAbstractFilterConfig<FilterOptions>>config;
        this.entityMetadata = entityMetadata;
        this.normalizer = normalizer;
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
    abstract apply({ queryParams, qb, aliases }: FilterApplyParams): void;

    /**
     *Add inner joins to get a nested property

     * @param qb current queryBuilder instance
     * @param entityMetadata current meta to search column or relation in
     * @param propPath dot delimited property path leading to a nested property
     * @param currentProp current propPath part used, needed to find column or relation meta
     * @param prevAlias TODO PREV ALIAS instead of prevProp
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

    /** Returns true if filter is set for a given property && first part of propPath exists in this entity properties && given value to search for is defined  */
    protected getPropertiesToFilter(queryParams: Record<string, string>) {
        const isParamInEntityProps = (param: string) => {
            return param.indexOf(".") !== -1
                ? this.entityProperties.indexOf(param.split(".")[0]) !== -1
                : this.entityProperties.indexOf(param) !== -1;
        };

        return Object.keys(queryParams).reduce((acc, param: string) => {
            const paramKey = param.replace("[]", "");

            if (
                this.filterProperties.indexOf(paramKey) !== -1 &&
                isParamInEntityProps(paramKey) &&
                isDefined(queryParams[param])
            ) {
                acc.push(paramKey);
            }
            return acc;
        }, []);
    }
}

export type AbstractFilterConstructor = {
    entityMetadata: EntityMetadata;
    config: IAbstractFilterConfig;
    normalizer: Normalizer;
};

export type FilterApplyParams = {
    queryParams?: any;
    qb?: SelectQueryBuilder<any>;
    aliases: AliasList;
};

export type FilterProperty = string | Record<string, string>;

export interface IAbstractFilterConfig<Options = Record<string, any>> {
    class: new ({ entityMetadata, config }: AbstractFilterConstructor) => any;
    properties: FilterProperty[];
    usePropertyNamesAsQueryParams?: Boolean;
    queryParamKey?: string;
    options: Options;
}
