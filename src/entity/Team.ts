import { Entity, Column, ManyToMany, JoinTable } from "typeorm";
import { EntityRoute, Groups, Subresource } from "@/services/EntityRoute/decorators";
import { AbstractEntity } from "./AbstractEntity";
import { User } from "./User";

@EntityRoute("/teams", ["list", "details"])
@Entity()
export class Team extends AbstractEntity {
    @Groups({
        user: ["list", "details"],
        team: ["list", "details"],
    })
    @Column()
    teamName: string;

    @Groups({
        user: ["list", "details"],
        team: ["list", "details"],
    })
    @Subresource(() => User)
    @ManyToMany(() => User, (user) => user.teams)
    @JoinTable()
    members: User[];
}
