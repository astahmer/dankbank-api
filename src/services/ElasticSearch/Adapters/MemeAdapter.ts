import { Repository, SelectQueryBuilder } from "typeorm";

import { Meme } from "@/entity/Meme";
import { logger } from "@/services/logger";
import { Client } from "@elastic/elasticsearch";

import { MemeTransformer } from "../Transformers/MemeTransformer";
import { AbstractAdapter, AbstractDocument, DocumentMapping } from "./AbstractAdapter";
import { chunk } from "@/functions/object";

export class MemeAdapter extends AbstractAdapter<Meme> {
    constructor(client: Client) {
        super(client, "memes");

        this.transformer = new MemeTransformer();
    }

    getMapping() {
        const image: DocumentMapping<MemePictureDocument> = {
            "@id": { type: "keyword" },
            iri: { type: "keyword" },
            id: { type: "integer" },
            originalName: { type: "text" },
            name: { type: "keyword" },
            size: { type: "integer" },
            url: { type: "text" },
            qualities: { type: "keyword" },
            ratio: { type: "keyword" },
        };

        return {
            "@id": { type: "keyword" },
            iri: { type: "keyword" },
            id: { type: "integer" },
            dateCreated: { type: "date" },
            dateUpdated: { type: "date" },
            tags: { type: "text" },
            tags_suggest: { type: "completion", analyzer: "keyword" },
            upvoteCount: { type: "integer" },
            downvoteCount: { type: "integer" },
            views: { type: "integer" },
            isMultipartMeme: { type: "boolean" },
            image: { type: "object", properties: image },
            pictures: { type: "nested", properties: image },
            banks: { type: "keyword" },
            owner: { type: "keyword" },
            ownerId: { type: "integer" },
        } as DocumentMapping<MemeDocument>;
    }

    /** Selects only properties needed for the transformation to documents */
    addSelects(repository: Repository<Meme>, qb: SelectQueryBuilder<Meme>) {
        const tableAlias = repository.metadata.tableName;

        qb.select(tableAlias)
            .addSelect(["image.id", "bank.id", "owner.id"])
            .leftJoinAndSelect(`${tableAlias}.pictures`, "picture")
            .leftJoinAndSelect(`${tableAlias}.tags`, "tag")
            .leftJoinAndSelect(`${tableAlias}.image`, "image")
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

        const chunks = chunk(bodyItems, 1000);
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

        const totalIndexed: number = results.reduce((acc, chunk) => acc + chunk.body.items.length, 0);
        return totalIndexed;
    }
}

export type MemePictureDocument = {
    id: number;
    iri: string;
    "@id": string;
    originalName: string;
    name: string;
    size: number;
    url: string;
    qualities: string[];
    ratio: number;
};

export type MemeDocument = AbstractDocument & {
    tags: string[];
    tags_suggest?: string;
    upvoteCount: number;
    downvoteCount: number;
    views: number;
    isMultipartMeme: boolean;
    image: MemePictureDocument;
    pictures: MemePictureDocument[];
    banks: string[];
    owner: string;
    ownerId: number;
};
