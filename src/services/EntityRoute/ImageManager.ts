import { DeepPartial, EntityManager, getManager } from "typeorm";

import { DIR_PATH, unlink } from "@/config/storage";
import { AbstractEntity } from "@/entity/AbstractEntity";
import { Image } from "@/entity/Image";

import { logger } from "../logger";
import { entityRoutesContainer } from "./";
import { GroupsOperation } from "./Decorators/Groups";
import { EntityRoute } from "./EntityRoute";

import path = require("path");
import sharp = require("sharp");
export function getImageLocalPath(name: string) {
    return path.resolve(DIR_PATH.PUBLIC_UPLOADS_DIR, name);
}

export function getImageRelativeURL(name: string) {
    return "/public/uploads/" + name;
}

type ResizeReturn = Promise<[string, number, Quality[]]>;
export class ImageManager<Entity extends AbstractEntity> {
    protected entityRoute: EntityRoute<Entity>;
    protected entityManager: EntityManager;

    constructor(protected entityName: string) {
        this.entityManager = getManager();
        this.entityRoute = entityRoutesContainer[entityName];
    }

    public getMetadata(filePath: string) {
        return sharp(filePath).metadata();
    }

    /**
     * Resize/optimize image file with high/medium/low quality for multiple devices/uses
     * Also converts PNG transparent to a white background
     *
     * @param tmpPath uploaded image temporary path, will be used to remove it after resize operation
     * @param identifier random string identifier
     *
     * @returns [fileName, original.size]
     */
    public async resize(tmpPath: string, identifier: string): ResizeReturn {
        const fileName = identifier + "_" + Date.now() + ".jpg";

        const metadata = await this.getMetadata(tmpPath);
        // Make multiple versions
        const qualities = this.getQualities(metadata.width);
        const resized = await Promise.all(qualities.map((quality) => this.makeImage(fileName, tmpPath, quality)));

        // Remove tmp file
        try {
            unlink(tmpPath);
        } catch (error) {
            logger.error(error);
        }

        return [fileName, resized[0].size, qualities];
    }

    public async find(id: number) {
        return this.entityManager.findOne(Image, id);
    }

    /** Crop & replace existing images */
    public async crop(
        fileName: string,
        cropData: CropData,
        savedQualities: Quality[],
        croppedId?: number
    ): ResizeReturn {
        const filePath = path.resolve(DIR_PATH.PUBLIC_UPLOADS_DIR, fileName);

        const qualities = this.getQualities(cropData.width);
        const cropped = await Promise.all(
            qualities.map((quality) => this.makeImage(fileName, filePath, quality, cropData))
        );

        // Remove original sub-qualities if not done yet
        if (!croppedId) {
            try {
                savedQualities.forEach(
                    (quality) =>
                        quality !== Quality.ORIGINAL &&
                        unlink(filePath.replace(".jpg", getImageNameSuffixForQuality(quality)))
                );
            } catch (error) {
                logger.error(error);
            }
        }

        return [fileName.replace(".jpg", "_cropped.jpg"), cropped[0].size, qualities];
    }

    /** Save entity to DB */
    public async save(img: DeepPartial<Image>, croppedId?: number) {
        const imgObject = !croppedId ? img : { ...img, id: croppedId };
        const entity = this.entityManager.create(Image, imgObject);
        const result = await this.entityManager.save(entity);

        return this.serializeItem(result, "details");
    }

    /** Returned a cleaned & formated entity for a given operation */
    public async serializeItem<Entity extends AbstractEntity = AbstractEntity>(
        entity: Entity,
        operation: GroupsOperation = "details"
    ) {
        const cleaned = this.entityRoute.denormalizer.cleanItem(operation, entity as any);
        const entityInstance: Entity = entity.repository.manager.create(
            entity.getEntityMetadata().targetName,
            cleaned as any
        );

        return this.entityRoute.normalizer.recursiveFormatItem(entityInstance, operation);
    }

    public roundCropData(cropData: CropData) {
        const rounded = {};
        let key;
        for (key in cropData) {
            (rounded as any)[key] = Math.round((cropData as any)[key]);
        }

        return rounded as CropData;
    }

    private getQualities(width: number) {
        const sizes = [Quality.ORIGINAL];
        if (width > QualityFormat[Quality.HIGH].maxSize) {
            sizes.push(Quality.HIGH, Quality.MEDIUM, Quality.LOW);
        } else if (width > QualityFormat[Quality.MEDIUM].maxSize) {
            sizes.push(Quality.MEDIUM, Quality.LOW);
        } else if (width > QualityFormat[Quality.LOW].maxSize) {
            sizes.push(Quality.LOW);
        }

        return sizes;
    }

    private makeImage(fileName: string, filePath: string, quality: Quality, cropData?: CropData) {
        const img = sharp(filePath);
        const isOriginal = quality === Quality.ORIGINAL;

        const suffix = getImageNameSuffixForQuality(quality);
        let destPath = path.resolve(DIR_PATH.PUBLIC_UPLOADS_DIR, fileName);
        destPath = destPath.replace(".jpg", suffix);

        if (cropData) {
            const region = {
                top: Math.round(cropData.y),
                left: Math.round(cropData.x),
                width: Math.round(cropData.width),
                height: Math.round(cropData.height),
            };
            img.extract(region);

            destPath = destPath.replace(suffix, "_cropped" + suffix);
        } else {
            img.flatten({ background: { r: 255, g: 255, b: 255, alpha: 1 } });
        }

        if (!isOriginal) {
            img.resize(QualityFormat[quality].maxSize, QualityFormat[quality].maxSize, {
                fit: "inside",
                withoutEnlargement: true,
            }).jpeg({
                quality: QualityFormat[quality].quality,
            });
        }

        return img.toFile(destPath);
    }
}

export type CropData = {
    rotate: number;
    scaleX: number;
    scaleY: number;
    width: number;
    height: number;
    x: number;
    y: number;
};

type Format = { maxSize: number; quality: number };
export enum Quality {
    ORIGINAL = "ORIGINAL",
    HIGH = "HIGH",
    MEDIUM = "MEDIUM",
    LOW = "LOW",
}

const QualityFormat: Record<Quality, Format> = {
    [Quality.ORIGINAL]: { maxSize: -1, quality: 80 },
    [Quality.HIGH]: { maxSize: 1500, quality: 75 },
    [Quality.MEDIUM]: { maxSize: 750, quality: 70 },
    [Quality.LOW]: { maxSize: 375, quality: 60 },
};

export const getImageNameSuffixForQuality = (quality: Quality) =>
    `${quality !== Quality.ORIGINAL ? "_" + quality.toLowerCase() : ""}.jpg`;
