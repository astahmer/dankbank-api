import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";
import { Column, ManyToOne, Entity } from "typeorm";
import { Groups } from "@/services/EntityRoute/decorators";

@Entity()
export class Tag extends AbstractEntity {
    @Groups({
        meme: ["create", "list", "details", "update"],
    })
    @Column()
    tag: string;

    @Groups({
        meme: ["create"],
    })
    @ManyToOne(() => Meme, (meme) => meme.tags)
    meme: Meme;
}
