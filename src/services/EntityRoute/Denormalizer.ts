import { SelectQueryBuilder, DeepPartial } from "typeorm";

import { AbstractEntity } from "@/entity/AbstractEntity";
import { Operation } from "@/decorators/Groups";
import { recursiveBrowse, PropertyHookArgs, setNestedKey } from "./utils";
import { EntityRoute } from "./EntityRoute";
import { isObject } from "util";
import { MappingItem } from "./MappingMaker";
import { validate } from "class-validator";

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
        return this.saveItem("create", values);
    }

    private async saveItem(operation: Operation, values: DeepPartial<Entity>) {
        const item: DeepPartial<Entity> = this.repository.create(this.cleanItem(operation, values)) as any;
        const errors = await validate(item, { skipMissingProperties: true });

        if (errors.length) {
            return errors;
        }

        return this.repository.save(item);
    }

    /**
     * Removes non-mapped (deep?) properties from values
     *
     * @param operation
     * @param values
     */
    private cleanItem(operation: Operation, values: DeepPartial<Entity>): DeepPartial<Entity> {
        const routeMapping = this.mapper.make(operation);
        const item: any = {};

        let mapping;
        const isPropMapped = (prop: string, entityMapping: MappingItem) =>
            entityMapping && entityMapping.selectProps.concat(entityMapping.relationProps).includes(prop);
        const propHook = ({ item, key, prop, parentProperty, currentPath }: PropertyHookArgs) => {
            mapping = parentProperty ? this.mapper.getNestedMappingAt(currentPath, routeMapping) : routeMapping;
            if (!isPropMapped(key, mapping) || isObject(prop) || Array.isArray(prop)) {
                return;
            }

            if (!parentProperty && !isObject(prop)) {
                item[key] = prop;
            } else {
                setNestedKey(item, [].concat(currentPath, key), prop);
            }
        };

        recursiveBrowse({ item, prop: values, currentPath: [], propHook });

        return item;
    }
}
