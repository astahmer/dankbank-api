import { AbstractGenerator } from "../AbstractGenerator";
import { File } from "@/entity/File";
import { QueryRunner } from "typeorm";

export class FileGenerator extends AbstractGenerator<File> {
    constructor(queryRunner: QueryRunner) {
        super(File, queryRunner);
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
