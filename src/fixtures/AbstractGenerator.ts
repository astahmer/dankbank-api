import * as faker from "faker";
import { Connection, Repository, getRepository, Brackets } from "typeorm";
import { AbstractEntity } from "../entity/AbstractEntity";
import { Entity } from "../services/EntityRoute/types";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

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

    constructor(connection: Connection, entityClass: Entity<T>) {
        this.connection = connection;
        this.entityClass = entityClass;
        this.repository = getRepository(entityClass);
    }

    abstract getDefaultValues(): QueryDeepPartialEntity<T>;

    async dropTable() {
        await this.repository.clear();
        return this;
    }

    async returnInserted({ x, values }: { x: number; values: any }): Promise<T[]> {
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
        return await qb.execute();
    }

    async generate(override?: Partial<T>) {
        const values = { ...this.getDefaultValues(), ...override };

        return this.connection
            .createQueryBuilder()
            .insert()
            .into(this.entityClass)
            .values(values)
            .updateEntity(false)
            .execute();
    }

    async generateMultiple({ override, x }: { override?: Partial<T>; x?: number } = {}) {
        const values = [];
        for (let i = 0; i < x; i++) {
            values.push({ ...this.getDefaultValues(), ...override });
        }

        const insertPromise = this.connection
            .createQueryBuilder()
            .insert()
            .into(this.entityClass)
            .values(values)
            .updateEntity(false)
            .execute();

        return insertPromise;
    }

    async generateMultipleAndReturnIds({ override, x }: { override?: Partial<T>; x?: number } = {}) {
        const values = [];
        for (let i = 0; i < x; i++) {
            values.push({ ...this.getDefaultValues(), ...override });
        }

        const insertPromise = this.connection
            .createQueryBuilder()
            .insert()
            .into(this.entityClass)
            .values(values)
            .updateEntity(false)
            .execute();

        await insertPromise;
        return this.returnInserted({ x, values });
    }

    async generateAnd(args = {}) {
        await this.generate(args);
        return this;
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

    pickRandom(arr: any[]) {
        const randIndex = Math.floor(Math.random() * arr.length);
        const randItem = arr[randIndex];
        arr.splice(randIndex, 1);
        return randItem;
    }
}
