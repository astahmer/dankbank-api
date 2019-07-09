import { Entity, Column, ManyToOne, OneToOne, JoinColumn } from "typeorm";
import { Groups } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { User } from "./User";
import { Picture } from "./Picture";

@Entity()
export class Meme extends AbstractEntity {
    @ManyToOne(() => User, (user) => user.memes)
    user: User;

    @Column()
    @Groups(["list", "details"])
    title: string;

    @Groups(["list", "details"])
    @Column()
    description: string;

    @Column()
    @Groups(["create", "details", "update"])
    upvoteCount: number;

    @Column()
    @Groups(["create", "details"])
    downvoteCount: number;

    @Groups(["list", "details"])
    @OneToOne(() => Picture, (picture) => picture.associatedMeme)
    @JoinColumn()
    picture: Picture;
}
