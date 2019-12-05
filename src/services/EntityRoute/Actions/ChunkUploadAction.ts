import { Context } from "koa";

import { DIR_PATH, readStream, unlink, writeStream } from "@/config/storage";
import { Image } from "@/entity/Image";
import { logger } from "@/services/logger";

import { ImageManager } from "../ImageManager";
import { AbstractRouteAction, RouteActionConstructorArgs } from "./AbstractRouteAction";

import fs = require("fs");
export class ChunkUploadAction extends AbstractRouteAction {
    private chunks: Record<string, number[]> = {};
    private imageManager: ImageManager<Image>;

    constructor(routeContext: RouteActionConstructorArgs) {
        super(routeContext);
        this.imageManager = new ImageManager(Image.name);
    }

    public async onRequest(ctx: Context) {
        try {
            const result = await this.onChunkUpload(ctx);
            if (result) {
                const [originalName, tmpPath, identifier] = result;
                const [name, size, qualities] = await this.imageManager.resize(tmpPath, identifier);

                const file = await this.imageManager.save({ originalName, name, size, qualities });
                ctx.body = file;
            } else {
                ctx.status = 200;
            }
        } catch (error) {
            logger.error(error);
            ctx.throw(400);
        }
    }

    public async onChunkUpload(ctx: Context): Promise<[string, string, string] | void> {
        return new Promise(async (resolve, reject) => {
            // Headers info
            const fileId = ctx.req.headers["x-content-id"] as string;
            const chunkId = Number(ctx.req.headers["x-chunk-id"]);
            const chunksTotal = parseInt(ctx.req.headers["x-chunks-total"] as string);
            const originalName = ctx.req.headers["x-content-name"] as string;
            const fileSize = Number(ctx.req.headers["x-content-length"]);

            const fileName = DIR_PATH.TEMP_UPLOADS_DIR + "/" + fileId;
            const filePath = fileName + ".jpg";

            if (!this.chunks[fileId]) {
                // TODO store each chunk directly in Redis like this.chunks[fileId][chunkId] instead of writing a tmp file
                this.chunks[fileId] = [];
            }

            const stream = fs.createWriteStream(fileName + chunkId + ".tmp", { flags: "a" });
            ctx.req.pipe(stream).on("finish", async () => {
                this.chunks[fileId].push(chunkId);

                if (this.chunks[fileId].length === chunksTotal) {
                    // All chunks were sent
                    try {
                        // Re-ordering tmp files content & merging them back together
                        const orderedChunks = this.chunks[fileId].sort((a, b) => a - b);
                        const tmpChunks = await Promise.all(
                            orderedChunks.map((id) => readStream(fileName + id + ".tmp"))
                        );
                        const completeFile = Buffer.concat(tmpChunks.reduce((acc, val) => acc.concat(val), []));

                        // Write original file in one piece
                        await writeStream([completeFile], filePath);

                        if (completeFile.length !== fileSize) {
                            return reject(new Error("File is not complete"));
                        }

                        try {
                            orderedChunks.map((id) => unlink(fileName + id + ".tmp"));
                        } catch (error) {
                            logger.error("There was an error removing tmp chunk files", error);
                        }

                        delete this.chunks[fileId];

                        // Upload successful
                        resolve([originalName, filePath, fileId]);
                    } catch (error) {
                        return reject(error);
                    }
                } else {
                    // Chunk was successfuly uploaded, waiting for the remainings
                    resolve();
                }
            });
        });
    }
}
