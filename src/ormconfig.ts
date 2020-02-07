export const TypeORMConfig = {
    username: process.env.TYPEORM_USERNAME,
    password: process.env.PASSWORD,
    synchronize: true,
    logging: ["query"],
    logger: "file",
    entities: ["src/entity/**/*.ts"],
    migrations: ["src/migration/**/*.ts"],
    cli: {
        entitiesDir: "src/entity",
        migrationsDir: "src/migration",
    },
};
