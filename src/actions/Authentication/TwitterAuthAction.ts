import { NextFunction } from "connect";
import { Context } from "koa";
import { EntityManager, getManager, Repository } from "typeorm";

import { TWITTER_URLS, TwitterOAuth } from "@/config/twitter";
import { User } from "@/entity/User";
import { makeRouterFromCustomActions } from "@/services/EntityRoute/Actions/AbstractRouteAction";
import { ROUTE_VERB } from "@/services/EntityRoute/ResponseManager";
import { isTokenValid, makeAuthTokens } from "@/services/JWT";
import { logger } from "@/services/logger";
import { TwitterOAuthManager, TwitterSuccessCallbackArgs } from "@/services/OAuth/TwitterOAuth";
import { getAuthorizedRequest } from "@/services/OAuth/utils";

import crypto = require("crypto");

export function useTwitterAuth() {
    const action = new TwitterAuthAction();
    const auth = new TwitterOAuthManager(action.onTwitterCallbackSuccess.bind(action));

    return makeRouterFromCustomActions([
        {
            verb: ROUTE_VERB.GET,
            path: "/",
            handler: auth.twitterSignIn.bind(auth),
        },
        {
            verb: ROUTE_VERB.GET,
            path: "/callback",
            handler: auth.twitterCallback.bind(auth),
        },
    ]);
}
type OAuthCredentials = { key: string; secret: string };

class TwitterAuthAction {
    private manager: EntityManager;
    private userRepository: Repository<User>;
    private credentials: OAuthCredentials;

    constructor() {
        this.manager = getManager();
        this.userRepository = this.manager.getRepository(User);
    }

    async onTwitterCallbackSuccess(
        ctx: Context,
        _next: NextFunction,
        { oauth_token, oauth_token_secret, user_id, screen_name }: TwitterSuccessCallbackArgs
    ) {
        this.credentials = { key: oauth_token, secret: oauth_token_secret };

        try {
            // Logged user
            const decoded = await isTokenValid(ctx.req.headers.authorization);
            const user = await this.getUserWithId(decoded.id);
            logger.info("Found logged user#" + user.id, "linking it with twitter id");

            user.twitterId = user_id;
            this.manager.save(user);

            ctx.body = { success: true, logged: true, user };
        } catch (error) {
            // Anonymous user
            try {
                const { id, name, refreshTokenVersion } = await this.getUserForTwitterId(user_id, screen_name);
                const tokens = await makeAuthTokens({ id, name, refreshTokenVersion });
                const queryString = `accessToken=${encodeURIComponent(
                    tokens.accessToken
                )}&refreshToken=${encodeURIComponent(tokens.refreshToken)}`;
                ctx.redirect(`${process.env.PUBLIC_URL}/twitter.html?${queryString}`);
            } catch (error) {
                const err = error.code === "ER_DUP_ENTRY" ? error.code : "UNKNOWN";
                ctx.redirect(`${process.env.PUBLIC_URL}/twitter.html?err=${err}`);
            }
        }
    }

    async getUserWithId(id: number) {
        return this.userRepository.findOne(id);
    }

    hashRefreshToken(refreshToken: string) {
        return crypto
            .createHmac("sha256", process.env["REFRESH_TOKEN_HASH_SECRET"])
            .update(refreshToken)
            .digest("hex");
    }

    async findUserByTwitterId(twitterId: string) {
        return this.userRepository.findOne({ select: ["id", "refreshTokenVersion"], where: { twitterId } });
    }

    async getUserForTwitterId(twitterId: string, name: string) {
        try {
            const user = await this.findUserByTwitterId(twitterId);
            logger.info("Found user by twitterId: user.id#", user.id);
            return user;
        } catch (error) {
            logger.error("Could not find twitter user with id#", twitterId, "creating a new user");

            const user = this.manager.create(User, { name, twitterId, refreshTokenVersion: 0 });
            return await this.manager.save(user);
        }
    }

    async getTwitterProfile() {
        return getAuthorizedRequest(TwitterOAuth, {
            url: TWITTER_URLS.ACCOUNT_VERIFY,
            method: ROUTE_VERB.GET,
            credentials: this.credentials,
        });
    }
}
