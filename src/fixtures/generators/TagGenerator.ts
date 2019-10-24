import { QueryRunner } from "typeorm";

import { Tag } from "@/entity/Tag";

import { AbstractGenerator } from "../AbstractGenerator";

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
