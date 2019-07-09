import { AbstractGenerator } from "../AbstractGenerator";
import { Team } from "../../entity/Team";
import { UserGenerator } from "./UserGenerator";
import { Connection } from "typeorm";
import { CategoryGenerator } from "./CategoryGenerator";

const pickId = (el: any) => el.id;

export class TeamGenerator extends AbstractGenerator<Team> {
    constructor(connection: Connection) {
        super(connection, Team);
    }

    getDefaultValues() {
        return {
            teamName: this.faker.internet.userName(),
        };
    }

    async generateBundle(shouldReturnInserted = false) {
        const userGenerator = new UserGenerator(this.connection);
        const [users, categories, team] = await Promise.all([
            userGenerator.generate({ x: 5, shouldReturnInserted: true }),
            new CategoryGenerator(this.connection).generate({ x: 2, shouldReturnInserted: true }),
            this.generate(),
        ]);

        const catPromises = [];
        for (let i = 0; i < users.length; i++) {
            catPromises.push(
                userGenerator.addRelation({
                    relationProp: "profileCategory",
                    entity: users[i],
                    relation: this.faker.random.arrayElement(categories),
                })
            );
        }

        const membersPromise = this.addRelation({
            relationProp: "members",
            entity: team.raw,
            relation: users.map(pickId),
        });
        const promises = Promise.all([catPromises, membersPromise]);

        if (shouldReturnInserted) {
            await promises;
            return team.raw;
        }

        return promises;
    }
}
