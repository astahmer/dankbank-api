import { Column, Entity } from "typeorm";

import { Groups } from "@/services/EntityRoute/Decorators";

import { AbstractEntity } from "./AbstractEntity";

@Entity()
export class File extends AbstractEntity {
    @Groups({ file: "all" })
    @Column()
    originalName: string;

    @Groups({ file: "all" })
    @Column()
    name: string;

    @Groups({ file: "all" })
    @Column()
    size: number;
}
