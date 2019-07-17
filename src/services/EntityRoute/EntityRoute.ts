import * as Koa from "koa";
import * as Router from "koa-router";
import { Connection, EntityMetadata, Repository, getRepository, ObjectType } from "typeorm";

import {
    IRouteMetadatas,
    Operation,
    IMapping,
    IMappingItem,
    IActionParams,
    RouteActions,
    IMaxDeptMetas,
} from "./types";
import { mergeWith, concat, path, pluck } from "ramda";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";
import { AbstractEntity } from "../../entity/AbstractEntity";
import { GroupsMeta, RouteGroups, OperationGroups } from "../../decorators/Groups";

export interface IEntityRouteOptions {
    isMaxDepthEnabledByDefault: boolean;
}

type EntityProp<U> = Array<keyof U>;

export class EntityRouter<T extends AbstractEntity> {
    private connection: Connection;
    private repository: Repository<T>;
    private routeMetadatas: IRouteMetadatas;
    private metadata: EntityMetadata;
    private actions: RouteActions;
    private mapping: IMapping;
    private options: IEntityRouteOptions;
    private groups: RouteGroups;
    private maxDepthMetas: IMaxDeptMetas = {};
    private onlyExposeIdMetas: any = {};

    constructor(connection: Connection, entity: ObjectType<T>, options?: IEntityRouteOptions) {
        this.connection = connection;
        this.routeMetadatas = Reflect.getOwnMetadata("route", entity);
        this.repository = getRepository(entity);
        this.metadata = this.repository.metadata;
        this.options = options;
        this.groups = {};

        this.actions = {
            create: {
                path: "",
                verb: "post",
                method: "create",
            },
            list: {
                path: "",
                verb: "get",
                method: "getList",
            },
            details: {
                path: "/:id(\\d+)",
                verb: "get",
                method: "getDetails",
            },
            update: {
                path: "/:id(\\d+)",
                verb: "put",
                method: "update",
            },
            delete: {
                path: "/:id(\\d+)",
                verb: "remove",
                method: "delete",
            },
        };
    }

    /**
     * Make a Koa Router with given operations for this entity and return it
     *
     * @returns Koa.Router
     */
    public makeRouter() {
        const router = new Router();

        for (let i = 0; i < this.routeMetadatas.operations.length; i++) {
            const operation = this.routeMetadatas.operations[i];
            const verb = this.actions[operation].verb;
            const path = this.routeMetadatas.path + this.actions[operation].path;

            const responseMethod = this.makeResponseMethod(operation);
            const mappingMethod = this.makeMappingMethod(operation);

            (<any>router)[verb](path, responseMethod);
            (<any>router)[verb](path + "/mapping", mappingMethod);
        }

        return router;
    }

    /**
     * Get groups metadata for a given entity and merge it with every inherited entity's groups
     * Also merge global groups (GroupsMeta.all) with route specific groups (GroupsMeta.route)
     *
     * @param target Entity class from which the groups metadata will be retrieved
     * @returns an object with every operations as key and an array of props associated to an operation as value
     */
    private getMergedGroupsMetadata(target: string | Function): OperationGroups {
        const meta: GroupsMeta = Reflect.getOwnMetadata("groups", target);
        if (!meta) {
            return;
        }

        const routeGroups = meta.routes && meta.routes[this.metadata.tableName];
        let groups;
        if (meta.all && routeGroups) {
            groups = mergeWith(concat, meta.all, routeGroups);
        } else {
            groups = meta.all || routeGroups;
        }

        return groups;
    }

