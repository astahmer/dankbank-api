import OAuth = require( "oauth-1.0a");
import crypto = require("crypto");

export const TWITTER_URLS = {
    ACCOUNT_VERIFY: "https://api.twitter.com/1.1/account/verify_credentials.json",
    OAUTH: {
        REQUEST_TOKEN: "https://api.twitter.com/oauth/request_token",
        CALLBACK: "http://api.dankbank.lol/auth/twitter/callback",
        AUTHENTICATE: "https://api.twitter.com/oauth/authenticate?oauth_token=",
        ACCESS_TOKEN: "https://api.twitter.com/oauth/access_token",
    },
};

export const TwitterOAuth = new OAuth({
    consumer: { key: process.env["TWITTER_CONSUMER_KEY"], secret: process.env["TWITTER_CONSUMER_SECRET"] },
    signature_method: "HMAC-SHA1",
    hash_function(base_string, key) {
        return crypto
            .createHmac("sha1", key)
            .update(base_string)
            .digest("base64");
    },
});
