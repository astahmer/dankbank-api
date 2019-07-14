import { Entity, Column, OneToMany, OneToOne, JoinColumn, ManyToMany, ManyToOne } from "typeorm";
import { EntityRoute, Groups } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";
import { Picture } from "./Picture";
import { Team } from "./Team";
import { Category } from "./Category";

@EntityRoute("/users", ["details"])
@Entity()
export class User extends AbstractEntity {
    @Groups({
        user: ["list", "details"],
    })
    @Column()
    firstName: string;

    @Groups({
        user: ["list", "details"],
    })
    @Column()
    lastName: string;

    @Groups({
        user: ["list", "details"],
    })
    @Column()
    age: number;

    @Groups({
        user: ["details"],
    })
    @OneToMany(() => Meme, (memes) => memes.user)
    memes: Meme[];

    @Groups({
        user: ["list", "details"],
    })
    @OneToOne(() => Picture)
    @JoinColumn()
    profilePicture: Picture;

    @Groups({
        user: ["details"],
    })
    @ManyToMany(() => Team)
    teams: Team[];

    @Groups({
        user: ["list", "details"],
    })
    @ManyToOne(() => Category, { cascade: ["insert"] })
    profileCategory: Category;
}
