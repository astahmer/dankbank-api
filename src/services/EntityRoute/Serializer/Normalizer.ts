import { EntityMetadata, SelectQueryBuilder, getRepository } from "typeorm";
import { isPrimitive } from "util";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { Operation } from "@/services/EntityRoute/decorators/Groups";
import { sortObjectByKeys, lowerFirstLetter } from "../utils";
import { EntityRoute } from "../EntityRoute";
import { COMPUTED_PREFIX, ALIAS_PREFIX } from "@/services/EntityRoute/decorators/Groups";
import { getDependsOnMetadata } from "@/services/EntityRoute/decorators/DependsOn";

export class Normalizer<Entity extends AbstractEntity> {
    private qb: SelectQueryBuilder<Entity>;

    constructor(private entityRoute: EntityRoute<Entity>) {}

    get repository() {
        return this.entityRoute.routeRepository;
    }

    get metadata() {
        return this.repository.metadata;
    }

    get mapper() {
        return this.entityRoute.mapper;
    }

    get aliasManager() {
        return this.entityRoute.aliasManager;
    }

    get options() {
        return this.entityRoute.options;
    }

    get currentQb() {
        return this.qb;
    }

    /** Retrieve collection of entities with only exposed props (from groups) */
    public async getCollection<Entity extends AbstractEntity>(
        operation: Operation,
        qb: SelectQueryBuilder<Entity>
    ): Promise<[Entity[], number]> {
        this.joinAndSelectExposedProps(operation, qb, this.metadata, "", this.metadata.tableName);
        this.joinAndSelectPropsThatComputedPropsDependsOn(operation, qb, this.metadata);

        const results = await qb.getManyAndCount();
        const items = await Promise.all(results[0].map((item) => this.recursiveFormatItem(item, operation)));

        return [items, results[1]];
    }

    /** Retrieve a specific entity with only exposed props (from groups) */
    public async getItem<Entity extends AbstractEntity>(operation: Operation, entityId: number) {
        const selectProps = this.mapper.getSelectProps(operation, this.metadata, true);
        const qb: SelectQueryBuilder<any> = this.repository
            .createQueryBuilder(this.metadata.tableName)
            .select(selectProps)
            .where(this.metadata.tableName + ".id = :id", { id: entityId });

        this.joinAndSelectExposedProps(operation, qb, this.metadata, "", this.metadata.tableName);
        this.joinAndSelectPropsThatComputedPropsDependsOn(operation, qb, this.metadata);

        this.qb = qb;
        const result = await qb.getOne();
        const item: Entity = await this.recursiveFormatItem(result, operation);

        return item;
    }

