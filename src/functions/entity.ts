import { ColumnMetadata } from "typeorm/metadata/ColumnMetadata";
import { EntityMetadata } from "typeorm";
import { entityRoutesContainer } from "@/services/EntityRoute";
import { getRouteMetadata } from "@/services/EntityRoute/EntityRoute";

export const iriRegex = new RegExp(/\/api\/(\w+)\//g, "i");
export const formatIriToId = (iri: string, asInt = false) =>
    asInt ? parseInt(iri.replace(iriRegex, "")) : iri.replace(iriRegex, "");
export const getEntrypointFromIri = (iri: string) => iri.match(iriRegex)[1];
export const isIriValidForProperty = (iri: string, column: ColumnMetadata) => {
    if (!iri.startsWith("/api/") || !column.relationMetadata) return;

    const tableName = column.relationMetadata.inverseEntityMetadata.tableName + "s";
    const entrypoint = getEntrypointFromIri(iri);
    const sameAsRouteName =
        entityRoutesContainer[tableName] && entrypoint === entityRoutesContainer[tableName].routeMetadata.path;
    const sameAsTableName = entrypoint === tableName;

    return sameAsRouteName || sameAsTableName;
};

export function idToIRI(entityMeta: EntityMetadata, id: number) {
    const routeMetadata = getRouteMetadata(entityMeta.target as Function);
    return routeMetadata && "/api" + routeMetadata.path + "/" + id;
}
