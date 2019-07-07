import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Groups } from "../decorators";

export abstract class AbstractEntity {
    @Groups(["list", "details"])
    @PrimaryGeneratedColumn()
    id: number;

    @Groups(["details"])
    @CreateDateColumn()
    dateCreated: string;

    @Groups(["details"])
    @UpdateDateColumn()
    dateUpdated: string;
}
