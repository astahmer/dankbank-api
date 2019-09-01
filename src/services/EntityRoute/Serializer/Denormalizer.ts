import { DeepPartial } from "typeorm";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { Operation } from "@/decorators/Groups";
import { EntityRoute } from "../EntityRoute";
import { isObject, isPrimitive } from "util";
import { MappingItem } from "../Mapping/MappingMaker";
import { validate, ValidationError, ValidatorOptions } from "class-validator";

export class Denormalizer<Entity extends AbstractEntity> {
    private entityRoute: EntityRoute<Entity>;

    constructor(entityRoute: EntityRoute<Entity>) {
        this.entityRoute = entityRoute;
    }

    get repository() {
        return this.entityRoute.routeRepository;
    }

    get metadata() {
        return this.repository.metadata;
    }

    get mapper() {
        return this.entityRoute.mapper;
    }

    public async insertItem(values: DeepPartial<Entity>) {
        return this.saveItem("create", values);
    }

    public async updateItem(values: DeepPartial<Entity>) {
        return this.saveItem("update", values);
    }

    /**
     * Clean & validate item and then save it if there was no error
     *
     * @param operation
     * @param values
     */
    private async saveItem(operation: Operation, values: DeepPartial<Entity>) {
        const cleanedItem = this.cleanItem(operation, values);
        const item: DeepPartial<Entity> = this.repository.create(cleanedItem) as any;

        const validatorOptions = operation === "update" ? { skipMissingProperties: true } : undefined;
        const errorMapping = await this.recursiveValidate(item, [], validatorOptions);

        if (hasAnyError(errorMapping)) {
            return errorMapping;
        }

        return this.repository.save(item);
    }

    /**
     * Removes non-mapped (deep?) properties from sent values
     *
     * @param operation
     * @param values
     */
    private cleanItem(operation: Operation, values: DeepPartial<Entity>): DeepPartial<Entity> {
        const routeMapping = this.mapper.make(operation);
        const item = this.recursiveClean(values, {}, [], routeMapping);
        return item;
    }

    private recursiveClean(
        item: any,
        clone: any,
        currentPath: string[],
        routeMapping: MappingItem
    ): DeepPartial<Entity> {
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
                clone[key] = prop;
            }
        }

        return clone;
    }

    private async recursiveValidate(
        item: any,
        currentPath: string[],
        options?: ValidatorOptions
    ): Promise<ErrorMappingItem> {
        let key: string, prop;

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
            } else if (isObject(prop)) {
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
const isPropMapped = (prop: string, mapping: MappingItem) =>
    mapping && mapping.selectProps.concat(mapping.relationProps).includes(prop);

/** Checks that given item contains any nested mapped prop */
const isAnyItemPropMapped = (item: any, mapping: MappingItem) => {
    if (mapping) {
        const nestedProps = mapping.selectProps.concat(mapping.relationProps);
        return nestedProps.length && Object.keys(item).some((prop) => nestedProps.includes(prop));
    }
};
/** Checks that a MappingItem contains further nested props  */
const hasAnyNestedPropMapped = (mapping: MappingItem) =>
    mapping && mapping.selectProps.concat(mapping.relationProps).length;

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
    currentPath: string[];
    errors: ValidationError[];
    nested: Record<string, ErrorMappingItem | ErrorMappingItem[]>;
};
