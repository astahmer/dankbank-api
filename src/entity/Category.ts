import { Entity, Column, ManyToOne } from "typeorm";
import { Groups } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { Picture } from "./Picture";

@Entity()
export class Category extends AbstractEntity {
    @Column()
    @Groups(["list", "details"])
    name: string;

    @Column()
    @Groups(["list", "details", "update"])
    icon: string;

    @ManyToOne(() => Picture, (picture) => picture.categories)
    @Groups(["list", "details"])
    picture: Picture[];
}
