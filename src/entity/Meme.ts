import { Entity, Column, ManyToOne, ManyToMany, JoinTable, OneToMany } from "typeorm";

import { Groups, EntityRoute, SearchFilter, Subresource, PaginationFilter } from "@/services/EntityRoute/Decorators";
import { AbstractEntity } from "./AbstractEntity";
import { Tag } from "./Tag";
import { File } from "./File";
import { MemeBank } from "./MemeBank";
import { Comment } from "./Comment";
import { User } from "./User";
import { ImageUploadAction } from "@/services/EntityRoute/Actions/ImageUploadAction";
import { ROUTE_VERB } from "@/services/EntityRoute/ResponseManager";

@PaginationFilter()
@SearchFilter([], { all: true })
@EntityRoute("/memes", ["create", "list", "details", "update", "delete"], {
    actions: [
        {
            verb: ROUTE_VERB.POST,
            path: "/upload",
            class: ImageUploadAction,
        },
    ],
})
@Entity()
export class Meme extends AbstractEntity {
    @Groups({
        meme: "all",
    })
    @Column()
    title: string;

    @Groups({
        meme: ["create", "details", "update"],
    })
    @Column({ nullable: true })
    description: string;

    @Groups({
        meme: ["create", "list", "details", "update"],
    })
    @OneToMany(() => Tag, (tag) => tag.meme, { cascade: true })
    tags: Tag[];

    @Groups({
        meme: ["list", "details", "update"],
    })
    @Column({ default: 0 })
    upvoteCount: number;

    @Groups({
        meme: ["list", "details", "update"],
    })
    @Column({ default: 0 })
    downvoteCount: number;

    @Groups({
        meme: ["details", "update"],
    })
    @Column({ default: 0 })
    views: number;

    @Groups({
        meme: ["create", "list", "details", "update"],
    })
    @Column()
    isMultipartMeme: boolean;

    @Groups({
        meme: ["create", "list", "details", "update"],
    })
    @ManyToMany(() => File, { cascade: true })
    @JoinTable()
    pictures: File[];

    @Groups({
        meme: ["create", "list", "details", "update"],
    })
    @ManyToMany(() => MemeBank, (bank) => bank.memes)
    banks: MemeBank[];

    @Subresource(() => Comment)
    @OneToMany(() => Comment, (comment) => comment.meme)
    comments: Comment[];

    @Groups({
        meme: ["create", "details"],
    })
    @ManyToOne(() => User)
    owner: User;
}
