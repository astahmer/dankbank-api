import { Connection, EntityMetadata, SelectQueryBuilder, getRepository } from "typeorm";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { Operation } from "@/decorators/Groups";
import { EntityGroupsMetadata } from "./GroupsMetadata/EntityGroupsMetadata";
import { sortObjectByKeys, getComputedPropMethodAndKey, isPrimitive } from "./utils";
import { GroupsMetaByRoutes, GroupsMetadata } from "./GroupsMetadata/GroupsMetadata";
import { MaxDeptMetas } from "@/decorators/MaxDepth";
import { IEntityRouteOptions } from "./EntityRoute";

export class Normalizer {
    private connection: Connection;
    private metadata: EntityMetadata;
    private groupsMetas: Record<string, GroupsMetaByRoutes<any>> = {};
    private maxDepthMetas: MaxDeptMetas = {};
    private options: IEntityRouteOptions;

    constructor(connection: Connection, metadata: EntityMetadata, options?: IEntityRouteOptions) {
        this.connection = connection;
        this.metadata = metadata;
        this.options = options;
    }

    /** Get selects props (from groups) of a given entity for a specific operation */
    public getSelectProps(operation: Operation, entityMetadata: EntityMetadata, withPrefix = true, prefix?: string) {
        return this.getGroupsMetadataFor<EntityGroupsMetadata>(entityMetadata, EntityGroupsMetadata).getSelectProps(
            operation,
            this.metadata,
            withPrefix,
            prefix
        );
    }

    /** Get relation props metas (from groups) of a given entity for a specific operation */
    public getRelationPropsMetas(operation: Operation, entityMetadata: EntityMetadata) {
        return this.getGroupsMetadataFor<EntityGroupsMetadata>(
            entityMetadata,
            EntityGroupsMetadata
        ).getRelationPropsMetas(operation, this.metadata);
    }

    /** Get computed props metas (from groups) of a given entity for a specific operation */
    public getComputedProps(operation: Operation, entityMetadata: EntityMetadata) {
        return this.getGroupsMetadataFor<EntityGroupsMetadata>(entityMetadata, EntityGroupsMetadata).getComputedProps(
            operation,
            this.metadata
        );
    }

    /** Get GroupsMetada of a given entity */
    public getGroupsMetadataFor<G extends GroupsMetadata>(
        entityMetadata: EntityMetadata,
        metaClass: new (metaKey: string, entityOrMeta: EntityMetadata | Function) => G,
        metaKey = "groups"
    ): G {
        if (!this.groupsMetas[metaKey]) {
            this.groupsMetas[metaKey] = {};
        }

        if (!this.groupsMetas[metaKey][entityMetadata.tableName]) {
            this.groupsMetas[metaKey][entityMetadata.tableName] =
                Reflect.getOwnMetadata(metaKey, entityMetadata.target) || new metaClass(metaKey, this.metadata);
        }
        return this.groupsMetas[metaKey][entityMetadata.tableName];
    }

    /**
     * Retrieve collection of entities with only exposed props (from groups)
     *
     * @param operation used to get exposed props for this operation
     * @param qb
     */
    public async getCollection<Entity extends AbstractEntity>(
        operation: Operation,
        qb: SelectQueryBuilder<Entity>,
        aliases: AliasList
    ): Promise<[Entity[], number]> {
        this.makeJoinFromGroups(operation, qb, this.metadata, aliases);

        const results = await qb.getManyAndCount();
        const items = results[0].map((item) => this.recursiveBrowseItem(item, operation));

        return [items, results[1]];
    }

