import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, getRepository, Repository } from "typeorm";
import { Groups } from "@/services/EntityRoute/decorators";
import { getRouteMetadata } from "@/services/EntityRoute/EntityRoute";

export abstract class AbstractEntity {
    private repository: Repository<AbstractEntity>;

    @Groups(["create", "list", "details", "update"])
    @PrimaryGeneratedColumn()
    id: number;

    @CreateDateColumn()
    dateCreated: string;

    @UpdateDateColumn()
    dateUpdated: string;

    constructor() {
        this.repository = this.getEntityRepository();
    }

    getBaseRoute() {
        const routeMetadata = getRouteMetadata(this.constructor);
        return routeMetadata && "/api" + routeMetadata.path;
    }

    @Groups(["list", "details"], "@id")
    getIri() {
        const baseRoute = this.getBaseRoute();
        return baseRoute ? baseRoute + "/" + this.id : this.id;
    }

    @Groups(["list", "details"], "@type")
    getClassName() {
        return this.constructor.name;
    }

    getEntityRepository() {
        return getRepository<any>(this.getClassName());
    }

    getEntityMetadata() {
        return this.repository.metadata;
    }
}
