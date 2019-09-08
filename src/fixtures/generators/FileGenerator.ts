import { AbstractGenerator } from "../AbstractGenerator";
import { File } from "@/entity/File";

export class FileGenerator extends AbstractGenerator<File> {
    constructor() {
        super(File);
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
