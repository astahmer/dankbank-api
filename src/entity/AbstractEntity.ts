import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, getRepository, Repository } from "typeorm";
import { Groups } from "../decorators";
import { getRouteMetadata } from "@/services/EntityRoute/EntityRoute";

export abstract class AbstractEntity {
    private repository: Repository<AbstractEntity>;

    @Groups(["create", "list", "details"])
    @PrimaryGeneratedColumn()
    id: number;

    @CreateDateColumn()
    dateCreated: string;

    @UpdateDateColumn()
    dateUpdated: string;

    getBaseRoute() {
        const routeMetadata = getRouteMetadata(this.constructor);
        return routeMetadata && "/api" + routeMetadata.path;
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
