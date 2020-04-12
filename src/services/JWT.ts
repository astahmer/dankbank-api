import jwt = require("jsonwebtoken");

import { ACCESS_TOKEN_DURATION, REFRESH_TOKEN_DURATION } from "@/config/jwt";
import { getDefaultMemeBankFor } from "@/entity/MemeBank";

export type JwtPayload = { id: number; name: string; isRefreshToken?: boolean; refreshTokenVersion?: number };
export type JwtDecoded = JwtPayload & { iat: number; exp: number };

export async function makeAuthTokens(payload: JwtPayload) {
    const { refreshTokenVersion, ...rest } = payload;

    const defaultMemeBank = await getDefaultMemeBankFor(payload.id);

    const [accessToken, refreshToken] = await Promise.all([
        makeToken(rest, ACCESS_TOKEN_DURATION, defaultMemeBank),
        makeToken({ ...payload, refreshTokenVersion, isRefreshToken: true }, REFRESH_TOKEN_DURATION, defaultMemeBank),
    ]);

    return {
        accessToken,
        refreshToken,
    };
}

export async function makeToken(payload: JwtPayload, expiresIn: string | number, memeBankId?: number): Promise<string> {
    const defaultMemeBank = memeBankId || (await getDefaultMemeBankFor(payload.id));
    const data = { ...payload, defaultMemeBank };

    return new Promise((resolve, reject) => {
        jwt.sign(data, process.env["JWT_TOKEN_SECRET"], { expiresIn }, (err, token) => {
            if (err) {
                reject(err);
            } else {
                resolve(token);
            }
        });
    });
}

export async function isTokenValid(token: string): Promise<JwtDecoded> {
    return new Promise((resolve, reject) => {
        const actualToken = token && token.split("Bearer ")[1];
        if (!token || !actualToken) {
            return reject(new Error("No token found"));
        }

        jwt.verify(actualToken, process.env["JWT_TOKEN_SECRET"], function (err, decoded: JwtDecoded) {
            if (err) {
                reject(err);
            } else {
                resolve(decoded);
            }
        });
    });
}
