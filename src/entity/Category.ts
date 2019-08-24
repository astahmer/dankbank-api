import { Entity, Column, ManyToOne, OneToMany } from "typeorm";
import { Groups, EntityRoute } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { Picture } from "./Picture";
import { User } from "./User";
import { IsDefined } from "class-validator";

@EntityRoute("/categories", ["list", "details"])
@Entity()
export class Category extends AbstractEntity {
    @Groups({
        category: ["list", "details"],
        user: ["list", "details"],
        picture: ["list", "details"],
    })
    @Column()
    name: string;

    @Groups({
        category: ["list", "details"],
        user: ["details"],
    })
    @Column()
    icon: string;

    @Groups({
        category: ["details"],
        user: ["list", "details"],
    })
    @ManyToOne(() => Picture, (picture) => picture.categories, { cascade: ["insert"], nullable: true })
    picture: Picture[];

    @Groups({
        category: ["details"],
    })
    @OneToMany(() => User, (user) => user.profileCategory)
    users: User[];
}
