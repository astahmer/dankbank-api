import { ValidatorOptions, ValidationError, ValidationArguments, ValidationOptions } from "class-validator";
import { AbstractEntity } from "@/entity/AbstractEntity";
import { ObjectType } from "typeorm";
import Container, { Service } from "typedi";
import { logger } from "@/services/logger";
import { isPromise } from "@/functions/asserts";
import { RequestContext } from "@/services/EntityRoute/ResponseManager";

export const VALIDATION_METAKEY = Symbol("validation");
export const getClassValidatorMetadata = <T extends AbstractEntity>(entity: Object): ClassValidatorMetadata<T> =>
    Reflect.getOwnMetadata(VALIDATION_METAKEY, entity);

/** Call Service.ClassValidator.execute on entity with given options  */
export async function validateClass<T extends AbstractEntity>(entity: T, options?: ClassValidatorFunctionOptions) {
    const validator = Container.get(ClassValidator);
    return validator.execute(entity, options);
}

/**
 * Handle validation at the entity level
 * Which could be used for authentication, database unique checks, multi-fields conditions, etc...
 */
@Service()
export class ClassValidator {
    /** Execute all registered validators on entity */
    async execute<T extends AbstractEntity>(
        entity: T,
        options: ClassValidatorFunctionOptions = {}
    ): Promise<ValidationError[]> {
        // TODO Validations groups
        // const groups = options?.groups || [];

        const metadata = getClassValidatorMetadata(entity.constructor);
        if (!metadata) return [];

        const promises = [];
        const errors: ValidationError[] = [];

        for (const key in metadata) {
            if (metadata.hasOwnProperty(key)) {
                const config = metadata[key];
                const result = this.validate(entity, config, options);
                const onFinished = (result: boolean) => !result && errors.push(this.makeError(entity, config));

                if (isPromise(result)) {
                    const wrappedPromise = new Promise(async (resolve) => {
                        try {
                            const isValid = await result;
                            onFinished(isValid);
                            resolve();
                        } catch (error) {
                            logger.error(
                                `Async validation error for validator ${config.name} on entity ${entity.constructor.name}#${entity.id}`
                            );
                            logger.error(error);
                            resolve();
                        }
                    });
                    promises.push(wrappedPromise);
                } else if (!result) {
                    onFinished(result);
                }
            }
        }

        if (promises.length) {
            await Promise.all(promises);
        }

        return errors;
    }

    /** Call a validator's validate function with given config on entity */
    validate<T extends AbstractEntity>(
        entity: T,
        config: ClassValidatorConfig<T>,
        options: ClassValidatorFunctionOptions<T>
    ) {
        const args: ClassValidationArguments<T> = {
            value: entity,
            object: entity.constructor,
            targetName: entity.constructor?.name,
            data: config.data,
            property: config.property,
            requestContext: options.requestContext,
        };

        const validateFn = config.validator instanceof Function ? config.validator : config.validator.validate;

        return validateFn(entity, args);
    }

    /** Generates a ValidationError with given config on entity */
    makeError<T extends AbstractEntity>(entity: T, config: ClassValidatorConfig<T>): ValidationError {
        // TODO Message token + messageFn with args ? (extends interface.message)
        const message = config.options?.message || config.defaultMessage;
        const errorMessage = message
            ? message instanceof Function
                ? message(entity)
                : message
            : `Failed validation cause of constraint '${config.name}'`;

        return {
            constraints: { [config.name]: errorMessage },
            children: [],
            property: config.property || "class",
        };
    }
}

/** Register custom ClassValidator decorator by passing a ValidatorConfig */
export function registerClassDecorator<T extends AbstractEntity>({
    name,
    target,
    ...args
}: RegisterClassDecoratorArgs<T>) {
    const metadata = getClassValidatorMetadata(target) || {};

    const config: ClassValidatorConfig<any> = { name, ...args };

    // Handle the case where there is multiple decorator of same kind on same entity
    if (metadata[name]) {
        const keys = Object.keys(metadata);
        const count = keys.reduce((acc, value) => acc + (value.startsWith(name) ? 1 : 0), 0);
        metadata[name + "." + count] = config;
    } else {
        metadata[name] = config;
    }

    Reflect.defineMetadata(VALIDATION_METAKEY, metadata, target);
}

export type RegisterClassDecoratorArgs<T extends AbstractEntity> = Pick<
    ClassValidatorConfig<T>,
    "name" | "defaultMessage" | "options" | "validator" | "data" | "property"
> & {
    /** Entity class constructor */
    target: Object;
};

/** Store every ClassValidatorConfig for a given entity */
export type ClassValidatorMetadata<T extends AbstractEntity> = Record<string, ClassValidatorConfig<T>>;

/** Validator.validate function */
export type ClassValidatorFunction<T extends AbstractEntity> = (
    value: T,
    validationArguments?: ClassValidationArguments<T>
) => Promise<boolean> | boolean;

/** ClassValidator validate function options */
export type ClassValidatorFunctionOptions<T extends AbstractEntity = any> = Pick<ValidatorOptions, "groups"> & {
    requestContext?: RequestContext<T>;
};

/** Can either be a custom class implementing ClassValidatorConstraintInterface or a function with ClassValidatorFunction signature */
export type ClassValidatorTypeUnion<T extends AbstractEntity> =
    | ClassValidatorConstraintInterface<T>
    | ClassValidatorFunction<T>;

/** Validator config to pass to registerClassDecorator & stored in metadata */
export type ClassValidatorConfig<T extends AbstractEntity, Data = any, U = ClassValidatorTypeUnion<T>> = {
    /** Key that will be used in constraints */
    name: string;
    /** Default validation error message */
    defaultMessage?: ClassValidatorOptions["message"];
    options?: ClassValidatorOptions;
    validator: U extends ClassValidatorConstraintInterface<T>
        ? ClassValidatorConstraintInterface<T>
        : ClassValidatorFunction<T>;
    /** Custom data to pass as decorator args & to be used by the custom validator */
    data?: Data;
    property?: string;
};
/** Interface to implement for custom ClassValidator */
export interface ClassValidatorConstraintInterface<T extends AbstractEntity = any> {
    validate(value: T, validationArguments?: ClassValidationArguments<T>): Promise<boolean> | boolean;
}
/** Arguments passed to validate function */
export interface ClassValidationArguments<T extends AbstractEntity = any, Data = any>
    extends Pick<ValidationArguments, "value" | "object" | "targetName" | "property"> {
    /** Entity being validated */
    value: T;
    /** Class of entity being validated */
    object: ObjectType<T>;
    /** Custom data to pass to validator function */
    data?: Data;
    /** Request state if coming from regular entity routes */
    requestContext?: RequestContext<T>;
}

// TODO different options si property decorator
/** ClassValidator decorator options */
export interface ClassValidatorOptions extends ValidationOptions {
    /** Property on which the constraint failed */
    property?: string;
}
