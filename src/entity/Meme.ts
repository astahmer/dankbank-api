import { Entity, Column, ManyToOne, OneToOne, JoinColumn } from "typeorm";
import { Groups, EntityRoute } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { User } from "./User";
import { Picture } from "./Picture";

@EntityRoute("/memes", ["list", "details"])
@Entity()
export class Meme extends AbstractEntity {
    @Groups({
        meme: ["list", "details"],
    })
    @ManyToOne(() => User, (user) => user.memes)
    user: User;

    @Groups({
        meme: ["list", "details"],
        user: ["details"],
    })
    @Column()
    title: string;

    @Groups({
        meme: ["list", "details"],
        user: ["details"],
    })
    @Column()
    description: string;

    @Groups({
        meme: ["list", "details"],
        user: ["details"],
    })
    @Column()
    upvoteCount: number;

    @Groups({
        meme: ["list", "details"],
        user: ["details"],
    })
    @Column()
    downvoteCount: number;

    @Groups({
        meme: ["list", "details"],
        user: ["details"],
    })
    @OneToOne(() => Picture, (picture) => picture.associatedMeme, { cascade: ["insert"] })
    @JoinColumn()
    picture: Picture;
}
