import { AbstractGenerator } from "../AbstractGenerator";
import { Picture } from "../../entity/Picture";
import { Connection } from "typeorm";

export class PictureGenerator extends AbstractGenerator<Picture> {
    constructor(connection: Connection) {
        super(connection, Picture);
    }

    getDefaultValues() {
        return {
            url: this.faker.internet.url(),
            title: this.faker.commerce.productName(),
            downloads: this.faker.random.number({ min: 0, max: 1000 }),
        };
    }
}
