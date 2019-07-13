import * as Koa from "koa";
import * as Router from "koa-router";
import { Connection, Brackets, getRepository, ObjectLiteral } from "typeorm";

import { Meme } from "../entity/Meme";
import { Picture } from "../entity/Picture";
import { Category } from "../entity/Category";
import { User } from "../entity/User";
import { Team } from "../entity/Team";
import values from "ramda/es/values";

export function useCustomRoute(connection: Connection, app: Koa) {
    const router = new Router();
    router.get("/custom", async (ctx) => {
        // const qb = connection.createQueryBuilder(Team, "team");
        // qb.select(["user.firstName", "team.teamName"])
        //     .from(User, "user")
        //     .leftJoin("user.teams", "team");
        // .where("user" + ".id = :id", { id: 1 });

        // qb.select(["team.teamName", "user.firstName"])
        //     .from(Team, "team")
        //     .leftJoin("team" + "." + "members", "user");
        // .where("user" + ".id = :id", { id: 1 });

        // qb.relation(Team, "members")
        //     .of(1)
        //     .add(2);

        // const result = qb
        //     .insert()
        //     .into(Team)
        //     .values({ teamName: "pisse acide" })
        //     .execute();

        /*
        const req = connection
            .createQueryBuilder()
            .select("user.id")
            .from(User, "user")
            // .andWhere("user.firstName = :firstName", { firstName: "abc" })
            .orWhere(
                new Brackets((qb) => {
                    qb.andWhere("user.firstName = :firstName1", { firstName1: "abc" })
                        .andWhere("user.lastName = :lastName1", { lastName1: "abc" })
                        .andWhere("user.age = :age1", { age1: 2 });
                })
            )
            .orWhere(
                new Brackets((qb) => {
                    qb.andWhere("user.firstName = :firstName2", { firstName2: "def" })
                        .andWhere("user.lastName = :lastName2", { lastName2: "def" })
                        .andWhere("user.age = :age2", { age2: 3 });
                })
            )
            .orWhere(
                new Brackets((qb) => {
                    qb.andWhere("user.firstName = :firstName3", { firstName3: "ghi" })
                        .andWhere("user.lastName = :lastName3", { lastName3: "ghi" })
                        .andWhere("user.age = :age3", { age3: 4 });
                })
            );

        console.log(req.getQueryAndParameters());
        const result = await req.execute();

        */

        /*
        const valuesMultiple = [];
        for (let i = 0; i < 300; i++) {
            valuesMultiple.push({ firstName: "abc", lastName: "abc", age: 1 });
        }

        console.time("multiple");
        const promise = connection
            .createQueryBuilder()
            .insert()
            .into(User)
            .values(valuesMultiple)
            .updateEntity(false)
            .execute();
        // console.log(qb.getSql());
        const resultMultiple = await promise;
        console.timeEnd("multiple");
        */

        /*
        console.time("single");
        const promises = [];
        const userv = { firstName: "abc", lastName: "abc", age: 1 };
        for (let i = 0; i < 300; i++) {
            promises.push(
                connection
                    .createQueryBuilder()
                    .insert()
                    .into(User)
                    .values(userv)
                    .updateEntity(false)
                    .execute()
            );
        }
        const resultSingle = await Promise.all(promises);
        console.timeEnd("single");
        */

        const qb = connection
            .createQueryBuilder()
            .select(["category.name", "user.id"])
            .from(User, "user")
            .leftJoin("user.profileCategory", "category")
            .where("user" + ".id = :id", { id: 16621 });
        console.log(qb.getSql());
        const result = qb.getRawAndEntities();

        // console.log(qb.getSql());
        // console.log(await qb.getCount());
        // console.log(await qb.execute());

        // ctx.body = result;
        // ctx.body = "yes";
        // ctx.body = await qb.getRawAndEntities();
        ctx.body = { result };
    });

    router.get("/saveFixtures", async (ctx) => {
        // console.log(connection.entityMetadatas);
        let repo, entities: ObjectLiteral[], relations;
        connection.entityMetadatas.map(async (meta) => {
            repo = getRepository(meta.tableName);
            // relations = meta.relations.map((rel) => rel.propertyName);
            // entities = await repo.find({ relations });
            entities = await repo
                .createQueryBuilder(meta.tableName)
                .select(meta.tableName)
                .getMany();
            relations = await Promise.all(meta.relations.map((rel) => connection.relationIdLoader.load(rel, entities)));

            // const data = connection.relationLoader.load();
            // relations = connection.relationIdLoader.load(entities[0],)
            console.log();
            // console.log(meta.relations);
        });
        ctx.body = "oui";
    });
    app.use(router.routes());
}
