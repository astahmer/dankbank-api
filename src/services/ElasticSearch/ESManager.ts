import { SearchResponse } from "elasticsearch";
import Container from "typedi";

import { Client } from "@elastic/elasticsearch";

import { logger } from "../logger";
import { MemeAdapter } from "./Adapters/MemeAdapter";

export class ElasticSearchManager {
    public readonly client: Client;

    constructor() {
        this.client = new Client({ node: `${process.env.ELASTIC_URL}` });
    }

    async checkConnection() {
        logger.info("Checking connection to ElasticSearch...");
        return this.client.ping();
    }

    async waitForConnection(delay = 5000) {
        return new Promise(async (resolve) => {
            try {
                const response = await this.checkConnection();
                resolve(response);
            } catch (error) {
                logger.error("Connection to ElasticSearch failed : ", error);
                setTimeout(async () => {
                    const response = await this.waitForConnection().catch(this.waitForConnection);
                    resolve(response);
                }, delay);
            }
        });
    }

    async adaptRowsToDocuments() {
        const memeAdapter = new MemeAdapter(this.client);

        const promises = [memeAdapter.run()];
        return Promise.all(promises);
    }
}

export async function adaptRowsToDocuments() {
    const start = Date.now();
    logger.info("Indexing ElasticSearch documents with new entities...");
    const esManager = Container.get(ElasticSearchManager);
    const responses = await esManager.adaptRowsToDocuments();
    const totalIndexed = responses.reduce((acc, total) => acc + (total || 0), 0);
    logger.info(`Done indexing ${totalIndexed} documents in ${(Date.now() - start) / 1000}s`);
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
