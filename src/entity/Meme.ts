import { Entity, Column, ManyToOne, OneToOne, JoinColumn } from "typeorm";
import { EntityRoute, Groups } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { User } from "./User";
import { Picture } from "./Picture";

@Entity()
@EntityRoute("/memes", ["list"])
export class Meme extends AbstractEntity {
    @ManyToOne((_type) => User, (user) => user.memes)
    user: User;

    @Column()
    @Groups(["list", "details"])
    title: string;

    @Groups(["details"])
    @Column()
    description: string;

    @Column()
    @Groups(["create", "details", "update"])
    upvoteCount: number;

    @Column()
    @Groups(["create", "details"])
    downvoteCount: number;

    @Groups(["update", "details"])
    @OneToOne(() => Picture)
    @JoinColumn()
    picture: Picture;
}
