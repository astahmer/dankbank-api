import { NextFunction } from "connect";
import { Context } from "koa";

import { TWITTER_URLS, TwitterOAuth } from "@/config/twitter";

import { ROUTE_VERB } from "../EntityRoute/ResponseManager";
import { getAuthorizedRequest } from "./utils";

export type TwitterSuccessCallbackArgs = {
    oauth_token: string;
    oauth_token_secret: string;
    user_id: string;
    screen_name: string;
};
export type TwitterSuccessCallback = (
    ctx: Context,
    next: NextFunction,
    args: TwitterSuccessCallbackArgs
) => Promise<void>;

export class TwitterOAuthManager {
    constructor(private successCallback: TwitterSuccessCallback) {}

    async twitterSignIn(ctx: Context) {
        const requestTokenReq = await getAuthorizedRequest(TwitterOAuth, {
            url: TWITTER_URLS.OAUTH.REQUEST_TOKEN,
            data: { oauth_callback: TWITTER_URLS.OAUTH.CALLBACK },
            method: ROUTE_VERB.POST,
        });
        const { oauth_token, oauth_token_secret } = TwitterOAuth.deParam(requestTokenReq.data);
        ctx.session.twitterTokens = { oauth_token, oauth_token_secret };
        ctx.redirect(TWITTER_URLS.OAUTH.AUTHENTICATE + oauth_token);
    }

    async twitterCallback(ctx: Context, next: NextFunction) {
        if (!this.isSessionToken(ctx)) {
            ctx.redirect("http://dankbank.lol/twitter.html?err=WRONG_SESSION");
            return;
        }
        ctx.session = null;

        // Get access token
        const { oauth_token, oauth_verifier } = ctx.request.query;

        try {
            const accessTokenReq = await getAuthorizedRequest(TwitterOAuth, {
                url: TWITTER_URLS.OAUTH.ACCESS_TOKEN,
                method: ROUTE_VERB.POST,
                data: { oauth_token, oauth_verifier },
            });

            const tokenResponse = TwitterOAuth.deParam(accessTokenReq.data);
            await this.successCallback(ctx, next, (tokenResponse as any) as TwitterSuccessCallbackArgs);
        } catch (error) {
            ctx.redirect("http://dankbank.lol/twitter.html?err=ACCESS_TOKEN");
        }
    }

    isSessionToken(ctx: Context) {
        return ctx.session.twitterTokens && ctx.session.twitterTokens.oauth_token === ctx.request.query.oauth_token;
    }
}
