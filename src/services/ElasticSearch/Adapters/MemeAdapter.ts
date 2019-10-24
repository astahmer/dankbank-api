import { Repository, SelectQueryBuilder } from "typeorm";

import { Meme } from "@/entity/Meme";
import { chunk } from "@/services/EntityRoute/utils";
import { logger } from "@/services/logger";
import { Client } from "@elastic/elasticsearch";

import { MemeTransformer } from "../Transformers/MemeTransformer";
import { AbstractAdapter, AbstractDocument } from "./AbstractAdapter";

export class MemeAdapter extends AbstractAdapter<Meme> {
    constructor(client: Client) {
        super(client, "memes");

        this.transformer = new MemeTransformer();
    }

    getMapping() {
        return {
            dateCreated: { type: "text" },
            dateUpdated: { type: "text" },
            title: { type: "text" },
            description: { type: "text" },
            tags: { type: "text" },
            tags_suggest: { type: "completion" },
            upvoteCount: { type: "integer" },
            downvoteCount: { type: "integer" },
            views: { type: "integer" },
            isMultipartMeme: { type: "boolean" },
            pictures: {
                type: "nested",
                properties: {
                    id: { type: "keyword" },
                    originalName: { type: "text" },
                    name: { type: "keyword" },
                    size: { type: "integer" },
                },
            },
            banks: { type: "keyword" },
            owner: { type: "keyword" },
        };
    }

    /** Selects only properties needed for the transformation to documents */
    addSelects(repository: Repository<Meme>, qb: SelectQueryBuilder<Meme>) {
        const tableAlias = repository.metadata.tableName;

        qb.select(tableAlias)
            .addSelect(["bank.id", "owner.id"])
            .leftJoinAndSelect(`${tableAlias}.pictures`, "picture")
            .leftJoinAndSelect(`${tableAlias}.tags`, "tag")
            .leftJoin(`${tableAlias}.banks`, "bank")
            .leftJoin(`${tableAlias}.owner`, "owner");
    }

    async run() {
        await this.init();
        const repository = this.entityManager.getRepository(Meme);
        const tableAlias = repository.metadata.tableName;

        const qb = repository.createQueryBuilder(tableAlias);
        this.addSelects(repository, qb);

        // Select only entities whose related document are not up to date yet
        this.addAdapterStatements(qb, tableAlias);

        const items = await qb.getMany();

        // All entities are properly in sync with their associated index in ES
        if (!items.length) {
            return;
        }

        // Add an index action (create) for each entity
        let i = items.length;
        const bodyItems = [];
        for (i; i--; ) {
            bodyItems.push({ index: { _index: this.INDEX_NAME, _id: items[i].id } });
            bodyItems.push(this.transformer.transform(items[i]));
        }

        const chunks = chunk(bodyItems, 20000);
        const promises = chunks.map((body) => this.client.bulk({ body, refresh: "true" }));
        const results = await Promise.all(promises);

        const errors = results.reduce((acc, bulkResponse) => {
            if (bulkResponse && bulkResponse.body.errors) {
                acc.push(bulkResponse);
            }

            return acc;
        }, []);

        if (errors.length) {
            logger.error("There was an error while indexing some documents.");
        }

        // Find last indexed item (= without error)
        let lastIndexedItemId, itemsLength;
        let resultsLength = results.length;
        i = 0;
        for (i; i < resultsLength; i++) {
            if (results[i].body.items) {
                itemsLength = results[i].body.items.length;
                for (let j = 0; j < itemsLength; i++) {
                    if (!results[i].body.items[j].index.error) {
                        lastIndexedItemId = parseInt(results[i].body.items[j].index._id);
                        break;
                    }
                }

                if (lastIndexedItemId) {
                    break;
                }
            }
        }

        if (!lastIndexedItemId) {
            return;
        }

        // Find item associated to that id
        let lastIndexedItem;
        i = items.length;
        for (i; i--; ) {
            if (items[i].id === lastIndexedItemId) {
                lastIndexedItem = items[i];
                break;
            }
        }

        // Save most recent dateUpdated value in order not to update the same entity twice if its up to date
        this.updateLastValue(lastIndexedItem.dateUpdated);
    }
}

export type MemePictureDocument = {
    id: number;
    originalName: string;
    name: string;
    size: number;
};

export type MemeDocument = AbstractDocument & {
    title: string;
    description: string;
    tags: string[];
    tags_suggest?: string;
    upvoteCount: number;
    downvoteCount: number;
    views: number;
    isMultipartMeme: string;
    pictures: MemePictureDocument[];
    banks: string[];
    owner: string;
};
