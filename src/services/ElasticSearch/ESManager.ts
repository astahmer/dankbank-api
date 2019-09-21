import { Client } from "@elastic/elasticsearch";

import { MemeAdapter } from "./Adapters/MemeAdapter";
import { Service } from "typedi";

@Service()
export class ElasticSearchManager {
    public readonly client: Client;

    constructor() {
        this.client = new Client({ node: `${process.env.ELASTIC_URL}` });
    }

    async adaptRowsToDocuments() {
        const memeAdapter = new MemeAdapter(this.client);

        const promises = [memeAdapter.run()];
        return Promise.all(promises);
    }
}
