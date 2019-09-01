export type AliasList = Record<string, number>;

export class QueryAliasManager {
    aliases: AliasList;

    public resetList() {
        this.aliases = {};
        return this.aliases;
    }

    /**
     * Appends a number (of occurences) to a propertName in order to avoid ambiguous sql names
     * @param aliases current list of aliases
     * @param entity add one to the counter on this property name
     * @param propName add one to the counter on this property name
     */

    public generate(entityTableName: string, propName: string) {
        const key = entityTableName + "." + propName;
        this.aliases[key] = this.aliases[key] ? this.aliases[key] + 1 : 1;
        return entityTableName + "_" + propName + "_" + this.aliases[key];
    }

    public getPropertyLastAlias(entityTableName: string, propName: string) {
        const key = entityTableName + "." + propName;
        return entityTableName + "_" + propName + "_" + this.aliases[key];
    }
}
