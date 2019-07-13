import * as Koa from "koa";
import * as Router from "koa-router";
import { Connection, EntityMetadata, Repository, getRepository, ObjectType } from "typeorm";

import {
    IRouteMetadatas,
    Operation,
    EntityRouteGroups,
    IMapping,
    IMappingItem,
    IActionParams,
    RouteActions,
} from "./types";
import { mergeWith, concat, path, pluck } from "ramda";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";
import { AbstractEntity } from "../../entity/AbstractEntity";

export class EntityRouter<T extends AbstractEntity> {
    private connection: Connection;
    private repository: Repository<T>;
    private routeMetadatas: IRouteMetadatas;
    private metadata: EntityMetadata;
    private actions: RouteActions;
    private mapping: IMapping;

    constructor(connection: Connection, entity: ObjectType<T>) {
        this.connection = connection;
        this.routeMetadatas = Reflect.getOwnMetadata("route", entity);
        this.repository = getRepository(entity);
        this.metadata = this.repository.metadata;

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
                path: "/:id",
                verb: "get",
                method: "getItem",
            },
            update: {
                path: "/:id",
                verb: "put",
                method: "update",
            },
            delete: {
                path: "/:id",
                verb: "remove",
                method: "delete",
            },
        };
    }

    public makeRouter() {
        const router = new Router();

        for (let i = 0; i < this.routeMetadatas.operations.length; i++) {
            const operation = this.routeMetadatas.operations[i];
            const verb = this.actions[operation].verb;
            const path = this.routeMetadatas.path + this.actions[operation].path;

            const responseMethod = this.makeResponseMethod(operation);
            (<any>router)[verb](path, responseMethod);
        }

        return router;
    }

    private getExposedProps(operation: Operation, entityMetadata: EntityMetadata) {
        let groups: EntityRouteGroups = Reflect.getOwnMetadata("groups", entityMetadata.target);
        for (let i = 1; i < entityMetadata.inheritanceTree.length; i++) {
            groups = mergeWith(concat, groups, Reflect.getOwnMetadata("groups", entityMetadata.inheritanceTree[i]));
        }

        return groups && groups[operation];
    }

    private async retrieveNestedPropsInCollection<U extends AbstractEntity>(
        items: U[],
        operation: Operation,
        entityMetadata: EntityMetadata,
        currentPath: string
    ): Promise<U[]> {
        const promises = items.map((item) =>
            this.retrieveNestedPropsInItem<U>(item, operation, entityMetadata, currentPath)
        );
        return await Promise.all(promises);
    }

    private getMappingAt(currentPath: string): IMappingItem {
        const currentPathArray = currentPath
            .split(".")
            .join(".mapping.")
            .split(".");
        return path(currentPathArray, this.mapping);
    }

    private setMappingAt(operation: Operation, currentPath: string, relation: RelationMetadata) {
        const entityPropPath = this.getMappingAt(currentPath);

        if (!entityPropPath.mapping[relation.inverseEntityMetadata.tableName]) {
            const exposedProps = this.getExposedProps(operation, relation.inverseEntityMetadata);
            const { relationProps } = this.getPropsByType(exposedProps, relation.inverseEntityMetadata);

            entityPropPath.mapping[relation.inverseEntityMetadata.tableName] = {
                exposedProps,
                relationProps: pluck("propertyName", relationProps),
                mapping: {},
            };
        }
    }

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
            this.setMappingAt(operation, currentPath, relation);

            const isCircular = currentPath.indexOf(relation.inverseEntityMetadata.tableName) !== -1;
            if (isCircular) {
                // console.log("circular in " + entityMetadata.tableName + "." + relation.propertyName);
                return { prop: relation.propertyName, value: "CIRCULAR" };
            }

            const localPropPath = currentPath + "." + relation.inverseEntityMetadata.tableName;
            let propResult = (await this.getNestedRelationProp(operation, relation, item)) || null;
            const isArray = Array.isArray(propResult);

            if (relation.isManyToOne) {
                propResult = propResult[relation.propertyName];
            } else if (relation.isManyToMany && relation.inverseRelation) {
                propResult = propResult.map((el: any) => el[relation.propertyName])[0];
            }

            if (isArray && propResult.length) {
                propResult = await this.retrieveNestedPropsInCollection(
                    propResult,
                    operation,
                    relation.inverseEntityMetadata,
                    localPropPath
                );
            } else if (!isArray && propResult instanceof Object && propResult) {
                propResult = await this.retrieveNestedPropsInItem(
                    propResult,
                    operation,
                    relation.inverseEntityMetadata,
                    localPropPath
                );
            }

            return { prop: relation.propertyName, value: propResult };
        });

        const propResults = await Promise.all(propPromises);
        propResults.forEach((result) => (item[result.prop as keyof U] = result.value));
        return item;
    }

    private getPropsByType(exposedProps: string[], entity: EntityMetadata) {
        const selectProps: string[] = [];
        const relationProps: RelationMetadata[] = [];

        exposedProps.forEach((prop: string) => {
            const relation = entity.relations.find((relation) => relation.propertyName === prop);
            if (relation) {
                relationProps.push(relation);
            } else {
                selectProps.push(entity.tableName + "." + prop);
            }
        });

        return { selectProps, relationProps };
    }

    private getNestedRelationProp<U extends AbstractEntity>(operation: Operation, relation: RelationMetadata, item: U) {
        const qb = this.connection.createQueryBuilder();
        const exposedProps = this.getExposedProps(operation, relation.inverseEntityMetadata);
        const { selectProps } = this.getPropsByType(exposedProps, relation.inverseEntityMetadata);

        const relationTableName = relation.inverseEntityMetadata.tableName;
        const relationTarget = relation.inverseEntityMetadata.target;
        const ownerTableName = relation.entityMetadata.tableName;
        const ownerTarget = relation.entityMetadata.target;
        const relationInversedBy = relation.inverseSidePropertyPath;

        if (relation.isOneToMany) {
            qb.select(selectProps)
                .from(relationTarget, relationTableName)
                .where(relationTableName + "." + relationInversedBy + "Id = :id", { id: item.id });

            // console.log(qb.getSql());
            return qb.getMany();
        } else if (relation.isOneToOne) {
            // Bi-directionnal
            if (relationInversedBy) {
                qb.select(selectProps)
                    .from(relationTarget, relationTableName)
                    .leftJoin(relationTableName + "." + relationInversedBy, ownerTableName)
                    .where(ownerTableName + ".id = :id", { id: item.id });
            } else {
                if (relation.isOneToOneOwner) {
                    qb.select(selectProps)
                        .from(relationTarget, relationTableName)
                        .where((qb) => {
                            const subQuery = qb
                                .subQuery()
                                .select([relation.joinColumns[0].databaseName])
                                .from(ownerTarget, ownerTableName)
                                .where(ownerTableName + ".id = :id", { id: item.id })
                                .getQuery();
                            return relationTableName + ".id = " + subQuery;
                        });
                } else {
                    qb.select(selectProps)
                        .from(relationTarget, relationTableName)
                        .where(ownerTableName + "Id = :id", { id: item.id });
                }
            }

            // console.log(qb.getSql());
            return qb.getOne();
        } else if (relation.isManyToMany) {
            // Bi-directionnal
            if (relationInversedBy) {
                selectProps.push(ownerTableName + ".id");
                qb.select(selectProps)
                    .from(ownerTarget, ownerTableName)
                    .leftJoin(ownerTableName + "." + relation.propertyName, relationTableName)
                    .where(ownerTableName + ".id = :id", { id: item.id });
            } else {
                const junctionTableName = relation.junctionEntityMetadata.tableName;
                qb.select(selectProps)
                    .from(relationTarget, relationTableName)
                    .where((qb) => {
                        const subQuery = qb
                            .subQuery()
                            .select(junctionTableName + "." + relation.junctionEntityMetadata.columns[0].propertyName)
                            .from(relation.junctionEntityMetadata.target, junctionTableName)
                            .where(ownerTableName + "Id = :id", { id: item.id })
                            .getQuery();
                        return relationTableName + ".id IN " + subQuery;
                    });
            }

            // console.log(qb.getSql());
            return qb.getMany();
        } else if (relation.isManyToOne) {
            selectProps.push(ownerTableName + ".id");
            qb.select(selectProps)
                .from(ownerTarget, ownerTableName)
                .leftJoin(ownerTableName + "." + relation.propertyName, relationTableName)
                .where(ownerTableName + ".id = :id", { id: item.id });

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

    private async getItem({
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
}
