import { IOperationsRoutes } from "./types";

export const OPERATIONS_ROUTES: IOperationsRoutes = {
    create: {
        path: "",
        verb: "post",
        async method({ repository, tableName, values, selectProps }) {
            const result = await repository
                .createQueryBuilder()
                .insert()
                .into(tableName)
                .values(values)
                .execute();

            return repository
                .createQueryBuilder(tableName)
                .select(selectProps)
                .where(`${tableName}.id = :id`, { id: result.raw })
                .getOne();
        },
    },
    list: {
        path: "",
        verb: "get",
        async method() {
            return;
        },
    },
    details: {
        path: "/:id",
        verb: "get",
        method({ repository, tableName, selectProps, entityId }) {
            return repository
                .createQueryBuilder(tableName)
                .select(selectProps)
                .where(`${tableName}.id = :id`, { id: entityId })
                .getOne();
        },
    },
    update: {
        path: "/:id",
        verb: "put",
        async method({ repository, tableName, values, entityId, selectProps }) {
            const result = await repository
                .createQueryBuilder()
                .insert()
                .update(tableName)
                .set(values)
                .where(`${tableName}.id = :id`, { id: entityId })
                .execute();

            return repository
                .createQueryBuilder(tableName)
                .select(selectProps)
                .where(`${tableName}.id = :id`, { id: result.raw })
                .getOne();
        },
    },
    delete: {
        path: "/:id",
        verb: "remove",
        method({ repository }) {
            return new Promise((_resolve) => repository);
        },
    },
};
