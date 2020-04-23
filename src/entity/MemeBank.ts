import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToOne } from "typeorm";
import { Search, EntityRoute, Groups, Subresource } from "@astahmer/entity-routes/";

import { AbstractEntity } from "./AbstractEntity";
import { Image } from "./Image";
import { Meme } from "./Meme";
import { User } from "./User";
import { Visibility } from "./Visibility";
import { IsEnum, IsBoolean, IsString } from "class-validator";

@Search(["id", { title: "partial" }, "owner", "isCollaborative", "members"])
@EntityRoute("/banks", ["create", "list", "details", "update", "delete"])
@Entity()
export class MemeBank extends AbstractEntity {
    @IsString()
    @Groups({ meme_bank: ["create", "list", "details", "update"] })
    @Column()
    title: string;

    @IsString()
    @Groups({ meme_bank: ["create", "details", "update"] })
    @Column()
    description: string;

    @Groups({ meme_bank: ["create", "list", "details", "update"] })
    @OneToOne(() => Image)
    @JoinColumn()
    coverPicture: Image;

    @IsEnum(Visibility)
    @Groups({ meme_bank: ["create", "details", "update"] })
    @Column({ type: "enum", enum: Visibility, default: Visibility.PUBLIC })
    visibility: Visibility;

    // TODO @AsCurrentUser
    @Groups({ meme_bank: ["create", "details"] })
    @ManyToOne(() => User, (user) => user.banks, { nullable: false })
    owner: User;

    @IsBoolean()
    @Groups({ meme_bank: ["create", "details", "update"] })
    @Column({ default: false })
    isCollaborative: boolean;

    @Groups({ meme_bank: ["details", "update"] })
    @ManyToMany(() => User)
    @JoinTable()
    members: User[];

    @Groups({ meme_bank: ["create", "details", "update"] })
    @Subresource(() => Meme)
    @ManyToMany(() => Meme, (meme) => meme.banks)
    @JoinTable()
    memes: Meme[];
}
