import "reflect-metadata";

import { createConnection } from "typeorm";
import { createKoaServer } from "routing-controllers";

import { UserController } from "./controllers/UserController";
import { User } from "./entity/User";

createConnection()
    .then(async (connection) => {
        console.log("Inserting a new user into the database...");
        const user = new User();
        user.firstName = "Timber";
        user.lastName = "Saw";
        user.age = 25;
        await connection.manager.save(user);
        console.log("Saved a new user with id: " + user.id);

        console.log("Loading users from the database...");
        const users = await connection.manager.find(User);
        console.log("Loaded users: ", users);

        console.log("Here you can setup and run express/koa/any other framework.");
        // creates express app, registers all controller routes and returns you express app instance
        const app = createKoaServer({
            controllers: [UserController], // we specify controllers we want to use
        });

        // run express application on port 3000
        app.listen(3000);
    })
    .catch((error) => console.log(error));
