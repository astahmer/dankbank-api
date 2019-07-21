import { EntityMetadata } from "typeorm";
import { mergeWith, concat } from "ramda";

import { OperationGroups, RouteGroups, GroupsParams, RouteGroupsByContext } from "../../decorators/Groups";
import { Operation } from "./types";

export class GroupsMetadata {
    protected metaKey: string;
    protected routeContext: EntityMetadata;
    protected decoratedProps: string[] = [];
    protected globals: OperationGroups = {};
    protected routes: RouteGroups = {};
    protected exposedProps: RouteGroupsByContext = {};

    constructor(metaKey: string) {
        this.metaKey = metaKey;
    }

    setRouteContext(entityMetadata: EntityMetadata) {
        this.routeContext = entityMetadata;
        return this;
    }

    addPropToGlobalGroups(groups: Operation[], propName: string) {
        let i = 0;
        for (i; i < groups.length; i++) {
            if (!this.globals[groups[i]]) {
                this.globals[groups[i]] = [];
            }
            this.globals[groups[i]].push(propName);
        }
        this.decoratedProps.push(propName);
    }

    addPropToRoutesGroups(groups: GroupsParams, propName: string) {
        let route;
        for (route in groups) {
            let i = 0;
            for (i; i < groups[route].length; i++) {
                if (!this.routes[route]) {
                    this.routes[route] = {};
                }

                if (!this.routes[route][groups[route][i]]) {
                    this.routes[route][groups[route][i]] = [];
                }

                this.routes[route][groups[route][i]].push(propName);
            }
        }
        this.decoratedProps.push(propName);
    }

    /**
     * Merge globals groups with route specific groups
     * @example
     * this.globals = ["details", "list", ...];
     * this.routes = { user: ["create", "details", "delete"], category: ["create", "update"] };
     * return ['details', 'list', 'create', 'delete'] // for route = 'user'
     */
    mergeGlobalsAndRouteSpecificGroups(route: string) {
        let groups;
        if (this.globals && this.routes[route]) {
            groups = mergeWith(concat, this.globals, this.routes[route]);
        } else {
            groups = this.globals || this.routes[route];
        }

        return groups;
    }

    /**
     * Get groups metadata for a given entity and merge global groups with route specific groups
     */
    getEntityRouteGroups(target: string | Function): OperationGroups {
        const groupsMeta = Reflect.getOwnMetadata(this.metaKey, target);

        // If no groups are set on this entity
        if (!groupsMeta) {
            return;
        }

        return groupsMeta.mergeGlobalsAndRouteSpecificGroups(this.routeContext.tableName);
    }

    /**
     * Merge groups with every parent entities
     */
    mergeGroupsWithParentEntities(entityMetadata: EntityMetadata) {
        let props = this.getEntityRouteGroups(entityMetadata.target);
        let i = 1; // Skip itself
        let parentProps;

        for (i; i < entityMetadata.inheritanceTree.length; i++) {
            parentProps = this.getEntityRouteGroups(entityMetadata.inheritanceTree[i]);

            if (parentProps) {
                props = mergeWith(concat, props, parentProps);
            }
        }

        if (!this.exposedProps[this.routeContext.tableName]) {
            this.exposedProps[this.routeContext.tableName] = {};
        }

        this.exposedProps[this.routeContext.tableName][entityMetadata.tableName] = props;
        return props;
    }

    /**
     * Get exposed props (from groups) for a given entity (using its EntityMetadata) on a specific operation
     */
    getExposedProps(operation: Operation, entityMetadata: EntityMetadata) {
        let exposedProps;

        if (
            !this.exposedProps[this.routeContext.tableName] ||
            !this.exposedProps[this.routeContext.tableName][entityMetadata.tableName] ||
            !this.exposedProps[entityMetadata.tableName][operation]
        ) {
            exposedProps = this.mergeGroupsWithParentEntities(entityMetadata);
        } else {
            exposedProps = this.exposedProps[this.routeContext.tableName][entityMetadata.tableName];
        }

        return exposedProps && exposedProps[operation];
    }
}
