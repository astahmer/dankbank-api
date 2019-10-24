import { Column, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany } from "typeorm";

import { SearchAction } from "@/actions/Meme/SearchAction";
import { ImageUploadAction } from "@/services/EntityRoute/Actions/ImageUploadAction";
import {
    EntityRoute, Groups, PaginationFilter, SearchFilter, Subresource
} from "@/services/EntityRoute/Decorators";
import { ROUTE_VERB } from "@/services/EntityRoute/ResponseManager";

import { AbstractEntity } from "./AbstractEntity";
import { Comment } from "./Comment";
import { File } from "./File";
import { MemeBank } from "./MemeBank";
import { Tag } from "./Tag";
import { User } from "./User";
import { Visibility } from "./Visibility";

@PaginationFilter()
@SearchFilter([], { all: true })
@EntityRoute("/memes", ["create", "list", "details", "update", "delete"], {
    actions: [
        {
            verb: ROUTE_VERB.POST,
            path: "/upload",
            class: ImageUploadAction,
        },
        {
            verb: ROUTE_VERB.GET,
            path: "/search",
            class: SearchAction,
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

    @Groups({
        meme: ["create", "details", "update"],
    })
    @Column({ type: "enum", enum: Visibility, default: Visibility.PUBLIC })
    visibility: Visibility;
}
