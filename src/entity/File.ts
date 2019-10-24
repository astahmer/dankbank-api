import { Column, Entity } from "typeorm";

import { EntityRoute } from "@/services/EntityRoute/Decorators";

import { AbstractEntity } from "./AbstractEntity";

@EntityRoute("/files")
@Entity()
export class File extends AbstractEntity {
    @Column()
    originalName: string;

    @Column()
    name: string;

    @Column()
    size: number;
}
