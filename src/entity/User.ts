import { Column, Entity, JoinColumn, OneToMany, OneToOne, ManyToMany, JoinTable } from "typeorm";

import { userCreationMw } from "@/actions/User/CreationAction";

import { AbstractEntity } from "./AbstractEntity";
import { Image } from "./Image";
import { MemeBank } from "./MemeBank";
import { Visibility } from "./Visibility";
import { Meme } from "./Meme";
import { MaxLength, IsEmail, IsEnum, IsString } from "class-validator";
import { IsUnique } from "@/validators/IsUnique";
import { Pagination, Search, EntityRoute, Groups, Subresource } from "@astahmer/entity-routes/";

@Pagination({ all: true })
@Search(["id", ["name", "startsWith"]])
@EntityRoute("/users", ["list", "details", "update", "delete"], {
    actions: [userCreationMw],
})
@Entity()
export class User extends AbstractEntity {
    @IsUnique()
    @MaxLength(20)
    @Groups({ user: ["create", "list", "details", "update"] })
    @Column({ unique: true })
    name: string;

    @IsEmail()
    @Groups({ user: ["create", "list", "details", "update"] })
    @Column({ nullable: true })
    email: string;

    @IsString()
    @Column({ select: false, nullable: true })
    password: string;

    @IsEnum(Visibility)
    @Groups({ user: ["details", "update"] })
    @Column({ type: "enum", enum: Visibility, default: Visibility.PUBLIC })
    visibility: Visibility;

    @Groups({ user: ["list", "details"] })
    @Subresource(() => MemeBank)
    @OneToMany(() => MemeBank, (bank) => bank.owner, { cascade: ["remove"] })
    banks: MemeBank[];

    @Subresource(() => Meme)
    @ManyToMany(() => Meme, (bank) => bank.favoritedByUsers, { cascade: ["remove"] })
    @JoinTable()
    favorites: Meme[];

    @Subresource(() => Meme, { path: "memes" })
    @OneToMany(() => Meme, (meme) => meme.owner, { cascade: ["remove"] })
    postedMemes: Meme[];

    @Groups({ user: ["create", "details", "update"] })
    @OneToOne(() => Image)
    @JoinColumn()
    profilePicture: Image;

    @Column({ unique: true, nullable: true })
    twitterId: string;

    @Column({ default: 0, select: false })
    refreshTokenVersion: number;
}