    public async getItem<Entity extends AbstractEntity>(operation: Operation, qb: SelectQueryBuilder<Entity>) {
        this.makeJoinFromGroups(operation, qb, this.metadata, {});

        // console.log(qb.getSql());
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
            } else if (prop instanceof Object && "id" in prop) {
                item[key as keyof Entity] = this.recursiveBrowseItem(prop as any, operation);
            } else if (isPrimitive(prop)) {
                // console.log(key + " : " + prop);
            } else if (typeof prop === "function") {
                // console.log(key + " : " + prop);
            }
        }

        if (this.options.shouldEntityWithOnlyIdBeFlattenedToIri && Object.keys(item).length === 1 && "id" in item) {
            item = item.getIri() as any;
            return item;
        } else {
            this.setComputedPropsOnItem(item, operation, entityMetadata);
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
        aliases: AliasList,
        currentPath?: string,
        prevProp?: string
    ) {
        if (prevProp) {
            const selectProps = this.getSelectProps(operation, entityMetadata, true, prevProp);
            qb.addSelect(selectProps);
        }

        const newPath = (currentPath ? currentPath + "." : "") + entityMetadata.tableName;
        const relationProps = this.getRelationPropsMetas(operation, entityMetadata);

        relationProps.forEach((relation) => {
            const circularProp = this.isRelationPropCircular(
                newPath + "." + relation.inverseEntityMetadata.tableName,
                relation.inverseEntityMetadata,
                relation
            );

            const alias = this.generateAlias(aliases, relation.entityMetadata.tableName, relation.propertyName);
            if (!circularProp || this.options.shouldMaxDepthReturnRelationPropsId) {
                qb.leftJoin((prevProp || relation.entityMetadata.tableName) + "." + relation.propertyName, alias);
            }

            if (!circularProp) {
                this.makeJoinFromGroups(operation, qb, relation.inverseEntityMetadata, aliases, newPath, alias);
            } else if (this.options.shouldMaxDepthReturnRelationPropsId) {
                qb.addSelect(alias + ".id");
            }
        });
    }

    /**
     * Appends a number (of occurences) to a propertName in order to avoid ambiguous sql names
     * @param aliases current list of aliases
     * @param entity add one to the counter on this property name
     * @param propName add one to the counter on this property name
     */
    public generateAlias(aliases: AliasList, entityTableName: string, propName: string) {
        const key = entityTableName + "." + propName;
        aliases[key] = aliases[key] ? aliases[key] + 1 : 1;
        return propName + "_" + aliases[key];
    }

    public getPropertyLastAlias(aliases: AliasList, entityTableName: string, propName: string) {
        const key = entityTableName + "." + propName;
        return propName + "_" + aliases[key];
    }

    /**
     * Checks if this prop/relation entity was already fetched
     * Should stop if this prop/relation entity has a MaxDepth decorator or if it is enabled by default
     *
     * @param currentPath dot delimited path to keep track of the nesting max depth
     * @param entityMetadata
     * @param relation
     */
    public isRelationPropCircular(currentPath: string, entityMetadata: EntityMetadata, relation: RelationMetadata) {
        const currentDepthLvl = currentPath.split(entityMetadata.tableName).length - 1;
        if (currentDepthLvl > 1) {
            // console.log("current: " + currentDepthLvl, entityMetadata.tableName + "." + relation.propertyName);
            const maxDepthMeta = this.getMaxDepthMetaFor(entityMetadata);

            // Most specific maxDepthLvl found (prop > class > global options)
            const maxDepthLvl =
                (maxDepthMeta && maxDepthMeta.fields[relation.inverseSidePropertyPath]) ||
                (maxDepthMeta && maxDepthMeta.depthLvl) ||
                this.options.defaultMaxDepthLvl;

            // Checks for global option, class & prop decorator
            const hasGlobalMaxDepth = this.options.isMaxDepthEnabledByDefault && currentDepthLvl > maxDepthLvl;
            const hasLocalClassMaxDepth = maxDepthMeta && (maxDepthMeta.enabled && currentDepthLvl > maxDepthLvl);
            const hasSpecificPropMaxDepth =
                maxDepthMeta && maxDepthMeta.fields[relation.propertyName] && currentDepthLvl > maxDepthLvl;

            // Should stop getting nested relations ?
            if (hasGlobalMaxDepth || hasLocalClassMaxDepth || hasSpecificPropMaxDepth) {
                return { prop: relation.propertyName, value: "CIRCULAR lvl: " + currentDepthLvl };
            }
        }

        return null;
    }

    /** Retrieve & store entity maxDepthMeta for each entity */
    private getMaxDepthMetaFor(entityMetadata: EntityMetadata) {
        if (!this.maxDepthMetas[entityMetadata.tableName]) {
            this.maxDepthMetas[entityMetadata.tableName] = Reflect.getOwnMetadata("maxDepth", entityMetadata.target);
        }
        return this.maxDepthMetas[entityMetadata.tableName];
    }

    private setComputedPropsOnItem<U extends AbstractEntity>(
        item: U,
        operation: Operation,
        entityMetadata: EntityMetadata
    ) {
        const computedProps = this.getComputedProps(operation, entityMetadata);

        computedProps.forEach((computed) => {
            const { computedPropMethod, propKey } = getComputedPropMethodAndKey(computed);
            item[propKey as keyof U] = (item[computedPropMethod as keyof U] as any)();
        });
    }
}

export type AliasList = Record<string, number>;
