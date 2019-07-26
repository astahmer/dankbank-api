import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, getRepository, Repository } from "typeorm";
import { Groups } from "../decorators";
import { IRouteMetadatas } from "../services/EntityRoute/types";

const getRouteMetadata = (entity: Function): IRouteMetadatas => Reflect.getOwnMetadata("route", entity);

export abstract class AbstractEntity {
    private repository: Repository<AbstractEntity>;

    @Groups(["list", "details"])
    @PrimaryGeneratedColumn()
    id: number;

    @CreateDateColumn()
    dateCreated: string;

    @UpdateDateColumn()
    dateUpdated: string;

    getBaseRoute() {
        const routeMetadatas = getRouteMetadata(this.constructor);
        return routeMetadatas && "/api" + routeMetadatas.path;
    }

    @Groups(["list", "details"], "@id")
    getIri() {
        return this.getBaseRoute() + "/" + this.id;
    }

    @Groups(["list", "details"], "@type")
    getClassName() {
        return this.constructor.name;
    }

    getEntityRepository() {
        this.repository = getRepository(this.getClassName());
    }

    getEntityMetadata() {
        return this.repository.metadata;
    }
}