    /**
     *Add left joins to get a nested property

     * @param qb current queryBuilder instance
     * @param entityMetadata current meta to search column or relation in
     * @param propPath dot delimited property path leading to a nested property
     * @param currentProp current propPath part used, needed to find column or relation meta
     * @param prevAlias previous alias used to joins on current entity props
     */
    public makeJoinsFromPropPath(
        qb: SelectQueryBuilder<any>,
        entityMetadata: EntityMetadata,
        propPath: string,
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
            let alias = this.aliasManager.getPropertyLastAlias(
                relation.entityMetadata.tableName,
                relation.propertyName
            );

            if (!isJoinAlreadyMade) {
                alias = this.aliasManager.generate(relation.entityMetadata.tableName, relation.propertyName);
                qb.leftJoin((prevAlias || relation.entityMetadata.tableName) + "." + relation.propertyName, alias);
            }

            const splitPath = propPath.split(".");
            const nextPropPath = splitPath.slice(1).join(".");

            return this.makeJoinsFromPropPath(qb, relation.inverseEntityMetadata, nextPropPath, splitPath[1], alias);
        }
    }

    /**
     * Recursively :
     * - Remove any object that is not another Entity or is not a Date
     * - Flatten item with only id if needed
     * - Set subresources IRI if item has any
     * - Add computed props to this item
     * - Sort item's property keys
     * */
    private async recursiveFormatItem<Entity extends AbstractEntity>(
        item: Entity,
        operation: Operation
    ): Promise<Entity> {
        let key, prop, entityMetadata;
        entityMetadata = getRepository(item.constructor.name).metadata;

        for (key in item) {
            prop = item[key as keyof Entity];
            if (Array.isArray(prop)) {
                item[key as keyof Entity] = prop.map((nestedItem) =>
                    this.recursiveFormatItem(nestedItem, operation)
                ) as any;
            } else if (prop instanceof Object && prop.constructor.prototype instanceof AbstractEntity) {
                item[key as keyof Entity] = await this.recursiveFormatItem(prop as any, operation);
            } else if (!isPrimitive(prop) && !(prop instanceof Date)) {
                item[key as keyof Entity] = undefined;
            }
        }

        if (
            this.options.shouldEntityWithOnlyIdBeFlattenedToIri &&
            item instanceof Object &&
            item.constructor.prototype instanceof AbstractEntity &&
            Object.keys(item).length === 1 &&
            "id" in item
        ) {
            item = item.getIri() as any;
            return item;
        } else {
            await this.setComputedPropsOnItem(item, operation, entityMetadata);
            this.setSubresourcesIriOnItem(item, entityMetadata);
            return sortObjectByKeys(item);
        }
    }

    /**
     * Add recursive left joins & selects to QueryBuilder on exposed props for a given operation with a given entityMetadata
     *
     * @param operation used to get exposed props for this operation
     * @param qb current QueryBuilder
     * @param entityMetadata used to select exposed props & joins relations
     * @param currentPath dot delimited path to keep track of the nesting max depth
     * @param prevProp used to left join further
     */
    private joinAndSelectExposedProps(
        operation: Operation,
        qb: SelectQueryBuilder<any>,
        entityMetadata: EntityMetadata,
        currentPath?: string,
        prevProp?: string
    ) {
        if (prevProp && prevProp !== entityMetadata.tableName) {
            const selectProps = this.mapper.getSelectProps(operation, entityMetadata, true, prevProp);
            qb.addSelect(selectProps);
        }

        const newPath = (currentPath ? currentPath + "." : "") + entityMetadata.tableName;
        const relationProps = this.mapper.getRelationPropsMetas(operation, entityMetadata);

        relationProps.forEach((relation) => {
            const circularProp = this.mapper.isRelationPropCircular(
                newPath + "." + relation.inverseEntityMetadata.tableName,
                relation.inverseEntityMetadata,
                relation
            );

            const alias = this.aliasManager.generate(relation.entityMetadata.tableName, relation.propertyName);
            if (!circularProp || this.options.shouldMaxDepthReturnRelationPropsId) {
                qb.leftJoin(prevProp + "." + relation.propertyName, alias);
            }

            if (!circularProp) {
                this.joinAndSelectExposedProps(operation, qb, relation.inverseEntityMetadata, newPath, alias);
            } else if (this.options.shouldMaxDepthReturnRelationPropsId) {
                qb.addSelect(alias + ".id");
            }
        });
    }

    /** Join and select any props marked as needed for each computed prop (with @DependsOn) in order to be able to retrieve them later */
    private joinAndSelectPropsThatComputedPropsDependsOn(
        operation: Operation,
        qb: SelectQueryBuilder<any>,
        entityMetadata: EntityMetadata
    ) {
        const dependsOnMeta = getDependsOnMetadata(entityMetadata.target as Function);
        const computedProps = this.mapper.getComputedProps(operation, entityMetadata).map(getComputedPropMethodAndKey);
        computedProps.forEach((computed) => {
            if (dependsOnMeta[computed.computedPropMethod]) {
                dependsOnMeta[computed.computedPropMethod].forEach((propPath) => {
                    const props = propPath.split(".");
                    const { entityAlias, propName } = this.makeJoinsFromPropPath(
                        qb,
                        entityMetadata,
                        propPath,
                        props[0]
                    );
                    qb.addSelect([entityAlias + "." + propName]);
                });
            }
        });
    }

    private async setComputedPropsOnItem<U extends AbstractEntity>(
        item: U,
        operation: Operation,
        entityMetadata: EntityMetadata
    ) {
        const computedProps = this.mapper
            .getComputedProps(operation, entityMetadata)
            .map((computed) => getComputedPropMethodAndKey(computed));
        const propsPromises = await Promise.all(
            computedProps.map((computed) => (item[computed.computedPropMethod as keyof U] as any)())
        );
        propsPromises.forEach((result, i) => (item[computedProps[i].propKey as keyof U] = result));
    }

    /** For each item's subresources, add their corresponding IRIs to this item */
    private setSubresourcesIriOnItem<U extends AbstractEntity>(item: U, entityMetadata: EntityMetadata) {
        const subresourceProps = this.mapper.getSubresourceProps(entityMetadata);

        let key;
        for (key in subresourceProps) {
            if (!item[key as keyof U]) {
                (item as any)[key as keyof U] = item.getIri() + "/" + key;
            }
        }
    }
}

export const computedPropRegex = /^(get|is|has).+/;

/**
 * Returns a formatted version of the method name
 *
 * @param computed actual method name
 */
export const makeComputedPropNameFromMethod = (computed: string) => {
    const regexResult = computed.match(computedPropRegex);
    if (regexResult) {
        return lowerFirstLetter(computed.replace(regexResult[1], ""));
    }

    throw new Error('A computed property method should start with either "get", "is", or "has".');
};

/**
 * Returns actual method name without prefixes & computed prop alias for the response
 *
 * @param computed method name prefixed with COMPUTED_PREFIX & ALIAS_PREFIX/alias if there is one
 */
export const getComputedPropMethodAndKey = (computed: string) => {
    const computedPropMethod = computed.replace(COMPUTED_PREFIX, "").split(ALIAS_PREFIX)[0];
    const alias = computed.split(ALIAS_PREFIX)[1];
    const propKey = alias || makeComputedPropNameFromMethod(computedPropMethod);
    return { computedPropMethod, propKey };
};
