import { InsertResult, UpdateResult } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { validate, ValidationError, ValidatorOptions } from "class-validator";
import { isObject, isPrimitive } from "util";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { Operation } from "@/services/EntityRoute/decorators/Groups";
import { EntityRoute } from "../EntityRoute";
import { MappingItem } from "../Mapping/MappingMaker";
import { formatEntityId } from "../utils";
import { ENTITY_META_SYMBOL } from "../GroupsMetadata/GroupsMetadata";

export class Denormalizer<Entity extends AbstractEntity> {
    constructor(private entityRoute: EntityRoute<Entity>) {}

    get repository() {
        return this.entityRoute.repository;
    }

    get metadata() {
        return this.repository.metadata;
    }

    get mapper() {
        return this.entityRoute.mapper;
    }

    /** Method used when making a POST request */
    public async insertItem(values: QueryDeepPartialEntity<Entity>) {
        return this.saveItem("create", values) as Promise<InsertResult | ErrorMappingItem>;
    }

    /** Method used when making a PUT request on a specific id */
    public async updateItem(values: QueryDeepPartialEntity<Entity>) {
        return this.saveItem("update", values) as Promise<UpdateResult | ErrorMappingItem>;
    }

    /** Clean & validate item and then save it if there was no error */
    private async saveItem(operation: Operation, values: QueryDeepPartialEntity<Entity>) {
        const item = this.repository.create(values as any);
        const cleanedItem = this.cleanItem(operation, item as any);

        const validatorOptions = operation === "update" ? { skipMissingProperties: true } : undefined;
        const errorMapping = await this.recursiveValidate(cleanedItem, [], validatorOptions);

        if (hasAnyError(errorMapping)) {
            return errorMapping;
        }

        if (operation === "update") {
            return this.repository.update(cleanedItem.id as any, cleanedItem);
        } else {
            return this.repository.insert(cleanedItem);
        }
    }

    /** Return a clone of this request body values with only mapped props */
    private cleanItem(operation: Operation, values: QueryDeepPartialEntity<Entity>): QueryDeepPartialEntity<Entity> {
        const routeMapping = this.mapper.make(operation);
        return this.recursiveClean(values, {}, [], routeMapping);
    }

    /** Removes non-mapped (deep?) properties from sent values & format entity.id */
    private recursiveClean(
        item: any,
        clone: any,
        currentPath: string[],
        routeMapping: MappingItem
    ): QueryDeepPartialEntity<Entity> {
        let key: string, prop, mapping, nestedMapping;

        for (key in item) {
            prop = item[key];
            mapping = currentPath.length ? this.mapper.getNestedMappingAt(currentPath, routeMapping) : routeMapping;

            if (!isPropMapped(key, mapping)) {
                continue;
            }

            if (Array.isArray(prop)) {
                clone[key] = prop.map((nestedItem) =>
                    this.recursiveClean(nestedItem, {}, currentPath.concat(key), routeMapping)
                );
            } else if (isObject(prop)) {
                nestedMapping = this.mapper.getNestedMappingAt(currentPath.concat(key), mapping);
                if (hasAnyNestedPropMapped(nestedMapping)) {
                    clone[key] = this.recursiveClean(prop, {}, currentPath.concat(key), routeMapping);
                }
            } else if (isPrimitive(prop)) {
                const isRelation = mapping[ENTITY_META_SYMBOL].findRelationWithPropertyPath(key);
                // Format IRI to id && string "id" to int id
                if (typeof prop === "string" && (isRelation || key === "id")) {
                    clone[key] = formatEntityId(prop);
                } else {
                    clone[key] = prop;
                }
            }
        }

        return clone;
    }

    /** Recursively validate sent values & returns errors for each entity not passing validation */
    private async recursiveValidate(
        item: any,
        currentPath: string[],
        options?: ValidatorOptions
    ): Promise<ErrorMappingItem> {
        let key: string, prop;

        const keys = Object.keys(item);
        // If user is updating entity and item is just an existing relation, no need to validate it since it's missing properties
        if (
            ((options && options.skipMissingProperties) || currentPath.length) &&
            keys.length === 1 &&
            keys[0] === "id"
        ) {
            return {
                currentPath,
                errors: [],
                nested: null,
            };
        }

        const errors = await validate(item, options);
        const errorMapping: ErrorMappingItem = {
            currentPath,
            errors,
            nested: null,
        };

        for (key in item) {
            prop = item[key];

            if (Array.isArray(prop)) {
                if (!errorMapping.nested) {
                    errorMapping.nested = {};
                }
                errorMapping.nested[key] = await Promise.all(
                    prop.map((nestedItem) => this.recursiveValidate(nestedItem, currentPath.concat(key), options))
                );
            } else if (prop instanceof Object && prop.constructor.prototype instanceof AbstractEntity) {
                if (!errorMapping.nested) {
                    errorMapping.nested = {};
                }
                errorMapping.nested[key] = [await this.recursiveValidate(prop, currentPath.concat(key), options)];
            }
        }

        return errorMapping;
    }
}

/** Checks that given prop is mapped in either select or relation props of a MappingItem */
export const isPropMapped = (prop: string, mapping: MappingItem) => mapping && mapping.exposedProps.includes(prop);

/** Checks that given item contains any nested mapped prop */
const isAnyItemPropMapped = (item: any, mapping: MappingItem) => {
    if (mapping) {
        const nestedProps = mapping.exposedProps;
        return nestedProps.length && Object.keys(item).some((prop) => nestedProps.includes(prop));
    }
};
/** Checks that a MappingItem contains further nested props  */
export const hasAnyNestedPropMapped = (mapping: MappingItem) => mapping && mapping.exposedProps.length;

/** Recursively checks if there was a ValidationError on some property */
function hasAnyError(errorMapping: ErrorMappingItem): boolean {
    if (errorMapping.errors.length) {
        return true;
    }

    if (errorMapping.nested) {
        let nestedError;
        return Object.keys(errorMapping.nested).some((prop) => {
            nestedError = errorMapping.nested[prop];

            if (Array.isArray(nestedError)) {
                return nestedError.some((item) => hasAnyError(item));
            } else {
                return hasAnyError(nestedError);
            }
        });
    }
}

export type ErrorMappingItem = {
    /** Path to arrive at this entity's errors from the requested route base entity  */
    currentPath: string[];
    /** Errors at this path */
    errors: ValidationError[];
    /** Entity's nested relation errors */
    nested: Record<string, ErrorMappingItem | ErrorMappingItem[]>;
};
