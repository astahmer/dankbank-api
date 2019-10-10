import { Connection } from "typeorm";
import { UserGenerator } from "./generators/UserGenerator";
import { logger } from "@/services/logger";

export async function makeFixtures(connection: Connection, drop = false) {
    logger.info("Syncing schema...");
    await connection.synchronize(drop);
    logger.info("Done syncing schema");

    logger.info("Making fixtures...");
    await makeUserBundles(connection);
    logger.info("Done making fixtures");
}

async function makeUserBundles(connection: Connection) {
    const start = Date.now();
    const userCount = 10;

    const queryRunner = connection.createQueryRunner();
    /* This will make subscriber ignore afterInsert/afterUpdate event
    -> to avoid indexing ElasticSearch document 1 per 1 and use a bulk operation after fixtures are done */
    queryRunner.data.isMakingFixtures = true;

    await queryRunner.startTransaction();
    logger.info("Making User bundles...");

    try {
        const userResults = await new UserGenerator(queryRunner).makeBundles({}, userCount);
        logger.info("Done making " + userCount + " User bundle in " + (Date.now() - start) / 1000 + "s");

        await queryRunner.commitTransaction();
        return userResults;
    } catch (error) {
        logger.error(error);
        await queryRunner.rollbackTransaction();
    } finally {
        await queryRunner.release();
    }
}
