import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from "typeorm";

import { MemeBank } from "@/entity/MemeBank";
import { User } from "@/entity/User";
import { Visibility } from "@/entity/Visibility";
import { logger } from "@/services/logger";

@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {
    listenTo() {
        return User;
    }

    afterInsert(event: InsertEvent<User>) {
        if (this.isEventFromFixtures(event)) {
            return;
        }

        return this.createFavoriteMemeBank(event);
    }

    isEventFromFixtures(event: InsertEvent<User> | UpdateEvent<User>) {
        return event.queryRunner.data.isMakingFixtures;
    }

    async createFavoriteMemeBank({ entity, manager }: InsertEvent<User> | UpdateEvent<User>) {
        logger.info("Creating favorites (default MemeBank) for User#" + entity.id);

        const favorites = manager.create(MemeBank, {
            id: undefined,
            owner: entity,
            title: "Favorites",
            description: "Memes marked as favorites.",
            visibility: Visibility.PRIVATE,
            isDefault: true,
        });

        const result = await manager.save(favorites);
        entity.banks = [result];

        return entity;
    }
}
