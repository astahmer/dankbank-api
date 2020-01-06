import { Column, Entity, JoinColumn, OneToOne } from "typeorm";

import { ChunkUploadAction } from "@/services/EntityRoute/Actions/ChunkUploadAction";
import {
    ImageUploadAction, imgUploadMiddleware
} from "@/services/EntityRoute/Actions/ImageUploadAction";
import { DependsOn, EntityRoute, Groups } from "@/services/EntityRoute/Decorators";
import {
    CropData, getImageNameSuffixForQuality, getImageURL, Quality
} from "@/services/EntityRoute/ImageManager";
import { ROUTE_VERB } from "@/services/EntityRoute/ResponseManager";

import { AbstractEntity } from "./AbstractEntity";

@EntityRoute("/images", ["details"], {
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
    @Groups({ image: "all", meme: ["details"] })
    @Column()
    originalName: string;

    @Groups({ image: "all" })
    @Column()
    name: string;

    @Groups({ image: "all" })
    @Column()
    size: number;

    @Groups({ image: "all" })
    @OneToOne(() => Image)
    @JoinColumn()
    parent: Image;

    @Groups({ image: "all" })
    @Column({ type: "set", enum: Quality, default: [Quality.ORIGINAL] })
    qualities: Quality[];

    @Groups({ image: "all" })
    @Column("simple-json", { nullable: true })
    cropData: CropData;

    @Groups({ image: "all" })
    getUrl() {
        return getImageURL(this.name);
    }

    @DependsOn(["qualities"])
    @Groups({ image: "all", meme: ["details"] })
    getQualitiesUrl() {
        return (
            this.qualities &&
            this.qualities.reduce(
                (acc, item) => {
                    acc[item] = getImageURL(this.name.replace(".jpg", getImageNameSuffixForQuality(item)));
                    return acc;
                },
                {} as Record<string, string>
            )
        );
    }

    // TODO Fix normalizer when selecting only computed prop & id
    @DependsOn(["cropData"])
    @Groups({ image: "all" })
    getRatio() {
        return this.cropData ? this.cropData.width / this.cropData.height : null;
    }
}
