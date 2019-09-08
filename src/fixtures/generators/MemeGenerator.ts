import { AbstractGenerator } from "../AbstractGenerator";
import { Meme } from "@/entity/Meme";
import { TagGenerator } from "./TagGenerator";
import { FileGenerator } from "./FileGenerator";
import { User } from "@/entity/User";

export class MemeGenerator extends AbstractGenerator<Meme> {
    constructor() {
        super(Meme);
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
        const fileGen = new FileGenerator();
        const tagGen = new TagGenerator();

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
