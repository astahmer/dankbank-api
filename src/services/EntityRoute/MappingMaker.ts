import { EntityMetadata } from "typeorm";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";
import { path, pluck } from "ramda";

import { Normalizer } from "./Normalizer";
import { Operation } from "@/decorators/Groups";

export class MappingMaker {
    private metadata: EntityMetadata;
    private normalizer: Normalizer;

    constructor(metadata: EntityMetadata, normalizer: Normalizer) {
        this.metadata = metadata;
        this.normalizer = normalizer;
    }

    public make(operation: Operation): MappingResponse {
        const selectProps = this.normalizer.getSelectProps(operation, this.metadata, false);
        const relationProps = this.normalizer.getRelationPropsMetas(operation, this.metadata);

        const mapping = {
            [this.metadata.tableName]: {
                selectProps,
                relationProps: pluck("propertyName", relationProps),
                mapping: {},
            },
        };

        for (let i = 0; i < relationProps.length; i++) {
            this.setMappingForRelation(mapping, operation, this.metadata.tableName, relationProps[i]);
        }

        return mapping;
    }

    /**
     * Retrieve mapping at current path
     *
     * @param currentPath dot delimited path to keep track of the properties select nesting
     */
    private getMappingAt(currentPath: string, mapping: MappingResponse): MappingItem {
        const currentPathArray = currentPath
            .split(".")
            .join(".mapping.")
            .split(".");
        return path(currentPathArray, mapping);
    }

    /**
     * Retrieve & set mapping from exposed/relations props of an entity
     *
     * @param mapping object that will be recursively written into
     * @param operation
     * @param currentPath
     * @param relation
     */
    private setMappingForRelation(
        mapping: MappingResponse,
        operation: Operation,
        currentPath: string,
        relation: RelationMetadata
    ) {
        const entityPropPath = this.getMappingAt(currentPath, mapping);

        if (!entityPropPath.mapping[relation.inverseEntityMetadata.tableName]) {
            const selectProps = this.normalizer.getSelectProps(operation, relation.inverseEntityMetadata, false);
            const relationProps = this.normalizer.getRelationPropsMetas(operation, relation.inverseEntityMetadata);

            entityPropPath.mapping[relation.inverseEntityMetadata.tableName] = {
                selectProps,
                relationProps: pluck("propertyName", relationProps),
                mapping: {},
            };

            for (let i = 0; i < relationProps.length; i++) {
                const circularProp = this.normalizer.isRelationPropCircular(
                    currentPath,
                    relationProps[i].entityMetadata,
                    relation
                );
                if (circularProp) {
                    continue;
                }

                this.setMappingForRelation(
                    mapping,
                    operation,
                    currentPath + "." + relationProps[i].entityMetadata.tableName,
                    relationProps[i]
                );
            }
        }

        return entityPropPath.mapping[relation.inverseEntityMetadata.tableName];
    }
}

type MappingItem = {
    metadata?: EntityMetadata;
    mapping: MappingResponse;
    exposedProps?: any;
    selectProps?: any;
    relationProps?: any;
};

type MappingResponse = Record<string, MappingItem>;
