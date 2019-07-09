import { Connection } from "typeorm";
import { UserGenerator } from "./generators/UserGenerator";
import { TeamGenerator } from "./generators/TeamGenerator";
import { CategoryGenerator } from "./generators/CategoryGenerator";

export async function makeFixtures(connection: Connection) {
    await makeTeamBundles(connection);
    console.log("Fixtures done");
}

async function makeTeamBundles(connection: Connection) {
    const [teamGenerator] = await Promise.all([
        new TeamGenerator(connection).dropTable(),
        new UserGenerator(connection).dropTable(),
        new CategoryGenerator(connection).dropTable(),
    ]);

    console.time("makeTeamBundles");
    const teamResults = await Promise.all(
        Array(5)
            .fill(null)
            .map(() => teamGenerator.generateBundle())
    );
    console.timeEnd("makeTeamBundles");

    return teamResults;
}
