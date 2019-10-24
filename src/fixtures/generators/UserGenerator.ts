import { QueryRunner } from "typeorm";

import { User } from "@/entity/User";
import { Visibility } from "@/entity/Visibility";
import { logger } from "@/services/logger";

import { AbstractGenerator } from "../AbstractGenerator";
import { FileGenerator } from "./FileGenerator";
import { MemeBankGenerator } from "./MemeBankGenerator";

export class UserGenerator extends AbstractGenerator<User> {
    constructor(queryRunner: QueryRunner) {
        super(User, queryRunner);
    }

    getDefaultValues() {
        return {
            name: this.faker.internet.userName(),
            email: this.faker.internet.email(),
            visibility: Visibility.PUBLIC,
        };
    }

    async generateBundle() {
        const bankGen = new MemeBankGenerator(this.queryRunner);
        const fileGen = new FileGenerator(this.queryRunner);

        const user = await this.generate();
        const profilePicture = fileGen.generate();

        const favorites = bankGen.generate({
            owner: user,
            title: "Favorites",
            description: "Memes marked as favorites.",
            visibility: Visibility.PRIVATE,
        });

        const banks = bankGen.makeBundles({ ownerId: user.id }, 3);

        user.profilePicture = await profilePicture;
        user.favorites = await favorites;

        // Waiting for MemeBanks to be generated & user to save relations
        await Promise.all([banks, this.repository.save(user)]);

        logger.info("✔️ UserGenerator.generateBundle");

        return user;
    }
}
