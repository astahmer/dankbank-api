import { Connection } from "typeorm";
import { AbstractGenerator } from "../AbstractGenerator";
import { User } from "@/entity/User";
import { CategoryGenerator } from "./CategoryGenerator";
import { PictureGenerator } from "./PictureGenerator";
import { MemeGenerator } from "./MemeGenerator";

export class UserGenerator extends AbstractGenerator<User> {
    constructor(connection: Connection) {
        super(connection, User);
    }

    getDefaultValues() {
        return {
            firstName: this.faker.name.firstName(),
            lastName: this.faker.name.lastName(),
            age: this.faker.random.number({ min: 15, max: 50 }),
            isProfilePublic: this.faker.random.boolean(),
            birthDate: this.faker.date.between("1990-01-01", "2003-12-31"),
        };
    }

    async generateBundle() {
        const memeGenerator = new MemeGenerator(this.connection);
        const memePromises = Promise.all(
            Array(2)
                .fill(null)
                .map(() => memeGenerator.generateBundle())
        );
        const [memes, picture, category] = await Promise.all([
            memePromises,
            new PictureGenerator(this.connection).generate(),
            new CategoryGenerator(this.connection).generateBundle(),
        ]);
        const user = await this.generate({ profilePicture: picture.raw.insertId });

        const memeRelationsPromises = [];
        let i;
        let relation;
        for (i = 0; i < memes.length; i++) {
            relation = memes[i].raw.insertId;
            memeRelationsPromises.push(
                this.addRelation({
                    relationProp: "memes",
                    entity: user.raw.insertId,
                    relation,
                })
            );
        }

        const profileCatPromise = this.addRelation({
            relationProp: "profileCategory",
            entity: user.raw.insertId,
            relation: category.raw.insertId,
        });

        const promises = Promise.all([memeRelationsPromises, profileCatPromise]);

        await promises;

        console.log("✔️ UserGenerator.generateBundle");
        return user.raw.insertId;
    }
}
