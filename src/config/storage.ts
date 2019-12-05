import path = require("path");
import fs = require("fs");
import multer = require("@koa/multer");
import { IncomingMessage } from "http";
import { promisify } from "util";

export const stat = promisify(fs.stat);
export const readFile = promisify(fs.readFile);
export const writeFile = promisify(fs.writeFile);
export const unlink = promisify(fs.unlink);
export const mkdir = async (path: fs.PathLike, mode?: string | number) => {
    try {
        promisify(fs.mkdir)(path, mode);
    } catch (error) {
        if (error.code === "EEXIST") {
            // curDir already exists!
            return;
        } else {
            throw error;
        }
    }
};

export const writeStream = (data: any[], path: string, options?: WriteStreamOptions) => {
    return new Promise((resolve, reject) => {
        const stream = fs.createWriteStream(path, options);
        stream.cork();

        let i = 0;
        for (i; i < data.length; i++) {
            stream.write(data[i]);
        }

        stream.on("error", reject);
        stream.end(resolve);
    });
};

export const readStream = (path: string, options?: ReadstreamOptions): Promise<Buffer[]> => {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(path, options);
        const chunks: Buffer[] = [];

        stream.on("data", (chunk) => chunks.push(chunk));

        stream.on("error", reject);
        stream.on("close", () => resolve(chunks));
    });
};

export const PUBLIC_UPLOADS_DIR = path.resolve(__dirname, "../public/", "uploads");
export const TEMP_UPLOADS_DIR = path.resolve(__dirname, "../tmp/", "uploads");

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

type WriteStreamOptions =
    | string
    | {
          flags?: string;
          encoding?: string;
          fd?: number;
          mode?: number;
          autoClose?: boolean;
          start?: number;
          highWaterMark?: number;
      };

type ReadstreamOptions =
    | string
    | {
          flags?: string;
          encoding?: string;
          fd?: number;
          mode?: number;
          autoClose?: boolean;
          start?: number;
          end?: number;
          highWaterMark?: number;
      };
