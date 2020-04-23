import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { EntityRoute, Groups, Subresource } from "@astahmer/entity-routes/";

import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";
import { User } from "./User";

@EntityRoute("/comments", ["update", "delete"])
@Entity()
export class Comment extends AbstractEntity {
    @Groups({ comment: ["create", "list", "update"] })
    @Column()
    message: string;

    @Groups({ comment: ["create", "list", "update"] })
    @ManyToOne(() => Meme, (meme) => meme.comments)
    meme: Meme;

    @Groups({ comment: ["create", "list", "update"] })
    @ManyToOne(() => User)
    user: User;

    @Groups({ comment: ["create", "list", "update"] })
    @ManyToOne(() => Comment, (comment) => comment.answers)
    @JoinColumn()
    parent: Comment;

    @Groups({ comment: ["list"] })
    @Subresource(() => Comment, { operations: ["create", "list"] })
    @OneToMany(() => Comment, (comment) => comment.parent)
    @JoinColumn()
    answers: Comment[];
}
