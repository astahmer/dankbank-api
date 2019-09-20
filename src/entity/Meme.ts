import { Entity, Column, ManyToOne, ManyToMany, JoinTable, OneToMany } from "typeorm";

import { Groups, EntityRoute, SearchFilter, Subresource } from "@/services/EntityRoute/Decorators";
import { AbstractEntity } from "./AbstractEntity";
import { Tag } from "./Tag";
import { File } from "./File";
import { MemeBank } from "./MemeBank";
import { Comment } from "./Comment";
import { User } from "./User";
import { ImageUploadAction } from "@/services/EntityRoute/Actions/ImageUploadAction";
import { ROUTE_VERB } from "@/services/EntityRoute/EntityRoute";

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
    @Column()
    description: string;

    @Groups({
        meme: ["create", "list", "details", "update"],
    })
    @OneToMany(() => Tag, (tag) => tag.meme, { cascade: true })
    tags: Tag[];

    @Groups({
        meme: ["list", "details", "update"],
    })
    @Column()
    upvoteCount: number;

    @Groups({
        meme: ["list", "details", "update"],
    })
    @Column()
    downvoteCount: number;

    @Groups({
        meme: ["details", "update"],
    })
    @Column()
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
