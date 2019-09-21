import { AbstractGenerator } from "../AbstractGenerator";
import { Tag } from "@/entity/Tag";
import { QueryRunner } from "typeorm";

export class TagGenerator extends AbstractGenerator<Tag> {
    constructor(queryRunner: QueryRunner) {
        super(Tag, queryRunner);
    }

    getDefaultValues() {
        return {
            tag: this.faker.random.word(),
            upvoteCount: this.faker.random.number({ min: 0, max: 500 }),
        };
    }
}
