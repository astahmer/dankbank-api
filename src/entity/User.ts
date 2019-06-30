import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { EntityRoute, Groups } from "../decorators";

@Entity()
@EntityRoute("/users", ["list"])
export class User {
    @PrimaryGeneratedColumn()
    public id: number;

    @Column()
    @Groups(["list", "details"])
    firstName: string;

    @Groups(["list", "details"])
    @Column()
    lastName: string;

    @Groups(["create", "details"])
    @Column()
    age: number;
}
