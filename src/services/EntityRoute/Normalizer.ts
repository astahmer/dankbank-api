import { Connection, EntityMetadata } from "typeorm";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { Operation } from "@/decorators/Groups";
import { EntityGroupsMetadata } from "./GroupsMetadata/EntityGroupsMetadata";
import { sortObjectByKeys, getComputedPropMethodAndKey } from "./utils";
import { GroupsMetaByRoutes } from "./GroupsMetadata/GroupsMetadata";
import { MaxDeptMetas } from "@/decorators/MaxDepth";
import { IEntityRouteOptions } from "./EntityRoute";

export class Normalizer {
    private connection: Connection;
    private metadata: EntityMetadata;
    private groupsMetas: GroupsMetaByRoutes<EntityGroupsMetadata> = {};
    private maxDepthMetas: MaxDeptMetas = {};
    private options: IEntityRouteOptions;

    constructor(connection: Connection, metadata: EntityMetadata, options?: IEntityRouteOptions) {
        this.connection = connection;
        this.metadata = metadata;
        this.options = options;
    }

    /** Get selects props (from groups) of a given entity for a specific operation */
    public getSelectProps(operation: Operation, entityMetadata: EntityMetadata, withPrefix = true) {
        return this.getGroupsMetadataFor(entityMetadata).getSelectProps(operation, this.metadata, withPrefix);
    }

    /** Get relation props metas (from groups) of a given entity for a specific operation */
    public getRelationPropsMetas(operation: Operation, entityMetadata: EntityMetadata) {
        return this.getGroupsMetadataFor(entityMetadata).getRelationPropsMetas(operation, this.metadata);
    }

    /** Get computed props metas (from groups) of a given entity for a specific operation */
    public getComputedProps(operation: Operation, entityMetadata: EntityMetadata) {
        return this.getGroupsMetadataFor(entityMetadata).getComputedProps(operation, this.metadata);
    }

    /** Get EntityGroupsMetada of a given entity */
    private getGroupsMetadataFor(entityMetadata: EntityMetadata): EntityGroupsMetadata {
        if (!this.groupsMetas[entityMetadata.tableName]) {
            this.groupsMetas[entityMetadata.tableName] =
                Reflect.getOwnMetadata("groups", entityMetadata.target) ||
                new EntityGroupsMetadata("groups", this.metadata);
        }
        return this.groupsMetas[entityMetadata.tableName];
    }

    /**
     * Retrieve exposed nested props in array of entities & set them on given items
     *
     * @param items entities
     * @param operation used to get exposed props for this operation
     * @param entityMetadata used to get exposed props for this entity
     * @param currentPath dot delimited path to keep track of the nesting max depth
     *
     * @returns items with nested props
     */
    public async setNestedExposedPropsInCollection<U extends AbstractEntity>(
        items: U[],
        operation: Operation,
        entityMetadata: EntityMetadata,
        currentPath: string
    ): Promise<U[]> {
        const promises = items.map((item) =>
            this.setNestedExposedPropsOnItem<U>(item, operation, entityMetadata, currentPath)
        );
        return Promise.all(promises);
    }

