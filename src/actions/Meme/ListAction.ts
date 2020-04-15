import { SearchResponse } from "elasticsearch";
import { Context } from "koa";
import Container from "typedi";

import { MemeDocument } from "@/services/ElasticSearch/Adapters/MemeAdapter";
import { ElasticSearchManager } from "@/services/ElasticSearch/ESManager";
import { AbstractRouteAction, RouteActionConstructorArgs } from "@/services/EntityRoute/Actions/AbstractRouteAction";
import { logger } from "@/services/logger";
import { ApiResponse, RequestParams } from "@elastic/elasticsearch";
import { limit } from "@/functions/object";

export class ListAction extends AbstractRouteAction {
    private esManager: ElasticSearchManager;

    constructor(routeContext: RouteActionConstructorArgs) {
        super(routeContext);

        this.esManager = Container.get(ElasticSearchManager);
    }

    public async onRequest(ctx: Context) {
        const { from, size } = ctx.query;
        const elasticQuery = this.getElasticQuery({ from, size });
        const searchPromise = this.esManager.client.search(elasticQuery);

        try {
            const searchResult = (await searchPromise) as ApiResponse<SearchResponse<MemeDocument>>;
            ctx.body = {
                items: searchResult.body.hits.hits,
                total: searchResult.body.hits.total,
            };
        } catch (error) {
            logger.error(error.message);
            ctx.throw(500);
        }
    }

    private getElasticQuery({ from = 0, size }: ListQueryOptions): RequestParams.Search {
        const limitedSize = size ? limit(size, [1, 100]) : 25;

        return {
            index: "memes",
            body: {
                from,
                size: limitedSize,
                sort: [{ dateCreated: "desc" }],
            },
            _source_excludes: ["tags_suggest"],
        };
    }
}

type ListQueryOptions = { from?: number; size?: number };
