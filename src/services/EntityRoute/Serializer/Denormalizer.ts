import { validate, ValidationError, ValidatorOptions } from "class-validator";
import { DeepPartial, QueryRunner, Repository } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { isObject, isPrimitive } from "util";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { RouteOperation } from "@/services/EntityRoute/Decorators/Groups";

import { ENTITY_META_SYMBOL } from "../GroupsMetadata/GroupsMetadata";
import { EntityMapper, MappingItem } from "../Mapping/EntityMapper";
import { validateClass } from "@/validators/ClassValidator";
import { formatIriToId } from "../Filters/SearchFilter";
import { logger } from "@/services/logger";

export class Denormalizer<Entity extends AbstractEntity> {
    constructor(private repository: Repository<Entity>, private mapper: EntityMapper) {}

    get metadata() {
        return this.repository.metadata;
    }

    /** Method used when making a POST request */
    public async insertItem(
        values: QueryDeepPartialEntity<Entity>,
        params?: { operation?: RouteOperation; queryRunner?: QueryRunner }
    ) {
        return this.saveItem(params.operation || "create", values, params.queryRunner);
    }

    /** Method used when making a PUT request on a specific id */
    public async updateItem(
        values: QueryDeepPartialEntity<Entity>,
        params?: { operation?: RouteOperation; queryRunner?: QueryRunner }
    ) {
        return this.saveItem(params.operation || "update", values, params.queryRunner);
    }

    /** Clean & validate item and then save it if there was no error */
    private async saveItem(
        operation: RouteOperation,
        values: QueryDeepPartialEntity<Entity>,
        queryRunner?: QueryRunner
    ) {
        const repository = queryRunner
            ? queryRunner.manager.getRepository<Entity>(this.metadata.target)
            : this.repository;
        const cleanedItem = this.cleanItem(operation, values);
        const item = repository.create((cleanedItem as any) as DeepPartial<Entity>);

        // TODO Validations groups
        const validatorOptions: ValidatorOptions = operation === "update" ? { skipMissingProperties: false } : {};
        const errors = await this.validateItem(item, validatorOptions);

        if (Object.keys(errors).length) {
            return { hasValidationErrors: true, errors } as EntityErrorResponse;
        }

        return repository.save((item as any) as DeepPartial<Entity>);
    }

    /** Return a clone of this request body values with only mapped props */
    public cleanItem(
        operation: RouteOperation,
        values: QueryDeepPartialEntity<Entity>
    ): QueryDeepPartialEntity<Entity> {
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

        // If item is an iri/id (coming from an array), just return it in object with proper id
        if (isPrimitive(item)) {
            mapping = this.mapper.getNestedMappingAt(currentPath, routeMapping);
            return mapping && mapping.exposedProps.length === 1 && mapping.exposedProps[0] === "id"
                ? { id: formatIriToId(item) }
                : clone;
        }

        for (key in item) {
            prop = item[key];
            mapping = currentPath.length ? this.mapper.getNestedMappingAt(currentPath, routeMapping) : routeMapping;

            if (!isPropMapped(key, mapping)) {
                continue;
            }

            if (Array.isArray(prop)) {
                if (!this.mapper.isPropSimple(mapping[ENTITY_META_SYMBOL], key)) {
                    clone[key] = prop.map((nestedItem) =>
                        this.recursiveClean(nestedItem, {}, currentPath.concat(key), routeMapping)
                    );
                } else {
                    clone[key] = prop;
                }
            } else if (isObject(prop)) {
                nestedMapping = this.mapper.getNestedMappingAt(currentPath.concat(key), mapping);
                if (hasAnyNestedPropMapped(nestedMapping)) {
                    clone[key] = this.recursiveClean(prop, {}, currentPath.concat(key), routeMapping);
                } else if (!nestedMapping && this.mapper.isPropSimple(mapping[ENTITY_META_SYMBOL], key)) {
                    clone[key] = prop;
                }
            } else if (isPrimitive(prop)) {
                const isRelation = mapping[ENTITY_META_SYMBOL].findRelationWithPropertyPath(key);
                // Format IRI to id && string "id" to int id
                if (typeof prop === "string" && (isRelation || key === "id")) {
                    clone[key] = formatIriToId(prop);
                } else {
                    clone[key] = prop;
                }
            }
        }

        return clone;
    }

    /** Recursively validate sent values & returns errors for each entity not passing validation */
    private async recursiveValidate(
        item: Entity,
        currentPath: string,
        errorResults: Record<string, EntityError[]>,
        options: ValidatorOptions
    ) {
        let key: string, prop: any;

        const keys = Object.keys(item);
        // If user is updating entity and item is just an existing relation, no need to validate it since it's missing properties
        if ((options.skipMissingProperties || currentPath.includes(".")) && keys.length === 1 && keys[0] === "id") {
            return [];
        }

        const [propErrors, classErrors] = await Promise.all([validate(item, options), validateClass(item, options)]);
        const itemErrors: EntityError[] = propErrors
            .concat(classErrors)
            .map((err) => ({ currentPath, property: err.property, constraints: err.constraints }));

        if (itemErrors.length) {
            // Gotta use item.className for root level errors in order to have a non-empty string as a key
            errorResults[currentPath || item.getClassName()] = itemErrors;
        }

        // Recursively validates item.props
        const makePromise = (nestedItem: Entity, path: string): Promise<void> =>
            new Promise(async (resolve) => {
                try {
                    const errors = await this.recursiveValidate(nestedItem, path, errorResults, options);
                    if (errors.length) {
                        errorResults[path] = errors;
                    }
                    resolve();
                } catch (error) {
                    logger.error(`Validation failed at path ${path}`);
                    logger.error(error);
                    resolve();
                }
            });

        const path = currentPath ? currentPath + "." : "";

        // Parallel validation on item.props
        const promises: Promise<void>[] = [];
        for (key in item) {
            prop = (item as Record<string, any>)[key];

            if (Array.isArray(prop)) {
                let i = 0;
                for (i; i < prop.length; i++) {
                    promises.push(makePromise(prop[i], `${path}${key}[${i}]`));
                }
            } else if (prop instanceof Object && prop.constructor.prototype instanceof AbstractEntity) {
                promises.push(makePromise(prop, `${path}${key}`));
            }
        }

        await Promise.all(promises);

        return itemErrors;
    }

    /** Validates sent values & return a record of validation errors */
    private async validateItem(item: Entity, options: ValidatorOptions) {
        const errors: EntityErrorResults = {};
        await this.recursiveValidate(item, "", errors, options);
        return errors;
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

export type EntityError = {
    currentPath: string;
    property: string;
    constraints: {
        [type: string]: string;
    };
};
export type EntityErrorResults = Record<string, EntityError[]>;
export type EntityErrorResponse = { hasValidationErrors: true; errors: EntityErrorResults };
