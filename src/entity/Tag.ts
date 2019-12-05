import { Column, Entity, ManyToOne } from "typeorm";

import { SuggestionAction } from "@/actions/Tag/SuggestionAction";
import { EntityRoute, Groups } from "@/services/EntityRoute/Decorators";
import { ROUTE_VERB } from "@/services/EntityRoute/ResponseManager";

import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";

@EntityRoute("/tags", ["create", "list", "details", "update", "delete"], {
    actions: [
        {
            verb: ROUTE_VERB.GET,
            path: "/search",
            class: SuggestionAction,
        },
    ],
})
@Entity()
export class Tag extends AbstractEntity {
    @Groups({ meme: ["create", "list", "details", "update"] })
    @Column()
    tag: string;

    @Groups({ meme: ["list"] })
    @ManyToOne(() => Meme, (meme) => meme.tags)
    meme: Meme;

    @Groups({ meme: ["list", "details", "update"] })
    @Column({ default: 0 })
    upvoteCount: number;
}
