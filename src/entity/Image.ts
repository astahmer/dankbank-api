import { Column, Entity, JoinColumn, OneToOne, ManyToOne } from "typeorm";
import { Groups, Search, EntityRoute, DependsOn } from "@astahmer/entity-routes/";

import { ChunkUploadAction } from "@/actions/ChunkUploadAction";
import { ImageUploadAction, imgUploadMiddleware } from "@/actions/ImageUploadAction";
import { Quality, CropData, getImageRelativeURL, getImageNameSuffixForQuality } from "@/services/ImageManager";

import { AbstractEntity } from "./AbstractEntity";
import { Meme } from "./Meme";

@Search([], { all: true })
@EntityRoute("/images", ["list", "details"], {
    actions: [
        {
            verb: "post",
            path: "/upload/",
            middlewares: [imgUploadMiddleware("image")],
            class: ImageUploadAction,
        },
        {
            verb: "post",
            path: "/upload/crop",
            class: ImageUploadAction,
            action: "crop",
        },
        {
            verb: "post",
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

    @OneToOne(() => Meme, (meme) => meme.image, { onDelete: "CASCADE" })
    meme: Meme;

    @ManyToOne(() => Meme, (meme) => meme.pictures)
    multipartMeme: Meme;

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
