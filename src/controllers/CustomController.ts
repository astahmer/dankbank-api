import * as Koa from "koa";
import * as Router from "koa-router";
import { Connection } from "typeorm";

import { Meme } from "../entity/Meme";
import { Picture } from "../entity/Picture";
import { Category } from "../entity/Category";
import { User } from "../entity/User";
import { Team } from "../entity/Team";

export function useCustomRoute(connection: Connection, app: Koa) {
    const router = new Router();
    router.get("/custom", async (ctx) => {
        const qb = connection.createQueryBuilder();
        qb.select(["user.firstName", "team.teamName"])
            .from(User, "user")
            .leftJoin("user.teams", "team");
        // .where("user" + ".id = :id", { id: 1 });
        // qb.select(["team.teamName", "user.firstName"])
        //     .from(Team, "team")
        //     .leftJoin("team" + "." + "members", "user");
        // .where("user" + ".id = :id", { id: 1 });
        console.log(qb.getSql());
        // console.log(qb.getSql());
        console.log(await qb.getCount());
        ctx.body = await qb.getRawAndEntities();
    });
    app.use(router.routes());
}
