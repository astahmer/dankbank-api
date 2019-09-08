import { AbstractGenerator } from "../AbstractGenerator";
import { Tag } from "@/entity/Tag";

export class TagGenerator extends AbstractGenerator<Tag> {
    constructor() {
        super(Tag);
    }

    getDefaultValues() {
        return {
            tag: this.faker.random.word(),
        };
    }
}
