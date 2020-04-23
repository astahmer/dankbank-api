import { ValidationOptions } from "class-validator";
import {
    EntityValidatorConstraintInterface,
    EntityValidationArguments,
    registerEntityDecorator,
} from "@astahmer/entity-validator";

import { formatIriToId } from "@/services/EntityRoute/Filters/SearchFilter";
import { User } from "@/entity/User";
import { AbstractEntity } from "@/entity/AbstractEntity";
import { RequestContext } from "@/services/EntityRoute/ResponseManager";

class IsCurrentUserConstraint<T extends AbstractEntity> implements EntityValidatorConstraintInterface {
    validate(value: T, args: EntityValidationArguments<T, RequestContext<T>>) {
        const decoded = args?.context?.decoded;
        const userProp = (value[args.property as keyof T] as any) as number | string | User;

        const userId =
            typeof userProp === "number"
                ? userProp
                : typeof userProp === "string"
                ? parseInt(formatIriToId(userProp))
                : userProp.id;
        return userId === decoded?.id;
    }
}

/** Ensures that relation property is current user  */
export function IsCurrentUser(options?: ValidationOptions): PropertyDecorator {
    return function (target: Object, propertyName: string) {
        registerEntityDecorator({
            name: "IsCurrentUser",
            target: target.constructor,
            options,
            validator: new IsCurrentUserConstraint(),
            property: propertyName,
            defaultMessage: `<${propertyName}> can only be current user`,
        });
    };
}
