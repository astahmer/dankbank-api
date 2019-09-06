import { Connection } from "typeorm";
import { AbstractGenerator } from "../AbstractGenerator";
import { Category } from "@/entity/Category";
import { PictureGenerator } from "./PictureGenerator";

export class CategoryGenerator extends AbstractGenerator<Category> {
    constructor(connection: Connection) {
        super(connection, Category);
    }

    getDefaultValues() {
        return {
            name: this.faker.commerce.productName(),
            icon: this.faker.system.fileName(),
        };
    }

    async generateBundle() {
        const picture = await new PictureGenerator(this.connection).generate();
        const category = await this.generate({ picture: picture.raw.insertId });

        console.log("✔️ CategoryGenerator.generateBundle");
        return category;
    }
}
