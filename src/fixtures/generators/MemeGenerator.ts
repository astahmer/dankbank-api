import { Connection } from "typeorm";
import { AbstractGenerator } from "../AbstractGenerator";
import { Meme } from "@/entity/Meme";
import { PictureGenerator } from "./PictureGenerator";

export class MemeGenerator extends AbstractGenerator<Meme> {
    constructor(connection: Connection) {
        super(connection, Meme);
    }

    getDefaultValues() {
        return {
            title: this.faker.commerce.productName(),
            description: this.faker.company.catchPhrase(),
            upvoteCount: this.faker.random.number({ min: 0, max: 1000 }),
            downvoteCount: this.faker.random.number({ min: 0, max: 1000 }),
        };
    }

    async generateBundle() {
        const picture = await new PictureGenerator(this.connection).generate();
        const meme = await this.generate({ picture: picture.raw.insertId });

        console.log("✔️ MemeGenerator.generateBundle");
        return meme;
    }
}