    /**
     * Get exposed props (from groups) for a given entity (using its EntityMetadata)
     * @param operation
     * @param entityMetadata
     *
     * @returns an array of (the given entity's) props
     */
    private getExposedProps<U extends AbstractEntity>(
        operation: Operation,
        entityMetadata: EntityMetadata
    ): EntityProp<U> {
        let groups;
        if (!this.groups[entityMetadata.tableName] || !this.groups[entityMetadata.tableName][operation]) {
            groups = this.getMergedGroupsMetadata(entityMetadata.target);
            let i = 1,
                parentGroups;
            for (i; i < entityMetadata.inheritanceTree.length; i++) {
                parentGroups = this.getMergedGroupsMetadata(entityMetadata.inheritanceTree[i]);

                if (parentGroups) {
                    groups = mergeWith(concat, groups, parentGroups);
                }
            }
            this.groups[entityMetadata.tableName] = groups;
        } else {
            groups = this.groups[entityMetadata.tableName];
        }

        return groups && groups[operation];
    }

    /**
     * Retrieve exposed nested props in array of entities
     *
     * @param items entities
     * @param operation
     * @param entityMetadata
     * @param currentPath dot delimited path to keep track of the properties select nesting
     *
     * @returns items with nested props
     */
    private async retrieveNestedPropsInCollection<U extends AbstractEntity>(
        items: U[],
        operation: Operation,
        entityMetadata: EntityMetadata,
        currentPath: string
    ): Promise<U[]> {
        const promises = items.map((item) =>
            this.retrieveNestedPropsInItem<U>(item, operation, entityMetadata, currentPath)
        );
        return Promise.all(promises);
    }

    /**
     * Retrieve mapping at current path
     *
     * @param currentPath dot delimited path to keep track of the properties select nesting
     */
    private getMappingAt(currentPath: string, mapping: IMapping): IMappingItem {
        const currentPathArray = currentPath
            .split(".")
            .join(".mapping.")
            .split(".");
        return path(currentPathArray, mapping);
    }

    /**
     * Retrieve & set mapping from exposed/relations props of an entity
     *
     * @param mapping object that will be recursively written into
     * @param operation
     * @param currentPath
     * @param relation
     */
    private setMappingForRelation(
        mapping: IMapping,
        operation: Operation,
        currentPath: string,
        relation: RelationMetadata
    ) {
        const entityPropPath = this.getMappingAt(currentPath, mapping);

        if (!entityPropPath.mapping[relation.inverseEntityMetadata.tableName]) {
            const exposedProps = this.getExposedProps(operation, relation.inverseEntityMetadata);
            const { relationProps } = this.getPropsByType(exposedProps, relation.inverseEntityMetadata);

            entityPropPath.mapping[relation.inverseEntityMetadata.tableName] = {
                exposedProps,
                relationProps: pluck("propertyName", relationProps),
                mapping: {},
            };

            for (let i = 0; i < relationProps.length; i++) {
                const circularProp = this.isCircular(currentPath, relationProps[i].entityMetadata, relation);
                if (circularProp) {
                    continue;
                }

                this.setMappingForRelation(
                    mapping,
                    operation,
                    currentPath + "." + relationProps[i].entityMetadata.tableName,
                    relationProps[i]
                );
            }
        }

        return entityPropPath.mapping[relation.inverseEntityMetadata.tableName];
    }

    /**
     * Retrieve & store entity maxDepthMeta in memory
     * @param entityMetadata
     */
    private getMaxDepthMetaFor(entityMetadata: EntityMetadata) {
        if (!this.maxDepthMetas || !this.maxDepthMetas[entityMetadata.tableName]) {
            this.maxDepthMetas[entityMetadata.tableName] = Reflect.getOwnMetadata("maxDepth", entityMetadata.target);
        }
        return this.maxDepthMetas[entityMetadata.tableName];
    }

    /**
     * Check if @ExposeId decorator was added on given relationProp
     * @param entityMetadata
     */
    private doesRelationOnlyExposeId(entityMetadata: EntityMetadata, propName: string) {
        if (!this.onlyExposeIdMetas || !this.onlyExposeIdMetas[entityMetadata.tableName]) {
            this.onlyExposeIdMetas[entityMetadata.tableName] = Reflect.getOwnMetadata(
                "onlyExposeId",
                entityMetadata.target
            );
        }
        return (
            this.onlyExposeIdMetas[entityMetadata.tableName] &&
            this.onlyExposeIdMetas[entityMetadata.tableName][propName]
        );
    }

