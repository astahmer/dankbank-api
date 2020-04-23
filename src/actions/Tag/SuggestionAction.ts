import { Context } from "koa";
import Container from "typedi";
import { AbstractRouteAction, RouteActionConstructorArgs } from "@astahmer/entity-routes/";
import { ApiResponse, RequestParams } from "@elastic/elasticsearch";

import { MemeDocument } from "@/services/ElasticSearch/Adapters/MemeAdapter";
import { ElasticSearchManager, SuggestResponse } from "@/services/ElasticSearch/ESManager";
import { logger } from "@/services/logger";
import { limit } from "@/functions/object";

export class SuggestionAction extends AbstractRouteAction {
    private esManager: ElasticSearchManager;

    constructor(routeContext: RouteActionConstructorArgs) {
        super(routeContext);

        this.esManager = Container.get(ElasticSearchManager);
    }

    public async onRequest(ctx: Context) {
        const { q, size } = ctx.query;
        const elasticQuery = this.getElasticQuery(q, {
            size,
        });
        const searchPromise = this.esManager.client.search(elasticQuery);

        try {
            const searchResult = (await searchPromise) as ApiResponse<SuggestResponse<MemeDocument>>;
            ctx.body = { items: searchResult.body.suggest.tags[0].options };
        } catch (error) {
            logger.error(error.message);
            ctx.throw(500);
        }
    }

    private getElasticQuery(queriedValue: string, { size }: SearchQueryOptions): RequestParams.Search {
        const limitedSize = size ? limit(size, [1, 25]) : 10;

        return {
            index: "memes",
            _source: "false",
            body: {
                suggest: {
                    tags: {
                        prefix: queriedValue,
                        completion: {
                            field: "tags_suggest",
                            skip_duplicates: true,
                            size: limitedSize,
                        },
                    },
                },
            },
            _source_excludes: ["tags_suggest"],
        };
    }
}

type SearchQueryOptions = { size?: number };
