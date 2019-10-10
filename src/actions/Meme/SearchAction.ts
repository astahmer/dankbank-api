import { AbstractRouteAction, RouteActionConstructorArgs } from "@/services/EntityRoute/Actions/RouteAction";
import { ElasticSearchManager } from "@/services/ElasticSearch/ESManager";
import { Context } from "koa";
import Container from "typedi";
import { logger } from "@/services/logger";
import { MemeDocument } from "@/services/ElasticSearch/Adapters/MemeAdapter";
import { ApiResponse, RequestParams } from "@elastic/elasticsearch";
import { SearchResponse } from "elasticsearch";
import { limit } from "@/services/EntityRoute/utils";

export class SearchAction extends AbstractRouteAction {
    private esManager: ElasticSearchManager;

    constructor(routeContext: RouteActionConstructorArgs) {
        super(routeContext);

        this.esManager = Container.get(ElasticSearchManager);
    }

    public async onRequest(ctx: Context) {
        const { q, size, excludedIds } = ctx.query;
        const elasticQuery = this.getElasticQuery(q, {
            size,
            excludedIds: excludedIds ? excludedIds.split(",") : [],
        });
        const searchPromise = this.esManager.client.search(elasticQuery);

        try {
            const searchResult = (await searchPromise) as ApiResponse<SearchResponse<MemeDocument>>;
            ctx.body = { items: searchResult.body.hits.hits, total: searchResult.body.hits.total };
        } catch (error) {
            logger.error(error.message);
            ctx.throw(500);
        }
    }

    private getQueryForParams(queriedValue: string, { excludedIds }: SearchQueryOptions) {
        return {
            bool: {
                must: [
                    {
                        multi_match: {
                            query: queriedValue,
                            type: "phrase_prefix",
                            fields: ["title^3", "tags^2", "description"],
                        },
                    },
                ],
                must_not: [
                    {
                        ids: {
                            values: excludedIds,
                        },
                    },
                ],
            },
        };
    }

    private getElasticQuery(queriedValue: string, { size, excludedIds }: SearchQueryOptions): RequestParams.Search {
        const limitedSize = size ? limit(size, [1, 100]) : 25;

        return {
            index: "memes",
            body: {
                size: limitedSize,
                query: {
                    function_score: {
                        query: this.getQueryForParams(queriedValue, { excludedIds }),
                        score_mode: "multiply",
                        boost_mode: "sum",
                        max_boost: 10,
                        functions: [
                            {
                                field_value_factor: {
                                    field: "upvoteCount",
                                    factor: 0.2,
                                    modifier: "log1p",
                                    missing: 1,
                                },
                            },
                            {
                                exp: {
                                    downvoteCount: {
                                        origin: "0",
                                        offset: "10",
                                        scale: "5",
                                    },
                                },
                            },
                        ],
                    },
                },
            },
            _source_excludes: ["tags_suggest"],
        };
    }
}

type SearchQueryOptions = { size?: number; excludedIds: string[] };
