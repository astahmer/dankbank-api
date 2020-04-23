import {
    EntitySubscriberInterface,
    EventSubscriber,
    InsertEvent,
    Repository,
    UpdateEvent,
    RemoveEvent,
    Connection,
} from "typeorm";
import { RequestContext } from "@astahmer/entity-routes/";

import { Meme } from "@/entity/Meme";
import { MemeAdapter } from "@/services/ElasticSearch/Adapters/MemeAdapter";
import { ElasticSearchManager } from "@/services/ElasticSearch/ESManager";
import { logger } from "@/services/logger";
import Container from "typedi";

@EventSubscriber()
export class MemeSubscriber implements EntitySubscriberInterface<Meme> {
    private esManager: ElasticSearchManager;
    private adapter: MemeAdapter;

    constructor(connection: Connection) {
        this.esManager = Container.get(ElasticSearchManager);
        this.adapter = new MemeAdapter(this.esManager.client);
    }

    listenTo() {
        return Meme;
    }

    afterInsert(event: InsertEvent<Meme>) {
        if (this.isEventFromFixtures(event)) {
            return;
        }

        try {
            this.upsertDocumentFromEntity(event);
        } catch (error) {
            logger.error(error);
        }
    }

    afterUpdate(event: UpdateEvent<Meme>) {
        if (this.isEventFromFixtures(event)) {
            return;
        }

        try {
            this.upsertDocumentFromEntity(event);
        } catch (error) {
            logger.error(error);
        }
    }

    afterRemove(event: RemoveEvent<Meme>) {
        const ctx = event.queryRunner.data?.requestContext as RequestContext;
        if (!ctx?.entityId) return;

        try {
            logger.info("Removing ElasticSearch document for Meme#" + ctx.entityId);
            this.esManager.client.delete({ index: this.adapter.INDEX_NAME, id: ctx.entityId + "" });
        } catch (error) {
            logger.error(error);
        }
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
