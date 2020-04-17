import { formatIriToId } from "@/services/EntityRoute/Filters/SearchFilter";
import { User } from "@/entity/User";
import { ClassValidatorConstraintInterface, ClassValidationArguments, registerClassDecorator } from "./ClassValidator";
import { AbstractEntity } from "@/entity/AbstractEntity";
import { ValidationOptions } from "class-validator";

class IsCurrentUserConstraint<T extends AbstractEntity> implements ClassValidatorConstraintInterface {
    validate(value: T, args: ClassValidationArguments) {
        const decoded = args?.requestContext?.decoded;
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
        registerClassDecorator({
            name: "IsCurrentUser",
            target: target.constructor,
            options,
            validator: new IsCurrentUserConstraint(),
            property: propertyName,
            defaultMessage: `<${propertyName}> can only be current user`,
        });
    };
}
