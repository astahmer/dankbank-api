import path = require("path");
import fs = require("fs");
import multer = require("@koa/multer");
import { IncomingMessage } from "http";

const PUBLIC_UPLOADS_DIR = path.resolve(__dirname, "../public/", "uploads");
const TEMP_UPLOADS_DIR = path.resolve(__dirname, "../tmp/", "uploads");

if (!fs.existsSync(PUBLIC_UPLOADS_DIR)) {
    (fs.mkdirSync as any)(PUBLIC_UPLOADS_DIR, { recursive: true });
}

export const DIR_PATH = {
    PUBLIC_UPLOADS_DIR,
    TEMP_UPLOADS_DIR,
};

export const diskStorage = multer.diskStorage({
    destination: TEMP_UPLOADS_DIR,
    filename: function(_req, file, callback) {
        callback(null, file.originalname);
    },
});

export const imageFilter = function(
    _req: IncomingMessage,
    file: multer.File,
    callback: (error: Error, acceptFile: boolean) => void
) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return callback(new Error("Uploaded file was not an image."), false);
    }

    callback(null, true);
};
