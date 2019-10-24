import axios, { AxiosResponse } from "axios";

import { ROUTE_VERB } from "../EntityRoute/ResponseManager";

export const getAuthorizedRequest = async (
    oauth: OAuth,
    { url, data, method, credentials }: { url: string; data?: any; method: ROUTE_VERB; credentials?: OAuth.Token }
): Promise<AxiosResponse<any>> => {
    const req = { url, data, method };
    const headers = oauth.toHeader(oauth.authorize(req, credentials));

    return axios({ method, url, data, headers });
};
