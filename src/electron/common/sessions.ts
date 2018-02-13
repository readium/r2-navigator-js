export const R2_SESSION_WEBVIEW = "persist:readium2pubwebview";

export const READIUM2_ELECTRON_HTTP_PROTOCOL = "httpsr2";

export const convertHttpUrlToCustomScheme = (url: string): string => {
    const matches = url.match(/(http[s]?):\/\/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)(?::([0-9]+))?\/pub\/([^\/]+)(\/.*)?/);
    if (matches && matches.length > 1) {
        const pubID = matches[4].replace(/([A-Z])/g, "_$1");
        const url_ = READIUM2_ELECTRON_HTTP_PROTOCOL +
            "://" + matches[1] +
            ".ip" + matches[2] +
            ".p" + matches[3] +
            ".id" + pubID +
            matches[5];
        // console.log("convertHttpUrlToCustomScheme:");
        // console.log(url);
        // console.log("===>");
        // console.log(url_);
        return url_;
    }
    return url;
};

export const convertCustomSchemeToHttpUrl = (url: string): string => {
    let url_ = url.replace(READIUM2_ELECTRON_HTTP_PROTOCOL + "://", "");
    const matches = url_.match(/(http[s]?)\.ip([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\.p([0-9]+)?\.id([^\/]+)(\/.*)?/);
    if (matches && matches.length > 1) {
        const pubID = matches[4].replace(/(_[a-zA-Z])/g, (match) => {
            // console.log(match);
            const ret = match.substr(1).toUpperCase();
            // console.log(ret);
            return ret;
        });
        url_ = matches[1] + "://" +
        matches[2] + ":" + matches[3] +
        "/pub/" + pubID +
        matches[5];
        // console.log("convertCustomSchemeToHttpUrl:");
        // console.log(url);
        // console.log("===>");
        // console.log(url_);
        return url_;
    }
    return url;
};
