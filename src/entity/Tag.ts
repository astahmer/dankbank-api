import { Column, Entity, ManyToOne } from "typeorm";
import { EntityRoute, Groups } from "@astahmer/entity-routes/";

import { SuggestionAction } from "@/actions/Tag/SuggestionAction";

import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";
import { MinLength, MaxLength } from "class-validator";

@EntityRoute("/tags", ["create", "list", "details", "update", "delete"], {
    actions: [
        {
            verb: "get",
            path: "/search",
            class: SuggestionAction,
        },
    ],
})
@Entity()
export class Tag extends AbstractEntity {
    @MinLength(3)
    @MaxLength(25)
    @Groups({ meme: ["create", "list", "details", "update"] })
    @Column()
    tag: string;

    @Groups({ meme: ["list"] })
    @ManyToOne(() => Meme, (meme) => meme.tags, { onDelete: "CASCADE" })
    meme: Meme;

    @Groups({ meme: ["list", "details", "update"] })
    @Column({ default: 0 })
    upvoteCount: number;
}
