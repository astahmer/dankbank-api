import { AbstractGenerator } from "../AbstractGenerator";
import { User } from "../../entity/User";
import { Connection } from "typeorm";

export class UserGenerator extends AbstractGenerator<User> {
    constructor(connection: Connection) {
        super(connection, User);
    }

    getDefaultValues() {
        return {
            firstName: this.faker.name.firstName(),
            lastName: this.faker.name.lastName(),
            age: this.faker.random.number({ min: 15, max: 50 }),
        };
    }
}
