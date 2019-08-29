export const TypeORMConfig = {
    type: "sqlite",
    database: "database.sqlite",
    synchronize: true,
    logging: ["query"],
    logger: "file",
    migrations: ["src/migration/**/*.ts"],
    subscribers: ["src/subscribers/**/*.ts"],
};
