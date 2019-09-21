import { Index } from "@elastic/elasticsearch/api/requestParams";
import { AbstractEntity } from "@/entity/AbstractEntity";

export interface ITransformer<Entity extends AbstractEntity> {
    transform(entity: Entity): Index["body"];
}
