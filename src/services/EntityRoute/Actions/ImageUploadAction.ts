import { Context } from "koa";
import { EntityManager, getManager } from "typeorm";

import { DIR_PATH, diskStorage, imageFilter } from "@/config/storage";
import { File } from "@/entity/File";
import { BASE_URL } from "@/main";
import {
    AbstractRouteAction, RouteActionConstructorArgs
} from "@/services/EntityRoute/Actions/RouteAction";



import path = require("path");
import fs = require("fs");
import multer = require("@koa/multer");
import sharp = require("sharp");

export function getImageLocalLink(name: string) {
    return path.resolve(DIR_PATH.PUBLIC_UPLOADS_DIR, name);
}

export function getImageURL(name: string) {
    return BASE_URL + "/public/" + name;
}

export const imgUploadMiddleware = multer({ storage: diskStorage, fileFilter: imageFilter }).single("image");

export class ImageUploadAction extends AbstractRouteAction {
    private entityManager: EntityManager;

    constructor(routeContext: RouteActionConstructorArgs) {
        super(routeContext);

        this.middlewares.push(imgUploadMiddleware);
        this.entityManager = getManager();
    }

    public async onRequest(ctx: Context) {
        const req = <multer.MulterIncomingMessage>ctx.req;
        const filePath = path.parse(req.file.filename);
        const fileName = filePath.name.replace(/\s/g, "_") + "_" + Date.now() + filePath.ext;

        // Resize uploaded file
        const resized = await sharp(req.file.path)
            .resize(500, null, { fit: "inside" })
            .jpeg({ quality: 50 })
            .toFile(path.resolve(DIR_PATH.PUBLIC_UPLOADS_DIR, fileName));

        // Removes tmp file
        fs.unlink(req.file.path, (err) => {
            if (err) console.log(err);
        });

        const result = await this.entityManager.getRepository(File).save({
            originalName: req.file.originalname,
            name: fileName,
            size: resized.size,
        });

        ctx.body = this.serializeItem(result);
    }
}
