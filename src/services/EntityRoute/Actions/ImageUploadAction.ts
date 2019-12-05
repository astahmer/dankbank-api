import { Context } from "koa";

import { diskStorage, imageFilter } from "@/config/storage";
import { Image } from "@/entity/Image";
import {
    AbstractRouteAction, RouteActionConstructorArgs
} from "@/services/EntityRoute/Actions/AbstractRouteAction";
import { logger } from "@/services/logger";

import { ImageManager } from "../ImageManager";
import { getRandomString } from "../utils";

import multer = require("@koa/multer");
export const imgUploadMiddleware = (fieldName: string) => async (ctx: Context, next: any) => {
    try {
        await multer({ storage: diskStorage, fileFilter: imageFilter }).single(fieldName)(ctx, next);
    } catch (error) {
        ctx.throw(400);
    }
};

export class ImageUploadAction extends AbstractRouteAction {
    private imageManager: ImageManager<Image>;

    constructor(routeContext: RouteActionConstructorArgs) {
        super(routeContext);

        this.imageManager = new ImageManager(Image.name);
    }

    public async onRequest(ctx: Context) {
        const tmpFile = ctx.file as multer.MulterIncomingMessage["file"];
        const identifier = getRandomString();

        try {
            const [fileName, size, qualities] = await this.imageManager.resize(tmpFile.path, identifier);
            const file = await this.imageManager.save({
                originalName: tmpFile.originalname,
                name: fileName,
                size,
                qualities,
            });

            ctx.body = file;
        } catch (error) {
            logger.error(error);
            ctx.throw(400);
        }
    }

    public async crop(ctx: Context) {
        const fileId = parseInt(ctx.request.body.id);
        const croppedId = parseInt(ctx.request.body.croppedId);
        const cropData = ctx.request.body.cropData;

        if (!fileId || !cropData) {
            ctx.throw(400);
        }

        try {
            const foundFile = await this.imageManager.find(fileId);
            const [name, size, qualities] = await this.imageManager.crop(
                foundFile.name,
                cropData,
                foundFile.qualities,
                croppedId
            );
            const roundedCropData = this.imageManager.roundCropData(cropData);
            const file = await this.imageManager.save(
                {
                    originalName: foundFile.originalName,
                    name,
                    size,
                    qualities,
                    cropData: roundedCropData,
                    parent: fileId as any,
                },
                croppedId
            );

            ctx.body = file;
        } catch (error) {
            logger.error(error);
            ctx.throw(400);
        }
    }
}
