import axios, { AxiosResponse } from "axios";
import { RouteVerb } from "@astahmer/entity-routes/";

export const getAuthorizedRequest = async (
    oauth: OAuth,
    { url, data, method, credentials }: { url: string; data?: any; method: RouteVerb; credentials?: OAuth.Token }
): Promise<AxiosResponse<any>> => {
    const req = { url, data, method };
    const headers = oauth.toHeader(oauth.authorize(req, credentials));

    return axios({ method, url, data, headers });
};
