import { Entity, Column, OneToMany, OneToOne, JoinColumn, ManyToMany, ManyToOne } from "typeorm";
import { EntityRoute, Groups, SearchFilter, PaginationFilter } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";
import { Picture } from "./Picture";
import { Team } from "./Team";
import { Category } from "./Category";
import { IsBoolean, IsOptional } from "class-validator";
import { Subresource } from "@/decorators/Subresource";

@PaginationFilter([], { all: true })
@SearchFilter(["profileCategory.picture.id"], { all: true })
@EntityRoute("/users", ["create", "list", "details", "update"])
@Entity()
export class User extends AbstractEntity {
    @Groups({
        user: ["create", "list", "details", "update"],
    })
    @Column()
    firstName: string;

    @Groups({
        user: ["create", "list", "details", "update"],
    })
    @Column({ nullable: true })
    lastName: string;

    @Groups({
        user: ["create", "list", "details", "update"],
    })
    @Column()
    age: number;

    @Groups({ user: ["create", "list", "details", "update"] })
    @Column({ nullable: true })
    birthDate: Date;

    @Groups({ user: ["create", "list", "details", "update"] })
    @IsBoolean()
    @IsOptional()
    @Column({ default: true })
    isProfilePublic: boolean;

    @Subresource(() => Meme, { operations: ["create", "list", "details"] })
    @OneToMany(() => Meme, (memes) => memes.user)
    memes: Meme[];

    @Groups({
        user: ["create", "details"],
    })
    @OneToOne(() => Picture)
    @JoinColumn()
    profilePicture: Picture;

    @Groups({
        user: ["details"],
    })
    @ManyToMany(() => Team, (team) => team.members)
    teams: Team[];

    @Groups({
        user: ["create", "list", "details", "update"],
    })
    @ManyToOne(() => Category, { cascade: ["insert", "update"] })
    profileCategory: Category;
}
