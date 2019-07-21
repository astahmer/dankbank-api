import { GroupsMetadata } from "./GroupsMetadata";
import { Operation } from "./types";
import { EntityMetadata } from "typeorm";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";
import { COMPUTED_PREFIX } from "../../decorators/Groups";

export class EntityGroupsMetadata extends GroupsMetadata {
    /**
     * Get exposed props that are primitives props, used in queryBuilder selects
     */
    getSelectProps(operation: Operation, entityMeta: EntityMetadata, withPrefix = true) {
        return this.getExposedProps(operation, entityMeta)
            .filter(
                (propName) =>
                    propName.indexOf(COMPUTED_PREFIX) === -1 &&
                    entityMeta.relations.map((rel) => rel.propertyName).indexOf(propName) === -1
            )
            .map((propName) => (withPrefix ? entityMeta.tableName + "." : "") + propName);
    }

    /**
     * Get exposed props that are relations props, used to retrieve nested entities
     */
    getRelationPropsMetas(operation: Operation, entityMeta: EntityMetadata) {
        return this.getExposedProps(operation, entityMeta)
            .map((propName) => entityMeta.relations.find((rel) => rel.propertyName === propName))
            .filter((rel) => rel);
    }

    /**
     * Get exposed props that are computed props, used to retrieve themselves
     */
    getComputedProps(operation: Operation, entityMeta: EntityMetadata) {
        return this.getExposedProps(operation, entityMeta).filter(
            (propName) => propName.indexOf(COMPUTED_PREFIX) !== -1
        );
    }

    /**
     * Returns both selects & relations props
     */
    getExposedPropsByTypes(operation: Operation, entityMeta: EntityMetadata) {
        const selectProps: string[] = [];
        const relationProps: RelationMetadata[] = [];

        this.getExposedProps(operation, entityMeta).forEach((prop: string) => {
            const relation = entityMeta.relations.find((relation) => relation.propertyName === prop);
            if (relation) {
                relationProps.push(relation);
            } else {
                selectProps.push(entityMeta.tableName + "." + prop);
            }
        });

        return { selectProps, relationProps };
    }
}
