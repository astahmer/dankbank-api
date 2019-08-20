import { Entity, Column, OneToMany, OneToOne, JoinColumn, ManyToMany, ManyToOne } from "typeorm";
import { EntityRoute, Groups, SearchFilterDecorator as SearchFilter } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";
import { Picture } from "./Picture";
import { Team } from "./Team";
import { Category } from "./Category";

@SearchFilter(["profileCategory.picture.id"], { all: true })
@EntityRoute("/users", ["list", "details"])
@Entity()
export class User extends AbstractEntity {
    @Groups({
        user: ["list", "details"],
    })
    @Column()
    firstName: string;

    @Groups({
        user: ["list"],
    })
    @Column()
    lastName: string;

    @Groups({
        user: ["list"],
    })
    @Column()
    age: number;

    @Column({ nullable: true })
    birthDate: Date;

    @Column({ default: true })
    isProfilePublic: boolean;

    @Groups({
        user: [],
    })
    @OneToMany(() => Meme, (memes) => memes.user)
    memes: Meme[];

    @Groups({
        user: [],
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
        user: ["list"],
    })
    @ManyToOne(() => Category, { cascade: ["insert"] })
    profileCategory: Category;
}
