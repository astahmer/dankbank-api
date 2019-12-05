import * as Router from "koa-router";
import { Connection, getConnection, getRepository, ObjectType, Repository } from "typeorm";

import { AbstractEntity } from "@/entity/AbstractEntity";

import { entityRoutesContainer } from "./";
import { IRouteAction } from "./Actions/AbstractRouteAction";
import { RouteOperation } from "./Decorators/Groups";
import { IAbstractFilterConfig } from "./Filters/AbstractFilter";
import { EntityMapper } from "./Mapping/EntityMapper";
import {
    CRUD_ACTIONS, IRouteCustomActionItemClass, ResponseManager, RouteCustomAction
} from "./ResponseManager";
import { Denormalizer } from "./Serializer/Denormalizer";
import { Normalizer } from "./Serializer/Normalizer";
import { QueryAliasManager } from "./Serializer/QueryAliasManager";
import { RouteSubresourcesMeta, SubresourceManager } from "./SubresourceManager";
import { isType } from "./utils";

export const ROUTE_METAKEY = Symbol("route");
export const getRouteMetadata = (entity: Function): RouteMetadata => Reflect.getOwnMetadata(ROUTE_METAKEY, entity);

export const ROUTE_SUBRESOURCES = Symbol("route");
export const getRouteSubresourcesMetadata = <Entity extends AbstractEntity>(
    entity: Function
): RouteSubresourcesMeta<Entity> =>
    Reflect.getOwnMetadata(ROUTE_SUBRESOURCES, entity) || {
        parent: entity,
        properties: {},
    };

export const ROUTE_FILTERS_METAKEY = Symbol("filters");
export const getRouteFiltersMeta = (entity: Function): RouteFiltersMeta =>
    Reflect.getOwnMetadata(ROUTE_FILTERS_METAKEY, entity);

export class EntityRoute<Entity extends AbstractEntity> {
    // Entity Route specifics
    public readonly repository: Repository<Entity>;
    public readonly options: IEntityRouteOptions;
    public readonly customActions: Record<string, IRouteAction> = {};

    // Meta
    public readonly routeMetadata: RouteMetadata;

    // Managers/services
    public readonly connection: Connection;
    public readonly mapper: EntityMapper;
    public readonly aliasManager: QueryAliasManager;
    public readonly normalizer: Normalizer;
    public readonly denormalizer: Denormalizer<Entity>;
    public readonly subresourceManager: SubresourceManager<Entity>;
    public readonly responseManager: ResponseManager<Entity>;

    constructor(entity: ObjectType<Entity>, globalOptions: IEntityRouteOptions = {}) {
        // Entity Route specifics
        this.repository = getRepository(entity);
        this.routeMetadata = getRouteMetadata(entity);
        this.options = { ...globalOptions, ...this.routeMetadata.options };

        // Managers/services
        this.connection = getConnection();
        this.mapper = new EntityMapper(this.repository.metadata, {
            defaultMaxDepthLvl: this.options.defaultMaxDepthLvl,
            isMaxDepthEnabledByDefault: this.options.isMaxDepthEnabledByDefault,
        });
        this.aliasManager = new QueryAliasManager();
        this.normalizer = new Normalizer(this.repository.metadata, this.mapper, this.aliasManager, {
            shouldEntityWithOnlyIdBeFlattenedToIri: this.options.shouldEntityWithOnlyIdBeFlattenedToIri,
            shouldMaxDepthReturnRelationPropsId: this.options.shouldEntityWithOnlyIdBeFlattenedToIri,
        });
        this.denormalizer = new Denormalizer(this.repository, this.mapper);
        this.subresourceManager = new SubresourceManager<Entity>(
            this.repository,
            this.routeMetadata,
            this.aliasManager
        );
        this.responseManager = new ResponseManager<Entity>(
            this.connection,
            this.repository,
            this.subresourceManager,
            this.aliasManager,
            this.denormalizer,
            this.normalizer,
            this.mapper
        );

        // Add this EntityRoute to the list (used by subresources/custom actions/services)
        entityRoutesContainer[entity.name] = this as any;

        // Instanciate and store every custom action classes
        if (this.options.actions) {
            this.initCustomActionsClasses();
        }
    }

    /** Make a Koa Router for each given operations (and their associated mapping route) for this entity and its subresources and return it */
    public makeRouter() {
        const router = new Router();

        // CRUD routes
        let i = 0;
        for (i; i < this.routeMetadata.operations.length; i++) {
            const operation = this.routeMetadata.operations[i];
            const verb = CRUD_ACTIONS[operation].verb;
            const path = this.routeMetadata.path + CRUD_ACTIONS[operation].path;

            const requestContextMw = this.responseManager.makeRequestContextMiddleware(operation);
            const responseMw = this.responseManager.makeResponseMiddleware(operation);
            const mappingMethod = this.responseManager.makeRouteMappingMiddleware(operation);

            (<any>router)[verb](path, requestContextMw, responseMw);
            (<any>router)[verb](path + "/mapping", mappingMethod);
        }

        // Subresoures routes
        this.subresourceManager.makeSubresourcesRoutes(router);

        // Custom actions routes
        if (this.options.actions) {
            i = 0;
            for (i; i < this.options.actions.length; i++) {
                const actionItem = this.options.actions[i];
                const { operation, verb, path: actionPath, middlewares } = actionItem;
                const path = this.routeMetadata.path + actionPath;
                const requestContextMw = this.responseManager.makeRequestContextMiddleware(operation);
                let customActionMw;

                if (isType<IRouteCustomActionItemClass>(actionItem, "class" in actionItem)) {
                    const { action, class: actionClass } = actionItem;
                    const method = (action as keyof IRouteAction) || "onRequest";
                    customActionMw = this.customActions[actionClass.name][method].bind(
                        this.customActions[actionClass.name]
                    );
                } else {
                    customActionMw = actionItem.handler;
                }

                (<any>router)[verb](path, ...(middlewares || []), requestContextMw, customActionMw);
            }
        }

        return router;
    }

    private initCustomActionsClasses() {
        this.options.actions.forEach((action) => {
            if ("class" in action && !this.customActions[action.class.name]) {
                this.customActions[action.class.name] = new action.class({
                    entityRoute: this as any,
                    middlewares: action.middlewares || [],
                });
            }
        });
    }
}

export type RouteMetadata = {
    /** The path prefix for every action of this route */
    path: string;
    /** List of operations to create a route for */
    operations: RouteOperation[];
    /** Specific options to be used on this EntityRoute, if none specified, will default to global options */
    options?: IEntityRouteOptions;
};

export type RouteFiltersMeta = Record<string, IAbstractFilterConfig>;

export interface IEntityRouteOptions {
    actions?: Array<RouteCustomAction>;
    isMaxDepthEnabledByDefault?: boolean;
    /** Level of depth at which the nesting should stop */
    defaultMaxDepthLvl?: number;
    /** In case of max depth reached on a relation, should it at retrieve its id and then stop instead of just stopping ? */
    shouldMaxDepthReturnRelationPropsId?: boolean;
    /** In case of a relation with no other mapped props (from groups) for a request: should it unwrap "relation { id }" to relation = id ? */
    shouldEntityWithOnlyIdBeFlattenedToIri?: boolean;
}
