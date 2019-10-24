import {
    EntitySubscriberInterface, EventSubscriber, InsertEvent, Repository, UpdateEvent
} from "typeorm";

import { Meme } from "@/entity/Meme";
import { MemeAdapter } from "@/services/ElasticSearch/Adapters/MemeAdapter";
import { ElasticSearchManager } from "@/services/ElasticSearch/ESManager";
import { logger } from "@/services/logger";

@EventSubscriber()
export class MemeSubscriber implements EntitySubscriberInterface<Meme> {
    private adapter: MemeAdapter;

    constructor(private esManager: ElasticSearchManager) {
        this.adapter = new MemeAdapter(esManager.client);
    }

    listenTo() {
        return Meme;
    }

    afterInsert(event: InsertEvent<Meme>) {
        if (this.isEventFromFixtures(event)) {
            return;
        }

        this.upsertDocumentFromEntity(event);
    }

    afterUpdate(event: UpdateEvent<Meme>) {
        if (this.isEventFromFixtures(event)) {
            return;
        }

        this.upsertDocumentFromEntity(event);
    }

    isEventFromFixtures(event: InsertEvent<Meme> | UpdateEvent<Meme>) {
        return event.queryRunner.data.isMakingFixtures;
    }

    async upsertDocumentFromEntity(event: InsertEvent<Meme> | UpdateEvent<Meme>) {
        logger.info("Indexing ElasticSearch document for Meme#" + event.entity.id);
        const repository: Repository<Meme> = (event.manager as any).getRepository(event.metadata.target);
        const qb = repository.createQueryBuilder(event.metadata.tableName);

        this.adapter.addSelects(repository, qb);
        qb.where(event.metadata.tableName + ".id = :id", { id: event.entity.id });

        const meme = await qb.getOne();
        const body = this.adapter.transform(meme);

        try {
            await this.esManager.client.index({
                index: this.adapter.INDEX_NAME,
                id: "" + meme.id,
                body,
            });
        } catch (error) {
            logger.error("Error while indexing document for Meme#" + event.entity.id);
            logger.error(error);
        }
    }
}
