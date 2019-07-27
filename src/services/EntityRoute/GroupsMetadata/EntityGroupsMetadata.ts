import { Operation } from "../types";
import { EntityMetadata } from "typeorm";
import { RelationMetadata } from "typeorm/metadata/RelationMetadata";
import { COMPUTED_PREFIX } from "@/decorators/Groups";
import { GroupsMetadata } from "./GroupsMetadata";

export class EntityGroupsMetadata extends GroupsMetadata {
    /**
     * Get exposed props that are primitives props, used in queryBuilder selects
     */
    getSelectProps(operation: Operation, routeContext: EntityMetadata, withPrefix = true) {
        return this.getExposedProps(operation, routeContext)
            .filter(
                (propName) =>
                    propName.indexOf(COMPUTED_PREFIX) === -1 &&
                    this.entityMeta.relations.map((rel) => rel.propertyName).indexOf(propName) === -1
            )
            .map((propName) => (withPrefix ? this.entityMeta.tableName + "." : "") + propName);
    }

    /**
     * Get exposed props that are relations props, used to retrieve nested entities
     */
    getRelationPropsMetas(operation: Operation, routeContext: EntityMetadata) {
        return this.getExposedProps(operation, routeContext)
            .map((propName) => this.entityMeta.relations.find((rel) => rel.propertyName === propName))
            .filter((rel) => rel);
    }

    /**
     * Get exposed props that are computed props, used to retrieve themselves
     */
    getComputedProps(operation: Operation, routeContext: EntityMetadata) {
        return this.getExposedProps(operation, routeContext).filter(
            (propName) => propName.indexOf(COMPUTED_PREFIX) !== -1
        );
    }

    /**
     * Returns both selects & relations props
     */
    getExposedPropsByTypes(operation: Operation, routeContext: EntityMetadata) {
        const selectProps: string[] = [];
        const relationProps: RelationMetadata[] = [];

        this.getExposedProps(operation, routeContext).forEach((prop: string) => {
            const relation = this.entityMeta.relations.find((relation) => relation.propertyName === prop);
            if (relation) {
                relationProps.push(relation);
            } else {
                selectProps.push(this.entityMeta.tableName + "." + prop);
            }
        });

        return { selectProps, relationProps };
    }
}
