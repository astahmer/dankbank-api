import { Column, ManyToOne, ManyToMany, JoinTable, Entity, OneToOne, JoinColumn } from "typeorm";

import { Groups, Subresource, EntityRoute, SearchFilter } from "@/services/EntityRoute/Decorators";
import { Visibility } from "./Visibility";
import { AbstractEntity } from "./AbstractEntity";
import { File } from "./File";
import { User } from "./User";
import { Meme } from "./Meme";

@SearchFilter(["id", { title: "partial" }, "owner", "isCollaborative", "members"])
@EntityRoute("/banks", ["create", "list", "details", "update", "delete"])
@Entity()
export class MemeBank extends AbstractEntity {
    @Groups({
        meme_bank: ["create", "list", "details", "update"],
    })
    @Column()
    title: string;

    @Groups({
        meme_bank: ["create", "details", "update"],
    })
    @Column()
    description: string;

    @Groups({
        meme_bank: ["create", "list", "details", "update"],
    })
    @OneToOne(() => File)
    @JoinColumn()
    coverPicture: File;

    @Groups({
        meme_bank: ["create", "details", "update"],
    })
    @Column({ type: "enum", enum: Visibility, default: Visibility.PUBLIC })
    visibility: Visibility;

    @Groups({
        meme_bank: ["create", "details"],
    })
    @ManyToOne(() => User, (user) => user.banks)
    owner: User;

    @Groups({
        meme_bank: ["create", "details", "update"],
    })
    @Column({ default: false })
    isCollaborative: boolean;

    @Groups({
        meme_bank: ["details", "update"],
    })
    @ManyToMany(() => User)
    @JoinTable()
    members: User[];

    @Groups({
        meme_bank: ["create", "details", "update"],
    })
    @Subresource(() => Meme)
    @ManyToMany(() => Meme, (meme) => meme.banks)
    @JoinTable()
    memes: Meme[];
}
