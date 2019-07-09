import { Entity, Column, OneToMany, OneToOne, JoinColumn, ManyToMany, ManyToOne } from "typeorm";
import { EntityRoute, Groups } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";
import { Picture } from "./Picture";
import { Team } from "./Team";
import { Category } from "./Category";

@Entity()
@EntityRoute("/users", ["list"])
export class User extends AbstractEntity {
    @Groups(["list", "details"])
    @Column()
    firstName: string;

    @Groups(["list", "details"])
    @Column()
    lastName: string;

    @Groups(["list", "create", "details", "update"])
    @Column()
    age: number;

    @Groups(["update", "details"])
    @OneToMany(() => Meme, (memes) => memes.user)
    memes: Meme[];

    @Groups(["update", "details"])
    @OneToOne(() => Picture)
    @JoinColumn()
    profilePicture: Picture;

    @Groups(["list", "details"])
    @ManyToMany(() => Team, (team) => team.members)
    teams: Team[];

    @Groups(["list", "details"])
    @ManyToOne(() => Category, (category) => category.users)
    profileCategory: Category;
}