    /**
     * Retrieve exposed (from its groups meta) nested props of an entity & set them on given item
     *
     * @param item entity
     * @param operation used to get exposed props for this operation
     * @param entityMetadata used to get exposed props for this entity
     * @param currentPath dot delimited path to keep track of the nesting max depth
     *
     * @returns item with nested props
     */
    public async setNestedExposedPropsOnItem<U extends AbstractEntity>(
        item: U,
        operation: Operation,
        entityMetadata: EntityMetadata,
        currentPath: string
    ) {
        this.setComputedPropsOnItem(item, operation, entityMetadata);

        const relationProps = this.getRelationPropsMetas(operation, entityMetadata);
        if (!relationProps.length) {
            return sortObjectByKeys(item);
        }

        await this.setRelationPropsForItem(item, operation, entityMetadata, currentPath, relationProps);
        return sortObjectByKeys(item);
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

            // Should stop getting nested relations ?
            if (
                this.options.isMaxDepthEnabledByDefault ||
                (maxDepthMeta && (currentDepthLvl > maxDepthMeta.fields[relation.propertyName] || maxDepthMeta.enabled))
            ) {
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

    private unwrapRelationResult(propResult: any, relation: RelationMetadata) {
        if (relation.isManyToOne) {
            propResult = propResult[relation.propertyName];
        } else if (relation.isManyToMany && relation.inverseRelation) {
            propResult = propResult.map((el: any) => el[relation.propertyName])[0];
        }

        return propResult;
    }

    private unwrapPropResultWithIri(item: any) {
        if (Array.isArray(item)) {
            item = item.map((item) => item.getIri());
        } else {
            item = item.getIri();
        }

        return item;
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

    /** Returns an IRI corresponding to a relationProp */
    private async getRelationPropAsIri<U extends AbstractEntity>(item: U, relation: RelationMetadata) {
        const propResult = await this.getSelectedPropsOfRelation(
            [relation.inverseEntityMetadata.tableName + ".id"],
            relation,
            item
        );

        return this.unwrapPropResultWithIri(this.unwrapRelationResult(propResult, relation));
    }

    /**
     * Get a relationProp for an item
     * Return value is either an IRI or a nested entity/collection on entities with only exposed props from groups on a specific rotue context
     * @param item
     * @param operation
     * @param entityMetadata
     * @param currentPath
     * @param relation
     */
    private async getRelationPropForItem<U extends AbstractEntity>(
        item: U,
        operation: Operation,
        entityMetadata: EntityMetadata,
        currentPath: string,
        relation: RelationMetadata
    ) {
        const circularProp = this.isRelationPropCircular(currentPath, entityMetadata, relation);
        if (circularProp) {
            if (this.options.shouldMaxDepthReturnRelationPropsIri) {
                return { prop: relation.propertyName, value: await this.getRelationPropAsIri(item, relation) };
            } else {
                return circularProp;
            }
        }

        let propResult = await this.getExposedPropsInRelationProp(operation, relation, item);
        propResult = this.unwrapRelationResult(propResult, relation);

        if (!propResult || (Array.isArray(propResult) && !propResult.length)) {
            return { prop: relation.propertyName, value: propResult || null };
        }

        if (Array.isArray(propResult)) {
            // Prop is a collection relation
            propResult = await this.setNestedExposedPropsInCollection(
                propResult,
                operation,
                relation.inverseEntityMetadata,
                currentPath + "." + relation.inverseEntityMetadata.tableName
            );
        } else if (propResult instanceof Object) {
            // Prop is a (single) relation
            propResult = await this.setNestedExposedPropsOnItem(
                propResult,
                operation,
                relation.inverseEntityMetadata,
                currentPath + "." + relation.inverseEntityMetadata.tableName
            );
        }

        // Prop is a primitive type, not a relation
        return { prop: relation.propertyName, value: propResult };
    }

    private async setRelationPropsForItem<U extends AbstractEntity>(
        item: U,
        operation: Operation,
        entityMetadata: EntityMetadata,
        currentPath: string,
        relationProps: RelationMetadata[]
    ) {
        const propPromises = relationProps.map(async (relation) =>
            this.getRelationPropForItem(item, operation, entityMetadata, currentPath, relation)
        );

        // Set entity's props to each propResults
        const propResults = await Promise.all(propPromises);
        propResults.forEach((result) => (item[result.prop as keyof U] = result.value));
    }

    /**
     * Retrieve exposed props of an entity's relationProp on a given operation (using its groups),
     * no matter its type (OneToOne, OneToMany, ManyToOne, ManyToMany) and no matter if uni/bi-directionnal
     *
     * @param operation
     * @param relation meta
     * @param item that owns the relation
     */
    private getExposedPropsInRelationProp<U extends AbstractEntity>(
        operation: Operation,
        relation: RelationMetadata,
        item: U
    ) {
        const selectProps = this.getSelectProps(operation, relation.inverseEntityMetadata);
        return this.getSelectedPropsOfRelation(selectProps, relation, item);
    }

    /**
     * Retrieve given props from a relation
     * no matter its type (OneToOne, OneToMany, ManyToOne, ManyToMany) and no matter if uni/bi-directionnal
     *
     * @param selectProps
     * @param relation meta
     * @param item that owns the relation
     */
    private getSelectedPropsOfRelation<U extends AbstractEntity>(
        selectProps: string[],
        relationMeta: RelationMetadata,
        item: U
    ): Promise<U> | Promise<U[]> {
        const qb = this.connection.createQueryBuilder();

        const inverse = relationMeta.inverseEntityMetadata;
        const owner = relationMeta.entityMetadata;
        const relationInversedBy = relationMeta.inverseSidePropertyPath;

        if (relationMeta.isOneToMany) {
            qb.select(selectProps)
                .from(inverse.target, inverse.tableName)
                .where(inverse.tableName + "." + relationInversedBy + "Id = :id", { id: item.id });

            // console.log(qb.getSql());
            return qb.getMany();
        } else if (relationMeta.isOneToOne) {
            // Bi-directionnal
            if (relationInversedBy) {
                qb.select(selectProps)
                    .from(inverse.target, inverse.tableName)
                    .leftJoin(inverse.tableName + "." + relationInversedBy, owner.tableName)
                    .where(owner.tableName + ".id = :id", { id: item.id });
            } else {
                if (relationMeta.isOneToOneOwner) {
                    qb.select(selectProps)
                        .from(inverse.target, inverse.tableName)
                        .where((qb) => {
                            const subQuery = qb
                                .subQuery()
                                .select([relationMeta.joinColumns[0].databaseName])
                                .from(owner.target, owner.tableName)
                                .where(owner.tableName + ".id = :id", { id: item.id })
                                .getQuery();
                            return inverse.tableName + ".id = " + subQuery;
                        });
                } else {
                    qb.select(selectProps)
                        .from(inverse.target, inverse.tableName)
                        .where(owner.tableName + "Id = :id", { id: item.id });
                }
            }

            // console.log(qb.getSql());
            return qb.getOne();
        } else if (relationMeta.isManyToMany) {
            // Bi-directionnal
            if (relationInversedBy) {
                selectProps.push(owner.tableName + ".id");
                qb.select(selectProps)
                    .from(owner.target, owner.tableName)
                    .leftJoin(owner.tableName + "." + relationMeta.propertyName, inverse.tableName)
                    .where(owner.tableName + ".id = :id", { id: item.id });
            } else {
                const junction = relationMeta.junctionEntityMetadata;
                qb.select(selectProps)
                    .from(inverse.target, inverse.tableName)
                    .where((qb) => {
                        const subQuery = qb
                            .subQuery()
                            .select(
                                junction.tableName + "." + relationMeta.junctionEntityMetadata.columns[0].propertyName
                            )
                            .from(relationMeta.junctionEntityMetadata.target, junction.tableName)
                            .where(owner.tableName + "Id = :id", { id: item.id })
                            .getQuery();
                        return inverse.tableName + ".id IN " + subQuery;
                    });
            }

            // console.log(qb.getSql());
            return qb.getMany();
        } else if (relationMeta.isManyToOne) {
            selectProps.push(owner.tableName + ".id");
            qb.select(selectProps)
                .from(owner.target, owner.tableName)
                .leftJoin(owner.tableName + "." + relationMeta.propertyName, inverse.tableName)
                .where(owner.tableName + ".id = :id", { id: item.id });

            // console.log(qb.getSql());
            return qb.getOne();
        }
    }
}
