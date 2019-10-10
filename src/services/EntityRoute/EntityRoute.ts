import * as Router from "koa-router";
import { Repository, getRepository, ObjectType, Connection, getConnection } from "typeorm";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { Normalizer } from "./Serializer/Normalizer";
import { RouteOperation } from "./Decorators/Groups";
import { IAbstractFilterConfig } from "./Filters/AbstractFilter";
import { EntityMapper } from "./Mapping/EntityMapper";
import { Denormalizer } from "./Serializer/Denormalizer";
import { QueryAliasManager } from "./Serializer/QueryAliasManager";
import { RouteAction } from "./Actions/RouteAction";
import { SubresourceManager, RouteSubresourcesMeta } from "./SubresourceManager";
import { entityRoutesContainer } from ".";
import { ResponseManager, CRUD_ACTIONS, IRouteCustomActionItem } from "./ResponseManager";

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
    public readonly customActions: Record<string, RouteAction> = {};

    // Meta
    public readonly routeMetadata: RouteMetadata;

    // Managers/services
    public readonly connection: Connection;
    public readonly mapper: EntityMapper<Entity>;
    public readonly aliasManager: QueryAliasManager;
    public readonly normalizer: Normalizer<Entity>;
    public readonly denormalizer: Denormalizer<Entity>;
    public readonly subresourceManager: SubresourceManager<Entity>;
    public readonly responseManager: ResponseManager<Entity>;

    constructor(entity: ObjectType<Entity>, globalOptions: IEntityRouteOptions = {}) {
        // Entity Route specifics
        this.repository = getRepository(entity) as any;
        this.routeMetadata = getRouteMetadata(entity);
        this.options = { ...globalOptions, ...this.routeMetadata.options };

        // Managers/services
        this.connection = getConnection();
        this.mapper = new EntityMapper<Entity>(this);
        this.aliasManager = new QueryAliasManager();
        this.normalizer = new Normalizer<Entity>(this);
        this.denormalizer = new Denormalizer(this as any) as any;
        this.subresourceManager = new SubresourceManager<Entity>(this as any);
        this.responseManager = new ResponseManager<Entity>(this as any);

        // Add this EntityRoute to the list (used by subresources)
        entityRoutesContainer[entity.name] = this as any;

        // Instanciate and store every custom action classes
        if (this.options.actions) {
            this.initCustomActions();
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

            const responseMethod = this.responseManager.makeResponseMethod(operation);
            const mappingMethod = this.responseManager.makeRouteMappingMethod(operation);

            (<any>router)[verb](path, responseMethod);
            (<any>router)[verb](path + "/mapping", mappingMethod);
        }

        // Subresoures routes
        this.subresourceManager.makeSubresourcesRoutes(router);

        // Custom actions routes
        if (this.options.actions) {
            i = 0;
            for (i; i < this.options.actions.length; i++) {
                const { verb, path: actionPath, action, class: actionClass, middlewares } = this.options.actions[i];
                const path = this.routeMetadata.path + actionPath;

                const method = (action as keyof RouteAction) || "onRequest";
                const responseMethod = this.customActions[actionClass.name][method];

                (<any>router)[verb](
                    path,
                    ...(middlewares || []),
                    responseMethod.bind(this.customActions[actionClass.name])
                );
            }
        }

        return router;
    }

    private initCustomActions() {
        this.options.actions.forEach((action) => {
            if (!this.customActions[action.class.name]) {
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
    actions?: IRouteCustomActionItem[];
    isMaxDepthEnabledByDefault?: boolean;
    /** Level of depth at which the nesting should stop */
    defaultMaxDepthLvl?: number;
    /** In case of max depth reached on a relation, should it at retrieve its id and then stop instead of just stopping ? */
    shouldMaxDepthReturnRelationPropsId?: boolean;
    /** In case of a relation with no other mapped props (from groups) for a request: should it unwrap "relation { id }" to relation = id ? */
    shouldEntityWithOnlyIdBeFlattenedToIri?: boolean;
}
