import { GroupsMetadata } from "./GroupsMetadata";
import { Operation } from "./types";
import { EntityMetadata } from "typeorm";

type AlwaysEnabledKeys = {
    [propName: string]: Boolean;
};

export class OnlyExposeIdGroupsMetadata extends GroupsMetadata {
    private alwaysEnabled: AlwaysEnabledKeys = {};

    addPropAsAlwaysEnabled(propName: string) {
        this.alwaysEnabled[propName] = true;
    }

    doesRelationOnlyExposeId(operation: Operation, entityMetadata: EntityMetadata, propName: string) {
        const exposedProps = this.getExposedProps(operation, entityMetadata);
        if (this.alwaysEnabled[propName] || (exposedProps && exposedProps.indexOf(propName) !== -1)) {
            return true;
        }

        return false;
    }
}
