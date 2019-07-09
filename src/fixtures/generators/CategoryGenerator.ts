import { AbstractGenerator } from "../AbstractGenerator";
import { Category } from "../../entity/Category";
import { Connection } from "typeorm";

export class CategoryGenerator extends AbstractGenerator<Category> {
    constructor(connection: Connection) {
        super(connection, Category);
    }

    getDefaultValues() {
        return {
            name: this.faker.commerce.productName(),
            icon: this.faker.image.imageUrl(),
        };
    }
}
