import { QueryRunner } from "typeorm";

import { Image } from "@/entity/Image";

import { AbstractGenerator } from "../AbstractGenerator";

export class ImageGenerator extends AbstractGenerator<Image> {
    constructor(queryRunner: QueryRunner) {
        super(Image, queryRunner);
    }

    getDefaultValues() {
        const name = this.faker.system.fileName("jpg");

        return {
            originalName: name,
            name: name + "_" + Date.now(),
            size: this.faker.random.number({ min: 0, max: 5000 }),
        };
    }
}
