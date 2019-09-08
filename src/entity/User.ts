import { Entity, Column, OneToMany, OneToOne, JoinColumn } from "typeorm";

import { EntityRoute, Groups, SearchFilter, PaginationFilter } from "@/services/EntityRoute/Decorators";
import { Subresource } from "@/services/EntityRoute/Decorators/Subresource";
import { Visibility } from "./Visibility";
import { AbstractEntity } from "./AbstractEntity";
import { MemeBank } from "./MemeBank";
import { File } from "./File";

@PaginationFilter([], { all: true })
@SearchFilter(["id", { name: "startsWith" }])
@EntityRoute("/users", ["create", "list", "details", "update", "delete"])
@Entity()
export class User extends AbstractEntity {
    @Groups({
        user: ["create", "list", "details", "update"],
    })
    @Column()
    name: string;

    @Groups({
        user: ["create", "list", "details", "update"],
    })
    @Column()
    email: string;

    @Groups({
        user: ["details", "update"],
    })
    @Column({ type: "enum", enum: Visibility, default: Visibility.PUBLIC })
    visibility: Visibility;

    @Subresource(() => MemeBank, { operations: ["details"] })
    @OneToOne(() => MemeBank, (bank) => bank.owner)
    @JoinColumn()
    favorites: MemeBank;

    @Groups({
        user: ["list", "details"],
    })
    @Subresource(() => MemeBank)
    @OneToMany(() => MemeBank, (bank) => bank.owner)
    banks: MemeBank[];

    @Groups({
        user: ["create", "details", "update"],
    })
    @OneToOne(() => File)
    @JoinColumn()
    profilePicture: File;
}
