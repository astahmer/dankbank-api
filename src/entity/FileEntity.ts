import { Entity, Column } from "typeorm";

import { AbstractEntity } from "./AbstractEntity";

@Entity()
export class FileEntity extends AbstractEntity {
    @Column()
    originalName: string;

    @Column()
    name: string;

    @Column()
    size: string;
}
