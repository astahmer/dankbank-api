import { Column, Entity, JoinColumn, OneToMany, OneToOne } from "typeorm";

import { userCreationMw } from "@/actions/User/CreationAction";
import {
    EntityRoute, Groups, PaginationFilter, SearchFilter
} from "@/services/EntityRoute/Decorators";
import { Subresource } from "@/services/EntityRoute/Decorators/Subresource";

import { AbstractEntity } from "./AbstractEntity";
import { Image } from "./Image";
import { MemeBank } from "./MemeBank";
import { Visibility } from "./Visibility";

@PaginationFilter({ all: true })
@SearchFilter(["id", ["name", "startsWith"]])
@EntityRoute("/users", ["list", "details", "update", "delete"], {
    actions: [userCreationMw],
})
@Entity()
export class User extends AbstractEntity {
    @Groups({
        user: ["create", "list", "details", "update"],
    })
    @Column({ unique: true })
    name: string;

    @Groups({
        user: ["create", "list", "details", "update"],
    })
    @Column({ nullable: true })
    email: string;

    @Column({ select: false, nullable: true })
    password: string;

    @Groups({
        user: ["details", "update"],
    })
    @Column({ type: "enum", enum: Visibility, default: Visibility.PUBLIC })
    visibility: Visibility;

    @Groups({
        user: ["list", "details"],
    })
    @Subresource(() => MemeBank)
    @OneToMany(() => MemeBank, (bank) => bank.owner, { cascade: ["remove"] })
    banks: MemeBank[];

    @Groups({
        user: ["create", "details", "update"],
    })
    @OneToOne(() => Image)
    @JoinColumn()
    profilePicture: Image;

    @Column({ unique: true, nullable: true })
    twitterId: string;

    @Column({ default: 0, select: false })
    refreshTokenVersion: number;
}
