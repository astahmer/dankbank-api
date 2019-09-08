import { AbstractGenerator } from "../AbstractGenerator";
import { MemeBankGenerator } from "./MemeBankGenerator";
import { User } from "@/entity/User";
import { Visibility } from "@/entity/Visibility";
import { FileGenerator } from "./FileGenerator";

export class UserGenerator extends AbstractGenerator<User> {
    constructor() {
        super(User);
    }

    getDefaultValues() {
        return {
            name: this.faker.internet.userName(),
            email: this.faker.internet.email(),
            visibility: Visibility.PUBLIC,
        };
    }

    async generateBundle() {
        const bankGen = new MemeBankGenerator();
        const fileGen = new FileGenerator();

        const user = await this.generate();
        const profilePicture = fileGen.generate();

        const favorites = bankGen.generate({
            owner: user,
            title: "Favorites",
            description: "Memes marked as favorites.",
            visibility: Visibility.PRIVATE,
        });

        const banks = bankGen.makeBundles({ ownerId: user.id }, 3);

        user.profilePicture = await profilePicture;
        user.favorites = await favorites;

        // Waiting for MemeBanks to be generated & user to save relations
        await Promise.all([banks, this.repository.save(user)]);

        console.log("✔️ UserGenerator.generateBundle");
        return user;
    }
}
