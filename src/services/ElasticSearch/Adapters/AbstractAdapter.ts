import * as fs from "fs";
import * as path from "path";
import { EntityManager, SelectQueryBuilder, getConnection } from "typeorm";
import { Client } from "@elastic/elasticsearch";

import { ITransformer } from "../Transformers/ITransformer";
import { AbstractEntity } from "@/entity/AbstractEntity";
import { getUnixTimestampFromDate } from "@/services/EntityRoute/utils";
import { logger } from "@/services/logger";

const MIN_DATE = new Date("January 1, 1970 00:00:00").toISOString();
const TMP_DIR = path.resolve(__dirname, "../tmp/");

export abstract class AbstractAdapter<Entity extends AbstractEntity> {
    /** Last value of dateUpdated */
    protected lastValue: Date;
    /** CRON interval to run import queries */
    protected schedule: string;
    /** Class that will handle transforming a TypeORM Entity to an ElasticSearch Document */
    protected transformer: ITransformer<Entity>;
    protected entityManager: EntityManager;

    constructor(protected readonly client: Client, public readonly INDEX_NAME: string) {
        this.entityManager = getConnection().manager;
    }

    get transform() {
        return this.transformer.transform;
    }

    get lastValueFilepath() {
        return path.resolve(TMP_DIR, this.INDEX_NAME + ".txt");
    }

    /** This method should return mapping for the adapter's instance INDEX_NAME */
    abstract getMapping(): Record<string, any>;

    /**
     * This method will be called by ESManager
     * - should transform & import all selected entities
     * - should returns a number of imported rows
     */
    abstract async run(): Promise<void>;

    /**
     * Should be called after instanciation, it:
     * - Creates the adapter's index if not exists
     * - Put mapping if not exists
     * - Get lastValue from file or set it to MIN_DATE
     */
    async init() {
        logger.info("Init adapter for index: " + this.INDEX_NAME);
        const indexResponse = await this.client.indices.exists({ index: this.INDEX_NAME });

        if (!indexResponse.body) {
            logger.info("Index doesn't exist, creating it with its mapping.");

            const body = { mapping: { properties: this.getMapping() } };
            await this.client.indices.create({ index: this.INDEX_NAME, body });
        }

        let lastValueStr;
        try {
            lastValueStr = await this.getLastValueStored();
        } catch (error) {
            lastValueStr = MIN_DATE;
        }

        this.lastValue = new Date(lastValueStr);
        logger.info("Last indexed dateUpdated value is " + this.lastValue);
    }

    /** Add SQL statement to select entities requiring an insert/update in ES */
    addAdapterStatements(qb: SelectQueryBuilder<Entity>, tableAlias?: string) {
        qb.addSelect(`UNIX_TIMESTAMP(${tableAlias}.dateUpdated)`, "unixTimestamp")
            .andWhere(`UNIX_TIMESTAMP(${tableAlias}.dateUpdated) > :sqlLastValue`, {
                sqlLastValue: getUnixTimestampFromDate(this.lastValue),
            })
            .andWhere(`${tableAlias}.dateUpdated < NOW()`)
            .addOrderBy(`${tableAlias}.dateUpdated`);
    }

    getLastValueStored(): Promise<string> {
        return new Promise((resolve, reject) => {
            fs.readFile(this.lastValueFilepath, "utf8", (err, data) => {
                if (err) {
                    reject(err);
                }

                resolve(data);
            });
        });
    }

    updateLastValue(mostRecentDate: Date): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.writeFile(this.lastValueFilepath, mostRecentDate.toISOString(), (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        });
    }
}