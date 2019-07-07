import * as Koa from "koa";
import * as Router from "koa-router";
import { Connection, EntityMetadata, Repository, getRepository } from "typeorm";

import {
    IClassMetadatas,
    IEntityRouteMetadatas,
    Operation,
    IRouteActions,
    EntityRouteGroups,
    IEntityRouteMapping,
} from "./types";
import { mergeWith, concat, path, pluck } from "ramda";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";

export class EntityRouter {
    private connection: Connection;
    private repository: Repository<any>;

    private routeMetadatas: IEntityRouteMetadatas;
    private entityMetadata: EntityMetadata;
    private actions: IRouteActions;
    private mapping: IEntityRouteMapping;

    constructor({ connection, routeMetadatas: routeMetadatas, entityMetadata }: IClassMetadatas, actions: any) {
        this.connection = connection;
        this.routeMetadatas = routeMetadatas;
        this.entityMetadata = entityMetadata;
        this.actions = actions;

        this.repository = getRepository(this.entityMetadata.target);
    }

    public makeRouter() {
        const router = new Router();

        for (let i = 0; i < this.routeMetadatas.operations.length; i++) {
            const operation = this.routeMetadatas.operations[i];
            const action = this.actions[operation];
            const verb = action.verb;
            const path = this.routeMetadatas.path + action.path;

            const responseMethod = this.makeResponseMethod(operation, action);
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

    private async getList({ operation, exposedProps }: any) {
        const qb = this.repository.createQueryBuilder(this.entityMetadata.tableName);

        const { selectProps, relationProps } = this.getsPropsTypes(exposedProps, this.entityMetadata);
        qb.select(selectProps);

        const results = await qb.getManyAndCount();

        this.mapping = {
            [this.entityMetadata.tableName]: {
                // entityMetadata: this.entityMetadata,
                exposedProps,
                relationProps: pluck("prop", relationProps),
                mapping: {},
            },
        };
        const itemsResults = await this.retrieveNestedPropsInCollection(
            results[0],
            operation,
            this.entityMetadata,
            this.entityMetadata.tableName
        );

        return itemsResults;
    }

    private async retrieveNestedPropsInCollection(
        items: any[],
        operation: Operation,
        entityMetadata: EntityMetadata,
        currentPath: string
    ) {
        const promises = items.map((item: any) =>
            this.retrieveNestedPropsInItem(item, operation, entityMetadata, currentPath)
        );
        return await Promise.all(promises);
    }

    private async retrieveNestedPropsInItem(
        item: any,
        operation: Operation,
        entityMetadata: EntityMetadata,
        currentPath: string
    ) {
        const exposedProps = this.getExposedProps(operation, entityMetadata);
        const { relationProps } = this.getsPropsTypes(exposedProps, entityMetadata);

        if (!relationProps.length) {
            return item;
        }

        const propPromises = relationProps.map(async (rel) => {
            const currentPathArray = currentPath
                .split(".")
                .join(".mapping.")
                .split(".");
            const entityPropPath: any = path(currentPathArray, this.mapping);
            if (!entityPropPath.mapping[rel.relation.inverseEntityMetadata.tableName]) {
                const exposedProps = this.getExposedProps(operation, rel.relation.inverseEntityMetadata);
                const { relationProps } = this.getsPropsTypes(exposedProps, rel.relation.inverseEntityMetadata);

                entityPropPath.mapping[rel.relation.inverseEntityMetadata.tableName] = {
                    // entityMetadata: rel.relation.inverseEntityMetadata,
                    exposedProps,
                    relationProps: pluck("prop", relationProps),
                    mapping: {},
                };
            }

            const isCircular = currentPath.indexOf(rel.relation.inverseEntityMetadata.tableName) !== -1;
            if (isCircular) {
                // console.log("circular in " + entityMetadata.tableName + "." + rel.relation.propertyName);
                return { prop: rel.prop, value: "CIRCULAR" };
            }
            // const localPropPath = currentPath.concat(rel.relation.inverseEntityMetadata.tableName);
            const localPropPath = currentPath + "." + rel.relation.inverseEntityMetadata.tableName;
            let propResult: any = await this.getNestedRelationProp(operation, rel, item);
            const isArray = Array.isArray(propResult);

            if (isArray && propResult.length) {
                propResult = await this.retrieveNestedPropsInCollection(
                    propResult,
                    operation,
                    rel.relation.inverseEntityMetadata,
                    localPropPath
                );
            } else if (!isArray && propResult instanceof Object && propResult) {
                propResult = await this.retrieveNestedPropsInItem(
                    propResult,
                    operation,
                    rel.relation.inverseEntityMetadata,
                    localPropPath
                );
            }

            const prop = { prop: rel.prop, value: propResult };
            return prop;
        });

        const propResults = await Promise.all(propPromises);
        propResults.forEach((result) => (item[result.prop] = result.value));
        return item;
    }

    private getsPropsTypes(exposedProps: string[], entity: EntityMetadata) {
        const selectProps: string[] = [];
        const relationProps: { relation: RelationMetadata; prop: string }[] = [];

        exposedProps.forEach((prop: string) => {
            const relation = entity.relations.find((relation) => relation.propertyName === prop);
            if (relation) {
                relationProps.push({ relation, prop });
            } else {
                selectProps.push(entity.tableName + "." + prop);
            }
        });

        return { selectProps, relationProps };
    }

    private getNestedRelationProp(operation: Operation, rel: { relation: RelationMetadata; prop: string }, item: any) {
        const qb = this.connection.createQueryBuilder();
        const exposedProps = this.getExposedProps(operation, rel.relation.inverseEntityMetadata);
        const { selectProps } = this.getsPropsTypes(exposedProps, rel.relation.inverseEntityMetadata);

        const relationTableName = rel.relation.inverseEntityMetadata.tableName;
        const relationTarget = rel.relation.inverseEntityMetadata.target;
        const relationOwner = rel.relation.entityMetadata.tableName;
        const relationInversedBy = rel.relation.inverseSidePropertyPath;

        if (rel.relation.relationType === "one-to-many") {
            qb.select(selectProps)
                .from(relationTarget, relationTableName)
                .where(relationTableName + "." + relationInversedBy + "Id = :id", { id: item.id });

            // console.log(qb.getSql());
            return qb.getMany();
        } else if (rel.relation.relationType === "one-to-one") {
            qb.select(selectProps)
                .from(relationTarget, relationTableName)
                .leftJoin(relationTableName + "." + relationInversedBy, relationOwner)
                .where(relationOwner + ".id = :id", { id: item.id });
            // console.log(qb.getSql());
            return qb.getOne();
        } else if (rel.relation.relationType === "many-to-many") {
            selectProps.push(relationOwner + ".id");
            qb.select(selectProps)
                .from(rel.relation.entityMetadata.target, relationOwner)
                .leftJoin(relationOwner + "." + rel.relation.propertyName, relationTableName)
                .where(relationOwner + ".id = :id", { id: item.id });
            // console.log(qb.getSql());
            return qb.getMany();
        } else {
            console.log(rel.relation);
        }
    }

    private makeResponseMethod(operation: Operation, action: any): Koa.Middleware {
        const exposedProps = this.getExposedProps(operation, this.entityMetadata);

        return async (ctx, next) => {
            const isUpserting = (ctx.method === "POST" || ctx.method === "PUT") && ctx.request.body;
            const params = {
                operation,
                exposedProps,
                ...(ctx.params.id && { entityId: ctx.params.id }),
                ...(isUpserting && { values: ctx.request.body }),
            };

            action;
            const result = await this.getList(params);
            console.log(result);
            let items, totalItems;
            // if (!isUpserting) {
            //     [items, totalItems] = result;
            // } else {
            //     items = [result];
            //     totalItems = 1;
            // }
            // console.log(result, items);

            ctx.body = {
                context: {
                    operation,
                    entity: this.entityMetadata.target,
                },
                result,
                items,
                totalItems,
                mapping: this.mapping,
            };
            next();
        };
    }
}
