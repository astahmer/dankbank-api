export const TypeORMConfig = {
    synchronize: true,
    logging: ["query"],
    logger: "file",
    migrations: ["src/migration/**/*.ts"],
    subscribers: ["src/subscribers/**/*.ts"],
    cli: {
        entitiesDir: "src/entity",
        migrationsDir: "src/migration",
    },
};
