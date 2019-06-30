import { IOperationsRoutes } from "./types";

export const OPERATIONS_ROUTES: IOperationsRoutes = {
    create: {
        path: "/:id",
        verb: "post",
        method(repository, entityName, props) {
            return repository
                .createQueryBuilder(entityName)
                .select(props)
                .getOne();
        },
    },
    list: {
        path: "",
        verb: "get",
        method(repository, entityName, props) {
            return repository
                .createQueryBuilder(entityName)
                .select(props)
                .getManyAndCount();
        },
    },
    details: {
        path: "/:id",
        verb: "get",
        method(repository, entityName, props) {
            return new Promise((resolve) => true);
        },
    },
    update: {
        path: "/:id",
        verb: "put",
        method(repository, entityName, props) {
            return new Promise((resolve) => true);
        },
    },
    delete: {
        path: "/:id",
        verb: "remove",
        method(repository, entityName, props) {
            return new Promise((resolve) => true);
        },
    },
};
