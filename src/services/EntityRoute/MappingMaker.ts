import { EntityMetadata } from "typeorm";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";
import { path, pluck } from "ramda";

import { Operation } from "@/decorators/Groups";
import { EntityMapper } from "./EntityMapper";
import { AbstractEntity } from "@/entity";

export class MappingMaker<Entity extends AbstractEntity> {
    private mapper: EntityMapper<Entity>;

    constructor(mapper: EntityMapper<Entity>) {
        this.mapper = mapper;
    }

    public make(operation: Operation): MappingResponse {
        const selectProps = this.mapper.getSelectProps(operation, this.mapper.metadata, false);
        const relationProps = this.mapper.getRelationPropsMetas(operation, this.mapper.metadata);

        const mapping = {
            [this.mapper.metadata.tableName]: {
                selectProps,
                relationProps: pluck("propertyName", relationProps),
                mapping: {},
            },
        };

        for (let i = 0; i < relationProps.length; i++) {
            this.setMappingForRelation(mapping, operation, this.mapper.metadata.tableName, relationProps[i]);
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
            const selectProps = this.mapper.getSelectProps(operation, relation.inverseEntityMetadata, false);
            const relationProps = this.mapper.getRelationPropsMetas(operation, relation.inverseEntityMetadata);

            entityPropPath.mapping[relation.inverseEntityMetadata.tableName] = {
                selectProps,
                relationProps: pluck("propertyName", relationProps),
                mapping: {},
            };

            for (let i = 0; i < relationProps.length; i++) {
                const circularProp = this.mapper.isRelationPropCircular(
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
