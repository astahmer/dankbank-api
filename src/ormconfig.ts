import { MysqlConnectionOptions } from "typeorm/driver/mysql/MysqlConnectionOptions";

export const config = {
    type: "mariadb",
    username: process.env.TYPEORM_USERNAME,
    password: process.env.TYPEORM_PASSWORD,
    synchronize: true,
    logging: ["query"],
    logger: "file",
    entities: ["src/entity/**/*.ts"],
    migrations: ["src/migration/**/*.ts"],
    cli: {
        entitiesDir: "src/entity",
        migrationsDir: "src/migration",
    },
} as MysqlConnectionOptions;
