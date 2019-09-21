export const TypeORMConfig = {
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
