import { Entity, Column } from "typeorm";

import { AbstractEntity } from "./AbstractEntity";
import { EntityRoute } from "@/services/EntityRoute/Decorators";

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
