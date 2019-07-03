import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Groups } from "../decorators";

export abstract class AbstractEntity {
    @Groups(["list", "details"])
    @PrimaryGeneratedColumn()
    id: number;

    @Groups(["list", "details"])
    @CreateDateColumn()
    dateCreated: string;

    @Groups(["list", "details"])
    @UpdateDateColumn()
    dateUpdated: string;
}
