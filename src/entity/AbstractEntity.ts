import {
    CreateDateColumn, getRepository, ObjectType, PrimaryGeneratedColumn, UpdateDateColumn
} from "typeorm";

import { Groups } from "@/services/EntityRoute/Decorators";
import { getRouteMetadata } from "@/services/EntityRoute/EntityRoute";

export abstract class AbstractEntity {
    @Groups(["create", "list", "details", "update"])
    @PrimaryGeneratedColumn()
    id: number;

    @CreateDateColumn()
    dateCreated: Date;

    @UpdateDateColumn()
    dateUpdated: Date;

    get repository() {
        return this.getEntityRepository();
    }

    get baseRoute() {
        const routeMetadata = getRouteMetadata(this.constructor);
        return routeMetadata && "/api" + routeMetadata.path;
    }

    @Groups(["list", "details"], "@id")
    getIri() {
        return this.baseRoute ? this.baseRoute + "/" + this.id : this.id;
    }

    @Groups(["list", "details"], "@type")
    getClassName() {
        return this.constructor.name;
    }

    getEntityRepository<T = any>(type?: ObjectType<T>) {
        return getRepository<T>(type || this.getClassName());
    }

    getEntityMetadata() {
        return this.repository.metadata;
    }
}
