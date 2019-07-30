import { SelectQueryBuilder, EntityMetadata } from "typeorm";
import { RouteFilter } from "../EntityRoute";
import { Normalizer } from "../Normalizer";

const getObjectOnlyKey = (obj: Object) => Object.keys(obj)[0];

export abstract class AbstractFilter {
    protected options: RouteFilter<AbstractFilter>;
    protected entityMetadata: EntityMetadata;
    protected normalizer: Normalizer;

    constructor({ options, entityMetadata, normalizer }: AbstractFilterConstructor) {
        this.options = options;
        this.entityMetadata = entityMetadata;
        this.normalizer = normalizer;
    }

    get entityProperties() {
        return this.entityMetadata.columns.map((col) => col.propertyName);
    }

    get entityRelationsProperties() {
        return this.entityMetadata.relations.map((rel) => rel.propertyName);
    }

    get filterProperties() {
        return this.options.properties.map((prop) => (typeof prop === "string" ? prop : prop[getObjectOnlyKey(prop)]));
    }

    abstract apply({  }: ApplyParams): void;
}

export type AbstractFilterConstructor = {
    entityMetadata: EntityMetadata;
    options: RouteFilter<AbstractFilter>;
    normalizer: Normalizer;
};

export type ApplyParams = {
    queryParams?: any;
    qb?: SelectQueryBuilder<any>;
    selectProps?: string[];
};