    /**
     * Checks if this prop/relation entity was already fetched
     * Should stop if this prop/relation entity has a MaxDepth decorator or if it is enabled by default
     *
     * @param currentPath
     * @param entityMetadata
     * @param relation
     */
    private isCircular(currentPath: string, entityMetadata: EntityMetadata, relation: RelationMetadata) {
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

    /**
     * Retrieve exposed (from its groups meta) nested props of an entity
     *
     * @param item entity
     * @param operation
     * @param entityMetadata
     * @param currentPath dot delimited path to keep track of the properties select nesting
     *
     * @returns item with nested props
     */
    private async retrieveNestedPropsInItem<U extends AbstractEntity>(
        item: U,
        operation: Operation,
        entityMetadata: EntityMetadata,
        currentPath: string
    ) {
        const { relationProps } = this.getPropsByType(this.getExposedProps(operation, entityMetadata), entityMetadata);
        if (!relationProps.length) {
            return item;
        }

        const propPromises = relationProps.map(async (relation) => {
            const circularProp = this.isCircular(currentPath, entityMetadata, relation);
            if (circularProp) {
                return circularProp;
            }

            if (this.doesRelationOnlyExposeId(relation.entityMetadata, relation.propertyName)) {
                const propResult = await this.getRelationProps(
                    [relation.inverseEntityMetadata.tableName + ".id"],
                    relation,
                    item
                );
                return { prop: relation.propertyName, value: propResult };
            }

            const localPropPath = currentPath + "." + relation.inverseEntityMetadata.tableName;
            let propResult = (await this.getExposedPropsInRelationProp(operation, relation, item)) || null;
            const isArray = Array.isArray(propResult);

            if (relation.isManyToOne) {
                propResult = propResult[relation.propertyName];
            } else if (relation.isManyToMany && relation.inverseRelation) {
                propResult = propResult.map((el: any) => el[relation.propertyName])[0];
            }

            if (isArray && propResult.length) {
                // Prop is a collection relation
                propResult = await this.retrieveNestedPropsInCollection(
                    propResult,
                    operation,
                    relation.inverseEntityMetadata,
                    localPropPath
                );
            } else if (!isArray && propResult instanceof Object && propResult) {
                // Prop is a (single) relation
                propResult = await this.retrieveNestedPropsInItem(
                    propResult,
                    operation,
                    relation.inverseEntityMetadata,
                    localPropPath
                );
            }

            // Prop is a primitive type, not a relation
            return { prop: relation.propertyName, value: propResult };
        });

        // Set entity's props to each propResults
        const propResults = await Promise.all(propPromises);
        propResults.forEach((result) => (item[result.prop as keyof U] = result.value));
        return item;
    }

    /**
     * Split exposed props in 2 lists : selectsProps which are primitive types props & relationProps which are others entities embedded
     *
     * @param exposedProps props to filter
     * @param entityMeta meta to check for relations in
     *
     * @returns obj with both lists (selectProps & relationProps)
     */
    private getPropsByType(exposedProps: string[], entityMeta: EntityMetadata) {
        const selectProps: string[] = [];
        const relationProps: RelationMetadata[] = [];

        exposedProps.forEach((prop: string) => {
            const relation = entityMeta.relations.find((relation) => relation.propertyName === prop);
            if (relation) {
                relationProps.push(relation);
            } else {
                selectProps.push(entityMeta.tableName + "." + prop);
            }
        });

        return { selectProps, relationProps };
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
        const { selectProps } = this.getPropsByType(
            this.getExposedProps(operation, relation.inverseEntityMetadata),
            relation.inverseEntityMetadata
        );
        return this.getRelationProps(selectProps, relation, item);
    }

    /**
     * Retrieve given props from a relation
     * no matter its type (OneToOne, OneToMany, ManyToOne, ManyToMany) and no matter if uni/bi-directionnal
     *
     * @param selectProps
     * @param relation meta
     * @param item that owns the relation
     */
    private getRelationProps<U extends AbstractEntity>(selectProps: string[], relationMeta: RelationMetadata, item: U) {
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

    private async create({ values }: IActionParams) {
        return this.repository
            .createQueryBuilder()
            .insert()
            .into(this.repository.metadata.tableName)
            .values(values)
            .execute();
    }

    private async getList({
        operation,
        exposedProps,
    }: {
        operation: Operation;
        exposedProps: string[];
    }): Promise<[T[], number]> {
        const qb = this.repository.createQueryBuilder(this.metadata.tableName);
        const { selectProps, relationProps } = this.getPropsByType(exposedProps, this.metadata);
        qb.select(selectProps);
        const baseItems = await qb.getManyAndCount();

        this.mapping = {
            [this.metadata.tableName]: {
                exposedProps,
                relationProps: pluck("propertyName", relationProps),
                mapping: {},
            },
        };
        const items = await this.retrieveNestedPropsInCollection(
            baseItems[0],
            operation,
            this.metadata,
            this.metadata.tableName
        );

        return [items, baseItems[1]];
    }

    private async getDetails({
        operation,
        exposedProps,
    }: {
        operation: Operation;
        exposedProps: string[];
    }): Promise<[T, number]> {
        const qb = this.repository.createQueryBuilder(this.metadata.tableName);
        const { selectProps, relationProps } = this.getPropsByType(exposedProps, this.metadata);
        qb.select(selectProps);
        const baseItem = await qb.getOne();

        if (!baseItem) {
            return [null, 0];
        }

        this.mapping = {
            [this.metadata.tableName]: {
                exposedProps,
                relationProps: pluck("propertyName", relationProps),
                mapping: {},
            },
        };
        const item = await this.retrieveNestedPropsInItem(baseItem, operation, this.metadata, this.metadata.tableName);

        return [item, 1];
    }

    private async update({ values, entityId }: IActionParams) {
        return this.repository
            .createQueryBuilder()
            .insert()
            .update(this.repository.metadata.tableName)
            .set(values)
            .where(`${this.repository.metadata.tableName}.id = :id`, { id: entityId })
            .execute();
    }

    private async delete({ entityId }: IActionParams) {
        return this.repository
            .createQueryBuilder()
            .delete()
            .from(this.repository.metadata.target)
            .where("id = :id", { id: entityId })
            .execute();
    }

    private makeResponseMethod(operation: Operation): Koa.Middleware {
        const exposedProps = this.getExposedProps(operation, this.metadata);

        return async (ctx, next) => {
            const isUpserting = (ctx.method === "POST" || ctx.method === "PUT") && ctx.request.body;
            const params: IActionParams = {
                operation,
                exposedProps,
                ...(ctx.params.id && { entityId: ctx.params.id }),
                ...(isUpserting && { values: ctx.request.body }),
            };

            const method = this.actions[operation].method;
            const result = await this[method](params);

            let items, totalItems;
            // if (!isUpserting) {
            //     [items, totalItems] = result;
            // } else {
            //     items = [result];
            //     totalItems = 1;
            // }

            ctx.body = {
                context: {
                    operation,
                    entity: this.metadata.tableName,
                },
                items,
                totalItems,
                result,
                mapping: this.mapping,
            };
            next();
        };
    }

    private makeMappingMethod(operation: Operation): Koa.Middleware {
        const exposedProps = this.getExposedProps(operation, this.metadata);

        return async (ctx, next) => {
            const { relationProps } = this.getPropsByType(exposedProps, this.metadata);
            const mapping = {
                [this.metadata.tableName]: {
                    exposedProps,
                    relationProps: pluck("propertyName", relationProps),
                    mapping: {},
                },
            };

            for (let i = 0; i < relationProps.length; i++) {
                this.setMappingForRelation(mapping, operation, this.metadata.tableName, relationProps[i]);
            }

            ctx.body = {
                context: {
                    operation: operation + ".mapping",
                    entity: this.metadata.tableName,
                },
                mapping,
            };
            next();
        };
    }
}
