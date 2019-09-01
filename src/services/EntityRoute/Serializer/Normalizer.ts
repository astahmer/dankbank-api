import { EntityMetadata, SelectQueryBuilder, getRepository } from "typeorm";
import { isPrimitive } from "util";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { Operation } from "@/decorators/Groups";
import { sortObjectByKeys, lowerFirstLetter } from "../utils";
import { EntityRoute } from "../EntityRoute";
import { COMPUTED_PREFIX, ALIAS_PREFIX } from "@/decorators/Groups";

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

    /**
     * Retrieve collection of entities with only exposed props (from groups)
     *
     * @param operation used to get exposed props for this operation
     * @param qb
     */
    public async getCollection<Entity extends AbstractEntity>(
        operation: Operation,
        qb: SelectQueryBuilder<Entity>
    ): Promise<[Entity[], number]> {
        this.makeJoinFromGroups(operation, qb, this.metadata, "", this.metadata.tableName);

        const results = await qb.getManyAndCount();
        const items = results[0].map((item) => this.recursiveBrowseItem(item, operation));

        return [items, results[1]];
    }

    public async getItem<Entity extends AbstractEntity>(operation: Operation, entityId: number) {
        const selectProps = this.mapper.getSelectProps(operation, this.metadata, true);
        const qb: SelectQueryBuilder<any> = this.repository
            .createQueryBuilder(this.metadata.tableName)
            .select(selectProps)
            .where(this.metadata.tableName + ".id = :id", { id: entityId });

        this.makeJoinFromGroups(operation, qb, this.metadata, "", this.metadata.tableName);

        this.qb = qb;
        const result = await qb.getOne();
        const item: Entity = this.recursiveBrowseItem(result, operation);

        return item;
    }

    private recursiveBrowseItem<Entity extends AbstractEntity>(item: Entity, operation: Operation): Entity {
        let key, prop, entityMetadata;
        entityMetadata = getRepository(item.constructor.name).metadata;

        for (key in item) {
            prop = item[key as keyof Entity];
            if (Array.isArray(prop)) {
                item[key as keyof Entity] = prop.map((nestedItem) =>
                    this.recursiveBrowseItem(nestedItem, operation)
                ) as any;
            } else if (prop instanceof Object && prop.constructor.prototype instanceof AbstractEntity) {
                item[key as keyof Entity] = this.recursiveBrowseItem(prop as any, operation);
            } else if (isPrimitive(prop)) {
                // console.log(key + " : " + prop);
            } else if (typeof prop === "function") {
                // console.log(key + " : " + prop);
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
            this.setComputedPropsOnItem(item, operation, entityMetadata);
            this.setSubresourcesIriOnItem(item, entityMetadata);
            return sortObjectByKeys(item);
        }
    }

    /**
     * Add recursive left joins to QueryBuilder on exposed props for a given operation with a given entityMetadata
     *
     * @param operation used to get exposed props for this operation
     * @param qb current QueryBuilder
     * @param entityMetadata used to select exposed props & joins relations
     * @param currentPath dot delimited path to keep track of the nesting max depth
     * @param prevProp used to left join further
     */
    private makeJoinFromGroups(
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
                this.makeJoinFromGroups(operation, qb, relation.inverseEntityMetadata, newPath, alias);
            } else if (this.options.shouldMaxDepthReturnRelationPropsId) {
                qb.addSelect(alias + ".id");
            }
        });
    }

    private setComputedPropsOnItem<U extends AbstractEntity>(
        item: U,
        operation: Operation,
        entityMetadata: EntityMetadata
    ) {
        const computedProps = this.mapper.getComputedProps(operation, entityMetadata);

        computedProps.forEach((computed) => {
            const { computedPropMethod, propKey } = getComputedPropMethodAndKey(computed);
            item[propKey as keyof U] = (item[computedPropMethod as keyof U] as any)();
        });
    }

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
