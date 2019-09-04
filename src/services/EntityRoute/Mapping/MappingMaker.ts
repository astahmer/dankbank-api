import { EntityMetadata } from "typeorm";
import { path, pluck } from "ramda";

import { Operation } from "@/decorators/Groups";
import { EntityMapper } from "./EntityMapper";
import { AbstractEntity } from "@/entity";
import { ENTITY_META_SYMBOL } from "../GroupsMetadata/GroupsMetadata";

export type MappingItem = {
    metadata?: EntityMetadata;
    mapping: MappingResponse;
    exposedProps?: any;
    selectProps?: any;
    relationProps?: any;
    [ENTITY_META_SYMBOL]: EntityMetadata;
};

export type MappingResponse = Record<string, MappingItem>;

export class MappingMaker<Entity extends AbstractEntity> {
    private mapper: EntityMapper<Entity>;

    constructor(mapper: EntityMapper<Entity>) {
        this.mapper = mapper;
    }

    /** Make the mapping object for this entity on a given operation */
    public make(operation: Operation): MappingItem {
        return this.getMappingFor({}, operation, this.mapper.metadata, "", this.mapper.metadata.tableName);
    }

    /**
     * Retrieve mapping at current path
     *
     * @param currentPath dot delimited path to keep track of the properties select nesting
     */
    public getNestedMappingAt(currentPath: string | string[], mapping: MappingItem): MappingItem {
        currentPath = Array.isArray(currentPath) ? currentPath : currentPath.split(".");
        const currentPathArray = ["mapping"].concat(currentPath.join(".mapping.").split("."));
        return path(currentPathArray, mapping);
    }

    /**
     * Retrieve & set mapping from exposed/relations props of an entity
     *
     * @param mapping object that will be recursively written into
     * @param operation
     * @param entityMetadata
     * @param currentPath keep track of current mapping path
     * @param currentTableNamePath used to check max depth
     */
    private getMappingFor(
        mapping: MappingResponse,
        operation: Operation,
        entityMetadata: EntityMetadata,
        currentPath: string,
        currentTableNamePath: string
    ) {
        const selectProps = this.mapper.getSelectProps(operation, entityMetadata, false);
        const relationProps = this.mapper.getRelationPropsMetas(operation, entityMetadata);

        const nestedMapping: MappingItem = {
            selectProps,
            relationProps: pluck("propertyName", relationProps),
            [ENTITY_META_SYMBOL]: entityMetadata,
            mapping: {},
        };

        for (let i = 0; i < relationProps.length; i++) {
            const circularProp = this.mapper.isRelationPropCircular(
                currentTableNamePath,
                relationProps[i].entityMetadata,
                relationProps[i]
            );
            if (circularProp) {
                continue;
            }

            nestedMapping.mapping[relationProps[i].propertyName] = this.getMappingFor(
                mapping,
                operation,
                relationProps[i].inverseEntityMetadata,
                currentPath + "." + relationProps[i].propertyName,
                currentTableNamePath + "." + relationProps[i].inverseEntityMetadata.tableName
            );
        }

        return nestedMapping;
    }
}
