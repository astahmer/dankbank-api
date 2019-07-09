import * as faker from "faker";
import { Connection, Repository, getRepository, InsertResult, Brackets } from "typeorm";
import { AbstractEntity } from "../entity/AbstractEntity";
import { Entity } from "../services/EntityRoute/types";

type StringKeys<T> = Extract<keyof T, string>;
interface IAddRelationArgs<T extends AbstractEntity> {
    relationProp: StringKeys<T>;
    entity: Entity<T> | number;
    relation: Entity<T> | number | Entity<T>[] | number[];
}

export abstract class AbstractGenerator<T extends AbstractEntity> {
    protected faker: Faker.FakerStatic = faker;
    protected connection: Connection;
    protected entityClass: Entity<T>;
    protected repository: Repository<T>;
    protected insertResults: InsertResult[] = [];

    constructor(connection: Connection, entityClass: Entity<T>) {
        this.connection = connection;
        this.entityClass = entityClass;
        this.repository = getRepository(entityClass);
    }

    abstract getDefaultValues(): any;

    async dropTable() {
        await this.repository.clear();
        return this;
    }

    async logRequestTime(promise: Promise<any>, { x = 1, action = "inserted", msg = "" } = {}) {
        const start = Date.now();
        await promise;
        if (!msg) {
            console.log(`${x} ${this.repository.metadata.tableName} ${action} in ${(Date.now() - start) / 1000}s`);
        } else {
            console.log(`${msg} in ${(Date.now() - start) / 1000} s`);
        }
    }

    getLastInsert() {
        return this.insertResults[this.insertResults.length - 1];
    }

    async generate({
        override,
        x,
        shouldReturnInserted,
    }: { override?: any; x?: number; shouldReturnInserted?: boolean } = {}): Promise<any> {
        let values: any;
        if (x) {
            values = [];
            for (let i = 0; i < x; i++) {
                values.push({ ...this.getDefaultValues(), ...override });
            }
        } else {
            values = { ...this.getDefaultValues(), ...override };
        }

        const insertPromise = this.connection
            .createQueryBuilder()
            .insert()
            .into(this.entityClass)
            .values(values)
            .updateEntity(false)
            .execute();

        this.storeResult(insertPromise);

        if (shouldReturnInserted) {
            await insertPromise;
            const qb = this.connection
                .createQueryBuilder()
                .select(this.repository.metadata.tableName + ".id", "id")
                .from(this.entityClass, this.repository.metadata.tableName);

            x = x || 1;
            values = Array.isArray(values) ? values : [values];

            const props = Object.keys(values[0]);
            for (let i = 0; i < x; i++) {
                qb.orWhere(
                    new Brackets((qb) => {
                        for (let j = 0; j < props.length; j++) {
                            qb.andWhere(`${this.repository.metadata.tableName}.${props[j]} = :${props[j]}${i}`, {
                                [props[j] + i]: values[i][props[j]],
                            });
                        }
                    })
                );
            }

            // console.log(qb.getQueryAndParameters());
            const returnPromise = await qb.execute();

            return returnPromise;
        }

        return insertPromise;
    }

    async generateAnd(args = {}) {
        const self = this;
        await this.generate(args);
        return self;
    }

    protected async storeResult(promise: Promise<InsertResult>) {
        const result = await promise;
        this.insertResults.push(result);
    }

    protected getRelationInsertMethod(relationProp: string) {
        const relationMetadata = this.repository.metadata.findRelationWithPropertyPath(relationProp);
        const isToManyRelation = relationMetadata.isOneToMany || relationMetadata.isManyToMany;

        return isToManyRelation ? "add" : "set";
    }

    async addRelation({ relationProp, entity, relation }: IAddRelationArgs<T>) {
        const insertMethod = this.getRelationInsertMethod(relationProp);

        const promise = this.connection
            .createQueryBuilder()
            .relation(this.entityClass, relationProp)
            .of(entity)
            [insertMethod](relation);

        return promise;
    }
}
