import { AbstractEntity } from "@/entity/AbstractEntity";
import { Index } from "@elastic/elasticsearch/api/requestParams";

export interface ITransformer<Entity extends AbstractEntity> {
    transform(entity: Entity): Index["body"];
}
