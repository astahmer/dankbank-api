import { QueryRunner } from "typeorm";

import { MemeBank } from "@/entity/MemeBank";
import { User } from "@/entity/User";
import { Visibility } from "@/entity/Visibility";
import { logger } from "@/services/logger";

import { AbstractGenerator } from "../AbstractGenerator";
import { ImageGenerator } from "./ImageGenerator";
import { MemeGenerator } from "./MemeGenerator";

export class MemeBankGenerator extends AbstractGenerator<MemeBank> {
    constructor(queryRunner: QueryRunner) {
        super(MemeBank, queryRunner);
    }

    getDefaultValues() {
        return {
            title: this.faker.commerce.productName(),
            description: this.faker.company.catchPhrase(),
            visibility: Visibility.PUBLIC,
        };
    }

    async generateBundle({ ownerId }: any) {
        const imageGen = new ImageGenerator(this.queryRunner);
        const memeGen = new MemeGenerator(this.queryRunner);

        const coverPicture = await imageGen.generate();
        const memes = await memeGen.makeBundles({ ownerId }, 10);

        const bank = await this.generate({
            owner: (ownerId as any) as User,
            coverPicture,
            memes,
        });

        logger.info("✔️ MemeBankGenerator.generateBundle");
        return bank;
    }
}
