import { Entity, Column, OneToMany, OneToOne, JoinColumn, ManyToMany, ManyToOne } from "typeorm";
import { EntityRoute, Groups, MaxDepth } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";
import { Picture } from "./Picture";
import { Team } from "./Team";
import { Category } from "./Category";
import { SearchFilter } from "../services/EntityRoute/Filters/SearchFilter";

@EntityRoute("/users", ["list", "details"], {
    filters: [
        {
            class: SearchFilter,
            properties: ["id", "profilePicture.id", "profileCategory", { "teams.teamName": "startWith" }],
            usePropertyNamesAsQueryParams: true,
        },
    ],
})
@Entity()
export class User extends AbstractEntity {
    @Groups({
        user: ["list"],
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

    @Groups({
        user: [],
    })
    @OneToMany(() => Meme, (memes) => memes.user)
    memes: Meme[];

    @Groups({
        user: ["list"],
    })
    @OneToOne(() => Picture)
    @JoinColumn()
    profilePicture: Picture;

    @MaxDepth(1)
    @Groups({
        user: ["list", "details"],
    })
    @ManyToMany(() => Team, (team) => team.members)
    teams: Team[];

    @Groups({
        user: ["list"],
    })
    @ManyToOne(() => Category, { cascade: ["insert"] })
    profileCategory: Category;
}
