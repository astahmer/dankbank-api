import * as faker from "faker";

import { Connection, DeepPartial, ObjectType, QueryRunner, Repository, getRepository } from "typeorm";

import { AbstractEntity } from "../entity/AbstractEntity";

// Make generateBundle an optional method with interface-merging
export interface AbstractGenerator<T extends AbstractEntity> {
    generateBundle?(override: any): Promise<DeepPartial<T>>;
}

export abstract class AbstractGenerator<T extends AbstractEntity> {
    protected faker: Faker.FakerStatic = faker;
    protected repository: Repository<T>;
    protected connection: Connection;
    protected queryRunner: QueryRunner;

    constructor(protected entityClass: ObjectType<T>, connectionOrQueryRunner?: Connection | QueryRunner) {
        this.entityClass = entityClass;

        if (!connectionOrQueryRunner) {
            this.repository = getRepository(entityClass) as any;
        } else if (connectionOrQueryRunner instanceof Connection) {
            this.connection = connectionOrQueryRunner;
        } else {
            this.queryRunner = connectionOrQueryRunner;
            this.repository = this.queryRunner.manager.getRepository(entityClass) as any;
        }
    }

    abstract getDefaultValues(): DeepPartial<T>;

    async dropTable() {
        await this.repository.clear();
        return this;
    }

    async generate(override?: DeepPartial<T>): Promise<DeepPartial<T>>;
    async generate(override: DeepPartial<T>, count: number): Promise<DeepPartial<T>[]>;
    async generate(override?: DeepPartial<T>, count?: number): Promise<DeepPartial<T> | DeepPartial<T>[]> {
        if (count) {
            const items = [];
            for (let i = 0; i < count; i++) {
                items.push({ ...this.getDefaultValues(), ...override });
            }

            return this.repository.save(items);
        }

        return this.repository.save({ ...this.getDefaultValues(), ...override });
    }

    async makeBundles(override: any, count: number): Promise<DeepPartial<T>[]> {
        const promises = [];
        for (let i = 0; i < count; i++) {
            promises.push(this.generateBundle(override));
        }

        return await Promise.all(promises);
    }
}
