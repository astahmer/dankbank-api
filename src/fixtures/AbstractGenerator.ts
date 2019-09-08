import * as faker from "faker";
import { Connection, Repository, getRepository, DeepPartial } from "typeorm";
import { AbstractEntity } from "../entity/AbstractEntity";
import { Entity } from "@/utils/globalTypes";

// Make generateBundle an optional method with interface-merging
export interface AbstractGenerator<T extends AbstractEntity> {
    generateBundle?(override: any): Promise<DeepPartial<T>>;
}

export abstract class AbstractGenerator<T extends AbstractEntity> {
    protected faker: Faker.FakerStatic = faker;
    protected repository: Repository<T>;

    constructor(protected entityClass: Entity<T>) {
        this.entityClass = entityClass;
        this.repository = getRepository(entityClass) as any;
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
