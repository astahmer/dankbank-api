import { Entity, Column, ManyToOne, OneToOne, JoinColumn } from "typeorm";
import { Groups, EntityRoute, SearchFilter } from "@/services/EntityRoute/decorators";
import { AbstractEntity } from "./AbstractEntity";
import { User } from "./User";
import { Picture } from "./Picture";

@SearchFilter([], { all: true })
@EntityRoute("/memes", ["list", "details"])
@Entity()
export class Meme extends AbstractEntity {
    @Groups({
        meme: ["create", "list", "details"],
    })
    @ManyToOne(() => User, (user) => user.memes, { onDelete: "CASCADE" })
    user: User;

    @Groups({
        meme: ["create", "list", "details"],
        user: ["details"],
    })
    @Column()
    title: string;

    @Groups({
        meme: ["create", "list", "details"],
        user: ["details"],
    })
    @Column()
    description: string;

    @Groups({
        meme: ["create", "list", "details"],
        user: ["details"],
    })
    @Column()
    upvoteCount: number;

    @Groups({
        meme: ["create", "list", "details"],
        user: ["details"],
    })
    @Column()
    downvoteCount: number;

    @Groups({
        meme: ["create", "list", "details"],
        user: ["details"],
    })
    @OneToOne(() => Picture, (picture) => picture.associatedMeme, { cascade: ["insert"] })
    @JoinColumn()
    picture: Picture;
}
