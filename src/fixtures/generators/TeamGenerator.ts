import { Connection } from "typeorm";
import { AbstractGenerator } from "../AbstractGenerator";
import { Team } from "@/entity/Team";
import { UserGenerator } from "./UserGenerator";

export class TeamGenerator extends AbstractGenerator<Team> {
    constructor(connection: Connection) {
        super(connection, Team);
    }

    getDefaultValues() {
        return {
            teamName: this.faker.internet.userName(),
        };
    }

    async generateBundle() {
        const userGenerator = new UserGenerator(this.connection);
        const userPromises = Promise.all(
            Array(3)
                .fill(null)
                .map(() => userGenerator.generateBundle())
        );
        const [users, team] = await Promise.all([userPromises, this.generate()]);

        const membersPromise = this.addRelation({
            relationProp: "members",
            entity: team.raw,
            relation: users,
        });
        const promises = Promise.all([membersPromise]);

        await promises;
        return team.raw;
    }
}
