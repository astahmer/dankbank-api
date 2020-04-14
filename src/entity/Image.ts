import { Column, Entity, JoinColumn, OneToOne, ManyToOne } from "typeorm";

import { ChunkUploadAction } from "@/services/EntityRoute/Actions/ChunkUploadAction";
import { ImageUploadAction, imgUploadMiddleware } from "@/services/EntityRoute/Actions/ImageUploadAction";
import { DependsOn, EntityRoute, Groups, SearchFilter } from "@/services/EntityRoute/Decorators";
import {
    CropData,
    getImageNameSuffixForQuality,
    getImageRelativeURL,
    Quality,
} from "@/services/EntityRoute/ImageManager";
import { ROUTE_VERB } from "@/services/EntityRoute/ResponseManager";

import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";

@SearchFilter([], { all: true })
@EntityRoute("/images", ["list", "details"], {
    actions: [
        {
            verb: ROUTE_VERB.POST,
            path: "/upload/",
            middlewares: [imgUploadMiddleware("image")],
            class: ImageUploadAction,
        },
        {
            verb: ROUTE_VERB.POST,
            path: "/upload/crop",
            class: ImageUploadAction,
            action: "crop",
        },
        {
            verb: ROUTE_VERB.POST,
            path: "/upload/chunk",
            class: ChunkUploadAction,
        },
    ],
})
@Entity()
export class Image extends AbstractEntity {
    @Groups({ image: ["details"], meme: ["details"] })
    @Column()
    originalName: string;

    @Groups({ image: ["details"] })
    @Column()
    name: string;

    @Groups({ image: ["details"] })
    @Column()
    size: number;

    @ManyToOne(() => Meme, (meme) => meme.pictures)
    meme: Meme;

    @Groups({ image: ["details"] })
    @OneToOne(() => Image)
    @JoinColumn()
    parent: Image;

    @Groups({ image: ["details"] })
    @Column({ type: "set", enum: Quality, default: [Quality.ORIGINAL] })
    qualities: Quality[];

    @Groups({ image: ["details"] })
    @Column("simple-json", { nullable: true })
    cropData: CropData;

    @Groups({ image: ["details"] })
    getUrl() {
        return getImageRelativeURL(this.name);
    }

    @DependsOn(["name", "qualities"])
    @Groups({ image: ["details", "list"], meme: ["details"] })
    getQualitiesUrl() {
        return this.qualities?.reduce((acc, item) => {
            acc[item] = getImageRelativeURL(this.name.replace(".jpg", getImageNameSuffixForQuality(item)));
            return acc;
        }, {} as Record<string, string>);
    }

    @DependsOn(["cropData"])
    @Groups({ image: ["list"] })
    getRatio() {
        return this.cropData ? this.cropData.width / this.cropData.height : null;
    }
}
