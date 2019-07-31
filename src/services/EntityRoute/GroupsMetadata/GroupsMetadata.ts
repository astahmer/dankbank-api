import { EntityMetadata, getRepository } from "typeorm";
import { mergeWith, concat } from "ramda";

import {
    OperationGroups,
    ContextOperations,
    RouteOperations,
    OperationsOrAll,
    ALL_OPERATIONS,
    Operation,
} from "@/decorators/Groups";
import { EntityGroupsMetadata } from "./EntityGroupsMetadata";

const entityMetaSymbol = Symbol("entityMeta");

export class GroupsMetadata {
    /** The key under which the Reflect metadata will be store on the target entity */
    protected metaKey: string;

    /** Entity class constructor, used to retrieve its related EntityMetadata */
    protected entityTarget: Function;

    /** EntityMetadata associated with the class */
    protected [entityMetaSymbol]: EntityMetadata;

    /** Every entity's props decorated with @Groups */
    protected decoratedProps: string[] = [];

    /** An array of Operations containing global props (exposed no matter which route context) */
    protected globals: OperationGroups = {};

    /** An object with route specific OperationsGroups */
    protected routes: ContextOperations = {};

    /**
     * An object with every exposed props merged (globals + specific + parents globals + specific) for each route context > Operations
     * */
    protected exposedPropsByContexts: ContextOperations = {};

    get entityMeta() {
        return this[entityMetaSymbol];
    }

    set entityMeta(newVal) {
        this[entityMetaSymbol] = newVal;
    }

    constructor(metaKey: string, entityOrMeta: EntityMetadata | Function) {
        this.metaKey = metaKey;

        if (entityOrMeta instanceof EntityMetadata) {
            this.entityMeta = entityOrMeta;
        } else {
            this.entityTarget = entityOrMeta;
        }
    }

    addPropToGlobalGroups(groups: OperationsOrAll, propName: string) {
        if (groups === "all") {
            groups = ALL_OPERATIONS;
        }

        let i = 0;
        for (i; i < groups.length; i++) {
            if (!this.globals[groups[i]]) {
                this.globals[groups[i]] = [];
            }
            this.globals[groups[i]].push(propName);
        }
        this.decoratedProps.push(propName);
    }

    addPropToRoutesGroups(groups: RouteOperations, propName: string) {
        let route;
        for (route in groups) {
            let i = 0;

            if (groups[route] === "all") {
                groups[route] = ALL_OPERATIONS;
            }

            let operation: Operation;
            for (i; i < groups[route].length; i++) {
                if (!this.routes[route]) {
                    this.routes[route] = {};
                }

                operation = groups[route][i] as Operation;

                if (!this.routes[route][operation]) {
                    this.routes[route][operation] = [];
                }

                this.routes[route][operation].push(propName);
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
    mergeGlobalsAndRouteSpecificGroups(route: string): OperationGroups {
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
    getEntityRouteGroups(target: string | Function, tableName: string): OperationGroups {
        const groupsMeta: EntityGroupsMetadata = Reflect.getOwnMetadata(this.metaKey, target);

        // If no groups are set on this entity
        if (!groupsMeta) {
            return;
        }

        return groupsMeta.mergeGlobalsAndRouteSpecificGroups(tableName);
    }

    /**
     * Merge groups with every parent entities
     */
    mergeGroupsWithParentEntities(routeContext: EntityMetadata) {
        if (!this.entityMeta) {
            this.entityMeta = getRepository(this.entityTarget).metadata;
        }

        let props = this.getEntityRouteGroups(this.entityMeta.target, routeContext.tableName);
        let i = 1; // Skip itself
        let parentProps;

        for (i; i < this.entityMeta.inheritanceTree.length; i++) {
            parentProps = this.getEntityRouteGroups(this.entityMeta.inheritanceTree[i], routeContext.tableName);

            if (parentProps) {
                props = mergeWith(concat, props, parentProps);
            }
        }

        if (!this.exposedPropsByContexts[routeContext.tableName]) {
            this.exposedPropsByContexts[routeContext.tableName] = {};
        }

        this.exposedPropsByContexts[routeContext.tableName] = props;
        return props;
    }

    /**
     * Get exposed props (from groups) for a given entity (using its EntityMetadata) on a specific operation
     */
    getExposedProps(operation: Operation, routeContext: EntityMetadata) {
        let exposedProps = this.exposedPropsByContexts[routeContext.tableName];

        if (!exposedProps || !exposedProps[operation]) {
            exposedProps = this.mergeGroupsWithParentEntities(routeContext);
        }

        return exposedProps && exposedProps[operation];
    }
}

export type GroupsMetaByRoutes<G extends GroupsMetadata> = Record<string, G>;