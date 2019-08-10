import { SelectQueryBuilder, EntityMetadata } from "typeorm";
import { Normalizer } from "../Normalizer";
import { getObjectOnlyKey, isDefined } from "../utils";

export abstract class AbstractFilter<FilterOptions extends IAbstractFilterOptions = IAbstractFilterOptions> {
    protected options: FilterOptions;
    protected entityMetadata: EntityMetadata;
    protected normalizer: Normalizer;

    constructor({ options, entityMetadata, normalizer }: AbstractFilterConstructor) {
        this.options = <FilterOptions>options;
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
        return this.options.properties.map((prop) => (typeof prop === "string" ? prop : getObjectOnlyKey(prop)));
    }

    /** This method should add conditions to the queryBuilder using queryParams  */
    abstract apply({ queryParams, qb }: FilterApplyParams): void;

    /**
     *Add inner joins to get a nested property

     * @param qb current queryBuilder instance
     * @param entityMetadata current meta to search column or relation in
     * @param propPath dot delimited property path leading to a nested property
     * @param currentProp current propPath part used, needed to find column or relation meta
     * @param prevProp TODO PREV ALIAS instead of prevProp
     */
    protected makeJoinsFromPropPath(
        qb: SelectQueryBuilder<any>,
        entityMetadata: EntityMetadata,
        propPath: string,
        currentProp: string,
        prevProp?: string
    ): any {
        const column = entityMetadata.findColumnWithPropertyName(currentProp);
        const relation = column ? column.relationMetadata : entityMetadata.findRelationWithPropertyPath(currentProp);

        // Flat primitive property
        if (column && !relation) {
            return {
                entityPrefix: prevProp,
                propName: column.databaseName,
            };
        } else {
            // Relation

            qb.innerJoin(
                (prevProp || relation.entityMetadata.tableName) + "." + relation.propertyName,
                relation.propertyName
            );

            const splitPath = propPath.split(".");
            const nextPropPath = splitPath.slice(1).join(".");

            return this.makeJoinsFromPropPath(
                qb,
                relation.inverseEntityMetadata,
                nextPropPath,
                splitPath[1],
                splitPath[0]
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
            if (
                this.filterProperties.indexOf(param) !== -1 &&
                isParamInEntityProps(param) &&
                isDefined(queryParams[param])
            ) {
                acc.push(param);
            }
            return acc;
        }, []);
    }
}

export type AbstractFilterConstructor = {
    entityMetadata: EntityMetadata;
    options: IAbstractFilterOptions;
    normalizer: Normalizer;
};

export type FilterApplyParams = {
    queryParams?: any;
    qb?: SelectQueryBuilder<any>;
};

export type FilterProperty = string | Record<string, string>;

export interface IAbstractFilterOptions {
    class: new ({ entityMetadata, options }: AbstractFilterConstructor) => any;
    properties: FilterProperty[];
    usePropertyNamesAsQueryParams?: Boolean;
    queryParamKey?: string;
}
