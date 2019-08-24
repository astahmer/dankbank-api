import { Entity, Column, OneToMany, OneToOne, JoinColumn, ManyToMany, ManyToOne } from "typeorm";
import { EntityRoute, Groups, SearchFilter, PaginationFilter } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";
import { Picture } from "./Picture";
import { Team } from "./Team";
import { Category } from "./Category";
import { ValidateNested, IsBoolean } from "class-validator";

@PaginationFilter([], { all: true })
@SearchFilter(["profileCategory.picture.id"], { all: true })
@EntityRoute("/users", ["create", "list", "details"])
@Entity()
export class User extends AbstractEntity {
    @Groups({
        user: ["create", "list", "details"],
    })
    @Column()
    firstName: string;

    @Groups({
        user: ["create", "list", "details"],
    })
    @Column({ nullable: true })
    lastName: string;

    @Groups({
        user: ["create", "list", "details"],
    })
    @Column()
    age: number;

    @Groups({ user: ["create", "list", "details"] })
    @Column({ nullable: true })
    birthDate: Date;

    @Groups({ user: ["create", "list", "details"] })
    @IsBoolean()
    @Column({ default: true })
    isProfilePublic: boolean;

    @Groups({
        user: [],
    })
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
        user: ["create", "list", "details"],
    })
    @ValidateNested()
    @ManyToOne(() => Category, { cascade: ["insert"] })
    profileCategory: Category;
}
