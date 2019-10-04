import Router = require("koa-router");
import { SelectQueryBuilder } from "typeorm";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { EntityRoute, getRouteSubresourcesMetadata } from "./EntityRoute";
import { entityRoutesContainer } from ".";
import { CRUD_ACTIONS } from "./ResponseManager";

export class SubresourceManager<Entity extends AbstractEntity> {
    private subresourcesMeta: RouteSubresourcesMeta<Entity>;

    get metadata() {
        return this.entityRoute.repository.metadata;
    }
    get routeMetadata() {
        return this.entityRoute.routeMetadata;
    }
    get aliasManager() {
        return this.entityRoute.aliasManager;
    }

    constructor(private entityRoute: EntityRoute<Entity>) {
        this.subresourcesMeta = getRouteSubresourcesMetadata(entityRoute.repository.metadata.target as Function);
    }

    /** Recursively add subresources routes for this entity */
    public makeSubresourcesRoutes(
        router: Router,
        nestedPath?: { current: string[]; parent: string; maxDepths?: number[] }
    ) {
        if (!Object.keys(this.subresourcesMeta.properties).length) {
            return;
        }

        // For each subresources of this entity
        for (let key in this.subresourcesMeta.properties) {
            const subresourceProp = this.subresourcesMeta.properties[key];
            const subresourceRelation = this.getSubresourceRelation(key);
            const subresourcePath = this.getSubresourceBasePath(
                subresourceRelation.param,
                subresourceProp,
                nestedPath && nestedPath.parent
            );

            const relationTableName = subresourceRelation.relation.inverseEntityMetadata.tableName;
            const nestedEntityRoute = entityRoutesContainer[subresourceProp.entityTarget.name];

            // If subresource entity has no EntityRoute, then it can't make a subresource out of it
            if (!nestedEntityRoute) {
                continue;
            }

            // Add one to also count root subresource
            const currentDepth = 1 + (nestedPath ? nestedPath.current.length : 0);

            // Checks for every max depth of every subresources including this one
            const hasReachedMaxDepth = nestedPath
                ? nestedPath.maxDepths.some((maxDepth) => currentDepth >= maxDepth)
                : currentDepth >= subresourceProp.maxDepth;

            const isSubresourceCircular = nestedPath && nestedPath.current.includes(relationTableName);

            // Ensures that it is not making circular subresources routes & that maxDepth isn't reached
            if (!hasReachedMaxDepth && !isSubresourceCircular) {
                // Recursively make subresources
                nestedEntityRoute.subresourceManager.makeSubresourcesRoutes(router, {
                    parent: subresourcePath,
                    current: nestedPath ? nestedPath.current.concat(relationTableName) : [relationTableName],
                    maxDepths: nestedPath ? nestedPath.maxDepths.concat(currentDepth) : [currentDepth],
                });
            }

            const isSubresourceSingle =
                subresourceRelation.relation.isOneToOne || subresourceRelation.relation.isManyToOne;

            // Generates details endpoint at subresourcePath
            if (isSubresourceSingle && subresourceProp.operations.includes("details")) {
                subresourceProp.operations.forEach((operation) => {
                    (<any>router)[CRUD_ACTIONS[operation].verb](
                        subresourcePath,
                        nestedEntityRoute.responseManager.makeResponseMethod(operation, subresourceRelation)
                    );
                });

                continue;
            }

            // Generates endpoint at subresourcePath for each operation
            subresourceProp.operations.forEach((operation) => {
                (<any>router)[CRUD_ACTIONS[operation].verb](
                    subresourcePath + CRUD_ACTIONS[operation].path,
                    nestedEntityRoute.responseManager.makeResponseMethod(operation, subresourceRelation)
                );
            });
        }
    }

    /** Joins a subresource on its inverse side property */
    public joinSubresourceOnInverseSide(qb: SelectQueryBuilder<Entity>, subresourceRelation: SubresourceRelation) {
        const alias = this.aliasManager.generate(
            this.metadata.tableName,
            subresourceRelation.relation.inverseSidePropertyPath
        );

        qb.innerJoin(
            this.metadata.tableName + "." + subresourceRelation.relation.inverseSidePropertyPath,
            alias,
            alias + ".id = :parentId",
            { parentId: subresourceRelation.id }
        );
    }

    /** Retrieve informations on a subresource relation */
    private getSubresourceRelation(key: string) {
        const parentDetailsParam = ((this.subresourcesMeta.parent as any) as Function).name + "Id";
        const relationMeta = this.metadata.findRelationWithPropertyPath(key);
        return {
            param: parentDetailsParam,
            propertyName: key,
            relation: relationMeta,
        };
    }

    /** Returns a (nested?) subresource base path (= without operation suffix)  */
    private getSubresourceBasePath(param: string, subresourceProp: SubresourceProperty<any>, parentPath?: string) {
        const parentDetailsPath = CRUD_ACTIONS.details.path.replace(":id", ":" + param);
        return (parentPath || this.routeMetadata.path) + parentDetailsPath + "/" + subresourceProp.path;
    }
}

export type SubresourceOperation = "create" | "list" | "details";
export type SubresourceProperty<Entity extends AbstractEntity> = {
    /** The route path for this action */
    path: string;
    /** List of operations to create a subresource route for */
    operations: SubresourceOperation[];
    /** Subresource entity, used to retrieve its EntityRoute */
    entityTarget: Entity;
    /** Max depth of a subresource property : Limit the number of times a subresource can have another */
    maxDepth: number;
};
export type RouteSubresourcesMeta<ParentEntity extends AbstractEntity> = {
    parent: ParentEntity;
    properties: Record<string, SubresourceProperty<any>>;
};
/** Subresource relation with parent, used to auto-join on this entity's relation inverse side */
export type SubresourceRelation = {
    /** Subresource parent's entity id */
    id?: number;
    /** Route path parameter key, for example "userId" where the route path is "/users/:userId" */
    param: string;
    /** Subresource parent relation property name */
    propertyName: string;
    /** Subresource parent relationMeta */
    relation: RelationMetadata;
};