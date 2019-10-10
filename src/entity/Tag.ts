import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";
import { Column, ManyToOne, Entity } from "typeorm";
import { Groups, EntityRoute } from "@/services/EntityRoute/Decorators";
import { ROUTE_VERB } from "@/services/EntityRoute/ResponseManager";
import { SuggestionAction } from "@/actions/Tag/SuggestionAction";

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

    @Groups({ meme: ["create"] })
    @ManyToOne(() => Meme, (meme) => meme.tags)
    meme: Meme;

    @Groups({ meme: ["list", "details", "update"] })
    @Column()
    upvoteCount: number;
}
