import { Connection } from "typeorm";
import { TeamGenerator } from "./generators/TeamGenerator";

export async function makeFixtures(connection: Connection) {
    connection;
    // await connection.synchronize(true);
    // await makeTeamBundles(connection);
    console.log("Fixtures done");
}

async function makeTeamBundles(connection: Connection) {
    console.time("makeTeamBundles");
    const teamResults = await Promise.all(
        Array(5)
            .fill(null)
            .map(() => new TeamGenerator(connection).generateBundle())
    );
    console.timeEnd("makeTeamBundles");

    return teamResults;
}
