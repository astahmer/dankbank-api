import * as Koa from "koa";
import * as Router from "koa-router";
import * as path from "path";
import * as fs from "fs";
import * as multer from "koa-multer";
import * as sharp from "sharp";
import { IncomingMessage } from "http";

import { RouteAction } from "@/services/EntityRoute/Actions/RouteAction";
import { FileEntity } from "@/entity/FileEntity";
import { EntityManager, Connection } from "typeorm";
import { sortObjectByKeys } from "../utils";
import { BASE_URL } from "@/main";

export function useImageUploadRoute(connection: Connection, app: Koa) {
    const router = new Router();
    const action = new ImageUploadAction(connection.manager);
    router.post("/upload", upload.single("image"), action.onRequest.bind(action));

    app.use(router.routes());
}

export function getImageLocalLink(name: string) {
    return path.resolve(PUBLIC_UPLOADS_DIR, name);
}

export function getImageURL(name: string) {
    return BASE_URL + "/public/" + name;
}

class ImageUploadAction implements RouteAction {
    constructor(private entityManager: EntityManager) {}

    public async onRequest(ctx: Koa.Context) {
        const req = <multer.MulterIncomingMessage>ctx.req;
        const filePath = path.parse(req.file.filename);
        const fileName = filePath.name.replace(/\s/g, "_") + "_" + Date.now() + filePath.ext;

        // Resize uploaded file
        const resized = await sharp(req.file.path)
            .resize(500, null, { fit: "inside" })
            .jpeg({ quality: 50 })
            .toFile(path.resolve(PUBLIC_UPLOADS_DIR, fileName));

        // Removes tmp file
        fs.unlink(req.file.path, (err) => {
            if (err) console.log(err);
        });

        const result = await this.entityManager.getRepository(FileEntity).save({
            originalName: req.file.originalname,
            name: fileName,
            size: "" + resized.size,
        });
        ctx.body = sortObjectByKeys(result);
    }
}

const PUBLIC_UPLOADS_DIR = path.resolve(__dirname, "../public/", "uploads");
const TEMP_UPLOADS_DIR = path.resolve(__dirname, "../tmp/", "uploads");
const storage = multer.diskStorage({
    destination: TEMP_UPLOADS_DIR,
    filename: function(req, file, callback) {
        callback(null, file.originalname);
    },
});

const imageFilter = function(
    req: IncomingMessage,
    file: multer.File,
    callback: (error: Error, acceptFile: boolean) => void
) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return callback(new Error("Uploaded file was not an image."), false);
    }

    callback(null, true);
};

const upload = multer({ storage, fileFilter: imageFilter });

if (!fs.existsSync(PUBLIC_UPLOADS_DIR)) {
    (fs.mkdirSync as any)(PUBLIC_UPLOADS_DIR, { recursive: true });
}
