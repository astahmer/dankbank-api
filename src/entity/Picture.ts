import { Entity, Column, OneToOne, OneToMany } from "typeorm";
import { Groups } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";
import { Category } from "./Category";

@Entity()
export class Picture extends AbstractEntity {
    @Column()
    @Groups(["list", "details"])
    url: string;

    @OneToOne(() => Meme, (meme) => meme.picture)
    @Groups(["create", "details"])
    associatedMeme: Meme;

    @Column()
    @Groups(["list", "details", "update"])
    title: string;

    @Column()
    @Groups(["create", "details"])
    downloads: number;

    @OneToMany(() => Category, (category) => category.picture)
    @Groups(["list", "details"])
    categories: Category[];
}
