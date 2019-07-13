import { Entity, Column, ManyToOne, OneToMany } from "typeorm";
import { Groups } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { Picture } from "./Picture";
import { User } from "./User";

@Entity()
export class Category extends AbstractEntity {
    @Column()
    @Groups(["list", "details"])
    name: string;

    @Column()
    @Groups(["list", "details", "update"])
    icon: string;

    @ManyToOne(() => Picture, (picture) => picture.categories, { cascade: ['insert']})
    @Groups(["list", "details"])
    picture: Picture[];

    @Groups(["list", "details"])
    @OneToMany(() => User, (user) => user.profileCategory)
    users: User[];
}
