import { Entity, Column, ManyToMany, JoinTable } from "typeorm";
import { EntityRoute, Groups } from "../decorators";
import { AbstractEntity } from "./AbstractEntity";
import { User } from "./User";

@Entity()
@EntityRoute("/users", ["list"])
export class Team extends AbstractEntity {
    @Groups(["list", "details"])
    @Column()
    teamName: string;

    @Groups(["list", "details"])
    @ManyToMany(() => User, (user) => user.teams)
    @JoinTable()
    members: User[];
}
