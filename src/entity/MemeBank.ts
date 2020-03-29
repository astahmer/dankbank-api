import { Column, Entity, getConnection, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToOne } from "typeorm";

import { EntityRoute, Groups, SearchFilter, Subresource } from "@/services/EntityRoute/Decorators";

import { AbstractEntity } from "./AbstractEntity";
import { Image } from "./Image";
import { Meme } from "./Meme";
import { User } from "./User";
import { Visibility } from "./Visibility";

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
    @OneToOne(() => Image)
    @JoinColumn()
    coverPicture: Image;

    @Groups({
        meme_bank: ["create", "details", "update"],
    })
    @Column({ type: "enum", enum: Visibility, default: Visibility.PUBLIC })
    visibility: Visibility;

    @Column({ default: false })
    isDefault: boolean;

    @Groups({
        meme_bank: ["create", "details"],
    })
    @ManyToOne(() => User, (user) => user.banks, { nullable: false })
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

export async function getDefaultMemeBankFor(userId: number) {
    const connection = getConnection();
    const query = connection
        .getRepository(MemeBank)
        .createQueryBuilder("meme")
        .select("meme.id")
        .where("meme.ownerId = :userId", { userId })
        .andWhere("meme.isDefault = true");

    const defaultMemeBank = await query.getOne();

    return defaultMemeBank.id;
}
