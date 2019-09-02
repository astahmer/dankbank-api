import { Entity, Column, OneToOne, OneToMany, JoinColumn } from "typeorm";
import { Groups, EntityRoute } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";
import { Category } from "./Category";
import { FileEntity } from "./FileEntity";

@EntityRoute("/pictures", ["list", "details", "update"])
@Entity()
export class Picture extends AbstractEntity {
    @Groups({
        picture: ["list", "details"],
        user: ["create", "list", "details"],
        meme: ["list", "details"],
    })
    @Column()
    url: string;

    @Groups({
        picture: ["list", "details", "update"],
    })
    @OneToOne(() => FileEntity)
    @JoinColumn()
    file: FileEntity;

    @Groups({
        picture: ["details"],
        user: ["details"],
    })
    @OneToOne(() => Meme, (meme) => meme.picture)
    associatedMeme: Meme;

    @Groups({
        picture: ["list", "details"],
        user: ["create", "list", "details"],
        meme: ["list", "details"],
    })
    @Column()
    title: string;

    @Groups({
        picture: ["list", "details"],
        user: ["list", "details"],
        meme: ["list", "details"],
    })
    @Column()
    downloads: number;

    @Groups({
        picture: ["list", "details"],
        user: ["list"],
        meme: ["list", "details"],
    })
    @OneToMany(() => Category, (category) => category.picture)
    categories: Category[];
}
