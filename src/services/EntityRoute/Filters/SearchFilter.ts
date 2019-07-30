import { AbstractFilter, ApplyParams } from "./AbstractFilter";
import { EntityMetadata, SelectQueryBuilder } from "typeorm";

/**
 * Add a/multiple where clause on any (deep?) properties of the decorated entity
 */
export class SearchFilter extends AbstractFilter {
    private makeJoinsFromPropPath(
        qb: SelectQueryBuilder<any>,
        entityMetadata: EntityMetadata,
        value: any,
        propPath: string,
        currentProp: string,
        prevProp?: string
    ) {
        const column = entityMetadata.findColumnWithPropertyName(currentProp);

        if (!column) {
            return;
        } else if (!column.relationMetadata) {
            qb.andWhere(`${prevProp}.${column.databaseName} = :${column.databaseName}`, {
                [column.databaseName]: value,
            });
            return currentProp;
        } else {
            qb.innerJoin(
                (prevProp || column.relationMetadata.entityMetadata.tableName) +
                    "." +
                    column.relationMetadata.propertyName,
                column.relationMetadata.propertyName
            );
            const splitPath = propPath.split(".");
            const nextPropPath = splitPath.slice(1).join(".");
            this.makeJoinsFromPropPath(
                qb,
                column.relationMetadata.inverseEntityMetadata,
                value,
                nextPropPath,
                splitPath[1],
                splitPath[0]
            );
        }
    }

    private getUsedFilterParamKeys(queryParams: Object) {
        // console.log(this.entityRelationsProperties);
        const props = this.entityProperties;
        const isParamInProps = (param: string) =>
            props.indexOf(param) !== -1 || (param.indexOf(".") !== -1 && props.indexOf(param.split(".")[0]) !== -1);
        return Object.keys(queryParams).reduce((acc, param: string) => {
            if (isParamInProps(param)) {
                acc.push(param);
            }
            return acc;
        }, []);
    }

    apply({ queryParams, qb }: ApplyParams) {
        const usedParams = this.getUsedFilterParamKeys(queryParams);
        usedParams.forEach((param) => {
            const props = param.split(".");

            if (props.length === 1) {
                qb.andWhere(`${param.databaseName} = :${param.databaseName}`, {
                    [param.databaseName]: queryParams[param],
                });
            } else {
                this.makeJoinsFromPropPath(qb, this.entityMetadata, queryParams[param], param, props[0]);
            }
        });
    }
}
