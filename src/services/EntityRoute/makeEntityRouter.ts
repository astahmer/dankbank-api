import { Context } from "koa";
import * as Router from "koa-router";
import { getRepository } from "typeorm";

import { Middleware } from "../../utils/globalTypes";
import {
    IOperationRouteItemParams,
    IClassMetadatas,
    IMapGroupsToSelectArgs,
    IRelationProp,
    ISelectData,
} from "./types";
import { OPERATIONS_ROUTES } from "./operationsRoutes";
import { find, propEq, flatten, uniq, any } from "ramda";

const isUpsert = (ctx: Context) => (ctx.method === "POST" || ctx.method === "PUT") && ctx.request.body;

export function makeEntityRouter({
    connection,
    routeMetadatas: { entity, groups, route },
    entityMetadatas,
}: IClassMetadatas) {
    const router = new Router();
    const repository = getRepository(entity);
    const tableName = entityMetadatas.tableName;

    console.log(groups);

    for (let i = 0; i < route.operations.length; i++) {
        const operation = route.operations[i];
        const opItem = OPERATIONS_ROUTES[operation];

        const path = route.path + opItem.path;
        const exposedProps = groups && groups[operation];
        const selectProps = exposedProps ? exposedProps.map((v: string) => tableName + "." + v) : [];

        const selectData = mapGroupsToSelects({ connection, operation, groups, entityMetadatas });
        console.log(selectData);

        const responseMethod: Middleware = async (ctx, next) => {
            const defaultParams: IOperationRouteItemParams = {
                repository,
                entityMetadatas,
                tableName,
                selectProps,
                selectData,
            };
            const isUpserting = isUpsert(ctx);
            const methodParams = {
                ...(ctx.params.id && { entityId: ctx.params.id }),
                ...(isUpserting && { values: ctx.request.body }),
            };
            const params = { ...defaultParams, ...methodParams };
            // console.log(opItem, methodParams);

            const result = await opItem.method(params);
            // console.log(result);
            let items, totalItems;
            if (!isUpserting) {
                [items, totalItems] = result;
            } else {
                items = [result];
                totalItems = 1;
            }
            // console.log(result, items);

            ctx.body = {
                context: {
                    operation,
                    entity: entity.name,
                },
                items,
                totalItems,
            };
            next();
        };

        (<any>router)[opItem.verb](path, responseMethod);
    }

    return router;
}

/*
TODO :
- Export into new file
- fix recursively nested group relations props
- add pagination
- use class to pass connection etc
- clean files
- introduce entity specific groups:
    @Groups({
        user: ["create", "list", "update"],
        meme: ["details", "list"],
    })
- add "all" Operation which is equal to "create", "list", "details", "update", "delete"
- get properties from parent
- gitlab push
*/
function mapGroupsToSelects({
    connection,
    operation,
    groups,
    entityMetadatas,
    relationName,
}: IMapGroupsToSelectArgs): ISelectData | null {
    const exposedProps = groups && groups[operation];
    if (!exposedProps) {
        return null;
    }

    const relationsProps: IRelationProp[] = entityMetadatas.relations.map((relation) => ({
        target: relation.inverseEntityMetadata.target,
        propertyName: relation.propertyName,
    }));

    const findProp = (prop: string, relations: IRelationProp[]) => find(propEq("propertyName", prop))(relations);
    const mapToSelect = (prop: string) => {
        const relation = findProp(prop, relationsProps);
        if (relation) {
            // console.log(connection.getMetadata(relation.target));
            const relationMetadatas = connection.getMetadata(relation.target);
            const relationGroups = Reflect.getOwnMetadata("groups", relation.target);
            const relationOperationProps = mapGroupsToSelects({
                connection,
                operation,
                groups: relationGroups,
                entityMetadatas: relationMetadatas,
                relationName: relation.propertyName,
            });
            // console.log(relationOperationProps);
            return relationOperationProps && relationOperationProps.selectProps;
        }

        return (relationName ? relationName : entityMetadatas.tableName) + "." + prop;
    };

    const props = exposedProps.map(mapToSelect);
    const selectProps = <string[]>uniq(flatten(props)).filter((v) => v);
    const hasDeepProps = props.some(Array.isArray);

    const usedRelations = relationsProps
        .map((rel) => {
            if (selectProps.some((select) => select.includes(rel.propertyName))) {
                return rel;
            }
            return null;
        })
        .filter((v) => v);

    // console.log(props);

    return {
        selectProps,
        ...(hasDeepProps ? { relations: usedRelations } : {}),
    };
}
