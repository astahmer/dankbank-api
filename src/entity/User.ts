import { Entity, Column, OneToMany, OneToOne, JoinColumn } from "typeorm";
import { EntityRoute, Groups } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";
import { Picture } from "./Picture";

@Entity()
@EntityRoute("/users", ["create", "list", "update"])
export class User extends AbstractEntity {
    @Groups(["list", "details"])
    @Column()
    firstName: string;

    @Groups(["list", "details"])
    @Column()
    lastName: string;

    @Groups(["create", "details", "update"])
    @Column()
    age: number;

    @Groups(["update", "details", "list"])
    @OneToMany(() => Meme, (memes) => memes.user)
    memes: Meme[];

    @Groups(["update", "details"])
    @OneToOne(() => Picture)
    @JoinColumn()
    profilePicture: Picture;
}
