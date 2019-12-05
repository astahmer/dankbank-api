import { Column, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany } from "typeorm";

import { SearchAction } from "@/actions/Meme/SearchAction";
import {
    DependsOn, EntityRoute, Groups, PaginationFilter, SearchFilter, Subresource
} from "@/services/EntityRoute/Decorators";
import { ROUTE_VERB } from "@/services/EntityRoute/ResponseManager";

import { AbstractEntity } from "./AbstractEntity";
import { Comment } from "./Comment";
import { Image } from "./Image";
import { MemeBank } from "./MemeBank";
import { Tag } from "./Tag";
import { User } from "./User";
import { Visibility } from "./Visibility";

@PaginationFilter()
@SearchFilter([], { all: true })
@EntityRoute("/memes", ["create", "list", "details", "update", "delete"], {
    actions: [
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
    @ManyToMany(() => Image, { cascade: true })
    @JoinTable()
    pictures: Image[];

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

    @DependsOn(["pictures.id"])
    @Groups({ meme: ["list", "details"] })
    isMultipartMeme() {
        return this.pictures.length > 1;
    }
}
