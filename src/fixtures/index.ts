import { Connection } from "typeorm";
import { UserGenerator } from "./generators/UserGenerator";

export async function makeFixtures(_connection: Connection) {
    // await _connection.synchronize(true);
    // await makeUserBundles();
    // console.log("Fixtures done");
}

async function makeUserBundles() {
    console.time("makeUserBundles");
    const userResults = await new UserGenerator().makeBundles({}, 10);
    console.timeEnd("makeUserBundles");

    return userResults;
}
