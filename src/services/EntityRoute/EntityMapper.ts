import { EntityMetadata } from "typeorm";

import { Operation } from "@/decorators/Groups";
import { EntityGroupsMetadata } from "./GroupsMetadata/EntityGroupsMetadata";
import { GroupsMetaByRoutes, GroupsMetadata } from "./GroupsMetadata/GroupsMetadata";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";
import { EntityRoute } from "./EntityRoute";
import { AbstractEntity } from "@/entity";
import { MaxDeptMetas } from "@/decorators/MaxDepth";

export class EntityMapper<Entity extends AbstractEntity> {
    private entityRoute: EntityRoute<Entity>;
    private groupsMetas: Record<string, GroupsMetaByRoutes<any>> = {};
    private maxDepthMetas: MaxDeptMetas = {};

    constructor(entityRoute: EntityRoute<Entity>) {
        this.entityRoute = entityRoute;
    }

    get metadata() {
        return this.entityRoute.metadata;
    }

    get options() {
        return this.entityRoute.options;
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
            const hasGlobalMaxDepth = this.options.isMaxDepthEnabledByDefault && currentDepthLvl >= maxDepthLvl;
            const hasLocalClassMaxDepth = maxDepthMeta && (maxDepthMeta.enabled && currentDepthLvl >= maxDepthLvl);
            const hasSpecificPropMaxDepth =
                maxDepthMeta && maxDepthMeta.fields[relation.propertyName] && currentDepthLvl >= maxDepthLvl;

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
}
