import { QueryRunner } from "typeorm";

import { Meme } from "@/entity/Meme";
import { User } from "@/entity/User";

import { AbstractGenerator } from "../AbstractGenerator";
import { FileGenerator } from "./FileGenerator";
import { TagGenerator } from "./TagGenerator";

export class MemeGenerator extends AbstractGenerator<Meme> {
    constructor(queryRunner: QueryRunner) {
        super(Meme, queryRunner);
    }

    getDefaultValues() {
        return {
            title: this.faker.commerce.productName(),
            description: this.faker.company.catchPhrase(),
            upvoteCount: this.faker.random.number({ min: 0, max: 1000 }),
            downvoteCount: this.faker.random.number({ min: 0, max: 1000 }),
            views: this.faker.random.number({ min: 0, max: 10000 }),
        };
    }

    async generateBundle({ ownerId }: { ownerId?: number }) {
        const fileGen = new FileGenerator(this.queryRunner);
        const tagGen = new TagGenerator(this.queryRunner);

        const pictures = await fileGen.generate({}, 3);
        const meme = await this.generate({
            owner: (ownerId as any) as User,
            pictures,
            tags: Array.from(Array(5)).map(() => tagGen.getDefaultValues()),
            isMultipartMeme: pictures.length > 1,
        });

        return meme;
    }
}
