import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Groups } from "../decorators";

export abstract class AbstractEntity {
    @Groups(["list", "details"])
    @PrimaryGeneratedColumn()
    id: number;

    @CreateDateColumn()
    dateCreated: string;

    @UpdateDateColumn()
    dateUpdated: string;
}
