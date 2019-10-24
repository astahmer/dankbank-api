import { SearchResponse } from "elasticsearch";
import Container, { Service } from "typedi";

import { Client } from "@elastic/elasticsearch";

import { logger } from "../logger";
import { MemeAdapter } from "./Adapters/MemeAdapter";

@Service()
export class ElasticSearchManager {
    public readonly client: Client;

    constructor() {
        this.client = new Client({ node: `${process.env.ELASTIC_URL}` });
    }

    async checkConnection() {
        try {
            const response = await this.client.ping();
            return response;
        } catch (error) {
            setTimeout(() => {
                this.checkConnection();
            }, 1000);
        }
    }

    async adaptRowsToDocuments() {
        await this.checkConnection();

        const memeAdapter = new MemeAdapter(this.client);

        const promises = [memeAdapter.run()];
        return Promise.all(promises);
    }
}

export async function adaptRowsToDocuments() {
    const start = Date.now();
    logger.info("Indexing ElasticSearch documents with new entities...");
    const esManager = Container.get(ElasticSearchManager);
    await esManager.adaptRowsToDocuments();
    logger.info("Done indexing documents in " + (Date.now() - start) / 1000 + "s");
}

export type SuggestionOption<T = any> = {
    text: string;
    _index: string;
    _type: string;
    _id: string;
    _score: number;
    _source: T;
};
export type Suggestion<T = any> = { text: string; offset: number; length: number; options: SuggestionOption<T>[] };
export type SuggestResponse<T = any> = SearchResponse<T> & { suggest: { [k: string]: Suggestion<T>[] } };
