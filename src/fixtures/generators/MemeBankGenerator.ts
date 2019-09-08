import { AbstractGenerator } from "../AbstractGenerator";
import { MemeBank } from "@/entity/MemeBank";
import { Visibility } from "@/entity/Visibility";
import { FileGenerator } from "./FileGenerator";
import { User } from "@/entity/User";
import { MemeGenerator } from "./MemeGenerator";

export class MemeBankGenerator extends AbstractGenerator<MemeBank> {
    constructor() {
        super(MemeBank);
    }

    getDefaultValues() {
        return {
            title: this.faker.commerce.productName(),
            description: this.faker.company.catchPhrase(),
            visibility: Visibility.PUBLIC,
        };
    }

    async generateBundle({ ownerId }: any) {
        const fileGen = new FileGenerator();
        const memeGen = new MemeGenerator();

        const coverPicture = await fileGen.generate();
        const memes = await memeGen.makeBundles({ ownerId }, 10);

        const bank = await this.generate({
            owner: (ownerId as any) as User,
            coverPicture,
            memes,
        });

        console.log("✔️ MemeBankGenerator.generateBundle");
        return bank;
    }
}
