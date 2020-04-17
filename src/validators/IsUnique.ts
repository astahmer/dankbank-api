import { AbstractEntity } from "@/entity/AbstractEntity";
import { EntityKeys } from "@/utils/globalTypes";
import {
    registerClassDecorator,
    ClassValidationArguments,
    ClassValidatorConstraintInterface,
    ClassValidatorOptions,
} from "./ClassValidator";
import { ValidatorOptions } from "class-validator";
import { getConnection } from "typeorm";
import { formatIriToId } from "@/services/EntityRoute/Filters/SearchFilter";

class IsUniqueValidator<T extends AbstractEntity> implements ClassValidatorConstraintInterface<T> {
    async validate(item: T, args: ClassValidationArguments<T, IsUniqueData<T>>) {
        const relations = args.data.relations;
        const repository = getConnection().getRepository(args.object);
        const query = repository.createQueryBuilder(args.targetName).select(args.targetName + ".id");

        let i = 0;
        for (i; i < relations.length; i++) {
            const prop = relations[i];
            const paramName = prop + "Id";
            const value =
                typeof item[prop] === "string" ? parseInt(formatIriToId((item[prop] as any) as string)) : item[prop];
            if (!value) continue;

            query.andWhere(`${args.targetName}.${prop} = :${paramName}`, { [paramName]: value });
        }

        const result = await query.getOne();

        return !result;
    }
}

export type IsUniqueData<T extends AbstractEntity> = { relations: EntityKeys<T>[] };
/** Checks that an entity doesn't already exist with same relation(s) id */
export function IsUnique<T extends AbstractEntity>(options?: ValidatorOptions): PropertyDecorator;
export function IsUnique<T extends AbstractEntity>(
    relations: EntityKeys<T>[],
    options?: ClassValidatorOptions
): ClassDecorator;
export function IsUnique<T extends AbstractEntity>(
    relationsOrOptions: EntityKeys<T>[] | ClassValidatorOptions,
    options?: ClassValidatorOptions
): PropertyDecorator | ClassDecorator {
    return (target, propName: string) => {
        // If propName is defined => PropertyDecorator, else it's a ClassDecorator
        const isPropDecorator = !!propName;
        target = isPropDecorator ? target.constructor : target;
        options = isPropDecorator ? (relationsOrOptions as ClassValidatorOptions) : options;

        const relations = isPropDecorator ? [propName] : relationsOrOptions;
        const className = (target as any)?.name;

        const defaultProperty = isPropDecorator ? propName : (relations as string[]).join(", ");
        const defaultMessage = `Another <${className}> entity already exists with unique constraints on : <${defaultProperty}>`;

        const property = options?.property || defaultProperty;

        registerClassDecorator({
            name: "IsUnique",
            target,
            options,
            validator: new IsUniqueValidator(),
            data: { relations } as IsUniqueData<T>,
            defaultMessage,
            property,
        });
    };
}
