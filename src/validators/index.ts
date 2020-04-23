import Container from "typedi";
import { EntityValidator, EntityValidatorFunctionOptions } from "@astahmer/entity-validator";
import { AbstractEntity } from "@/entity/AbstractEntity";

/** Call EntityValidator.execute on entity with given options  */
export async function validateEntity<T extends AbstractEntity>(entity: T, options?: EntityValidatorFunctionOptions) {
    const validator = Container.get(EntityValidator);
    return validator.execute(entity, options);
}

// TODO @ValidationGroups extends GroupsMetadata ? & also use it for base validator ?
