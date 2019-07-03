import { Entity, Column } from "typeorm";
import { EntityRoute, Groups } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";

@Entity()
@EntityRoute("/pictures", ["list"])
export class Picture extends AbstractEntity {
    @Column()
    @Groups(["list", "details"])
    url: string;

    @Column()
    @Groups(["list", "details", "update"])
    title: string;

    @Column()
    @Groups(["create", "details"])
    downloads: number;
}
