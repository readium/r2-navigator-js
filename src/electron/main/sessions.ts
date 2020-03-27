// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debug_ from "debug";
import {
    CertificateVerifyProcProcRequest, RedirectRequest, Request, StreamProtocolResponse, app,
    protocol, session,
} from "electron";
import * as request from "request";
import * as requestPromise from "request-promise-native";
import { PassThrough } from "stream";

import { Server } from "@r2-streamer-js/http/server";

import {
    R2_SESSION_WEBVIEW, READIUM2_ELECTRON_HTTP_PROTOCOL, convertCustomSchemeToHttpUrl,
} from "../common/sessions";

const debug = debug_("r2:navigator#electron/main/sessions");

const USE_STREAM_PROTOCOL_INSTEAD_OF_HTTP = true;

interface PromiseFulfilled<T> {
    status: "fulfilled";
    value: T;
}
interface PromiseRejected {
    status: "rejected";
    reason: any;
}

async function promiseAllSettled<T>(promises: Array<Promise<T>>):
    Promise<Array<(PromiseFulfilled<T> | PromiseRejected)>> {

    const promises_ = promises.map(async (promise) => {
        return promise
            .then<PromiseFulfilled<T>>((value) => {
                return {
                    status: "fulfilled",
                    value,
                };
            })
            .catch((reason) => {
                return {
                    reason,
                    status: "rejected",
                } as PromiseRejected;
            });
    });
    return Promise.all(promises_);
}

let _server: Server | undefined; // hacky (global reference context used in streamProtocolHandler callback)
export function secureSessions(server: Server) {
    _server = server;

    const filter = { urls: ["*://*/*"] };

    // https://github.com/electron/electron/blob/master/docs/tutorial/security.md#csp-http-header
    const onHeadersReceivedCB = (details: any, callback: any) => {
        // debug("onHeadersReceived");
        // debug(details);

        if (!details.url) {
            callback({});
            return;
        }

        const serverUrl = server.serverUrl();

        if ((serverUrl && details.url.startsWith(serverUrl)) ||
            details.url.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://")) {

            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    "Content-Security-Policy":
                        // tslint:disable-next-line:max-line-length
                        [`default-src 'self' 'unsafe-inline' 'unsafe-eval' data: http: https: ${READIUM2_ELECTRON_HTTP_PROTOCOL}: ${serverUrl}`],
                },
            });
        } else {
            callback({});
        }
    };

    const onBeforeSendHeadersCB = (details: any, callback: any) => {
        // debug("onBeforeSendHeaders");
        // debug(details);

        // details.requestHeaders["User-Agent"] = "R2 Electron";

        if (!details.url) {
            callback({});
            return;
        }

        const serverUrl = server.serverUrl();

        if (server.isSecured() &&
            ((serverUrl && details.url.startsWith(serverUrl)) ||
                details.url.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://"))) {

            const header = server.getSecureHTTPHeader(details.url);
            if (header) {
                details.requestHeaders[header.name] = header.value;
            }
            callback({ cancel: false, requestHeaders: details.requestHeaders });
        } else {
            callback({ cancel: false });
        }
    };

    // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#session
    const setCertificateVerifyProcCB = (
        req: CertificateVerifyProcProcRequest,
        callback: (verificationResult: number) => void) => {
        // debug("setCertificateVerifyProc");
        // debug(req);

        if (server.isSecured()) {
            const info = server.serverInfo();
            if (info) {
                // debug(info);
                if (req.hostname === info.urlHost) {
                    callback(0); // OK
                    return;
                }
            }
        }
        callback(-3); // Chromium
        // callback(-2); // Fail
    };

    if (session.defaultSession) {
        session.defaultSession.webRequest.onHeadersReceived(filter, onHeadersReceivedCB);
        session.defaultSession.webRequest.onBeforeSendHeaders(filter, onBeforeSendHeadersCB);
        session.defaultSession.setCertificateVerifyProc(setCertificateVerifyProcCB);
    }

    const webViewSession = getWebViewSession();
    if (webViewSession) {
        webViewSession.webRequest.onHeadersReceived(filter, onHeadersReceivedCB);
        webViewSession.webRequest.onBeforeSendHeaders(filter, onBeforeSendHeadersCB);
        webViewSession.setCertificateVerifyProc(setCertificateVerifyProcCB);
    }

    app.on("certificate-error", (event, _webContents, url, _error, _certificate, callback) => {
        // debug("certificate-error");
        // debug(url);
        // debug(_error);
        // debug(_certificate);

        if (server.isSecured()) {
            const info = server.serverInfo();
            if (info) {
                // debug(info);
                if (url.indexOf(info.urlScheme + "://" + info.urlHost) === 0) {
                    // debug("certificate-error: BYPASS");

                    event.preventDefault();
                    callback(true);
                    return;
                }
            }
        }

        callback(false);
    });

    // app.on("select-client-certificate", (event, _webContents, url, list, callback) => {
    //     debug("select-client-certificate");
    //     debug(url);
    //     debug(list);

    //     if (server.isSecured()) {
    //         const info = server.serverInfo();
    //         if (info) {
    //             debug(info);
    //             if (url.indexOf(info.urlScheme + "://" + info.urlHost) === 0) {
    //                 debug("select-client-certificate: BYPASS");

    //                 event.preventDefault();
    //                 callback({ data: info.clientcert } as Certificate);
    //                 return;
    //             }
    //         }
    //     }

    //     callback();
    // });
}

const streamProtocolHandler = async (
    req: Request,
    callback: (stream?: (NodeJS.ReadableStream) | (StreamProtocolResponse)) => void) => {

    // debug("streamProtocolHandler:");
    // debug(req.url);
    // debug(req.referrer);
    // debug(req.method);
    // debug(req.headers);

    const url = convertCustomSchemeToHttpUrl(req.url);
    // debug(url);

    const u = new URL(url);
    let ref = u.origin;
    // debug(ref);
    if (req.referrer && req.referrer.trim()) {
        ref = req.referrer;
        // debug(ref);
    }

    const failure = (err: any) => {
        debug(err);
        callback();
    };

    const success = (response: request.RequestResponse) => {

        const headers: Record<string, (string) | (string[])> = {};
        Object.keys(response.headers).forEach((header: string) => {
            const val = response.headers[header];

            // debug(header + " => " + val);

            if (val) {
                headers[header] = val;
            }
        });
        if (!headers.referer) {
            headers.referer = ref;
        }

        // debug(response);
        // debug(response.body);

        if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
            failure("HTTP CODE " + response.statusCode);
            return;
        }

        // let length = 0;
        // const lengthStr = response.headers["content-length"];
        // if (lengthStr) {
        //     length = parseInt(lengthStr, 10);
        // }

        const stream = new PassThrough();
        response.pipe(stream);

        const obj = {
            data: stream, // NodeJS.ReadableStream
            headers,
            statusCode: response.statusCode,
        };
        callback(obj);

        // let responseStr: string;
        // if (response.body) {
        //     debug("RES BODY");
        //     responseStr = response.body;
        // } else {
        //     debug("RES STREAM");
        //     let responseData: Buffer;
        //     try {
        //         responseData = await streamToBufferPromise(response);
        //     } catch (err) {
        //         debug(err);
        //         return;
        //     }
        //     responseStr = responseData.toString("utf8");
        // }
    };

    const reqHeaders = req.headers;
    if (_server) {
        const serverUrl = _server.serverUrl();

        if (_server.isSecured() &&
            ((serverUrl && url.startsWith(serverUrl)) ||
            url.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://"))) {

            const header = _server.getSecureHTTPHeader(url);
            if (header) {
                reqHeaders[header.name] = header.value;
            }
        }
    }

    // No response streaming! :(
    // https://github.com/request/request-promise/issues/90
    const needsStreamingResponse = true;

    if (needsStreamingResponse) {
        request.get({
            headers: reqHeaders,
            method: "GET",
            rejectUnauthorized: false, // self-signed certificate
            uri: url,
        })
        .on("response", (response: request.RequestResponse) => {
            success(response);
        })
        .on("error", (err: any) => {
            failure(err);
        });
    } else {
        let response: requestPromise.FullResponse;
        try {
            // tslint:disable-next-line:await-promise no-floating-promises
            response = await requestPromise({
                headers: reqHeaders,
                method: "GET",
                rejectUnauthorized: false, // self-signed certificate
                resolveWithFullResponse: true,
                uri: url,
            });
            success(response);
        } catch (err) {
            failure(err);
        }
    }
};
const httpProtocolHandler = (
    req: Request,
    callback: (redirectRequest: RedirectRequest) => void) => {

    // debug("httpProtocolHandler:");
    // debug(req.url);
    // debug(req.referrer);
    // debug(req.method);
    // debug(req.headers);

    const url = convertCustomSchemeToHttpUrl(req.url);
    // debug(url);

    callback({
        method: req.method,
        session: getWebViewSession(), // session.defaultSession
        url,
    });
};

export function initSessions() {

    // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#webframe
    if ((protocol as any).registerStandardSchemes) {
        (protocol as any).registerStandardSchemes([READIUM2_ELECTRON_HTTP_PROTOCOL], { secure: true });
    } else {
        // tslint:disable-next-line:max-line-length
        // https://github.com/electron/electron/blob/v5.0.0/docs/api/breaking-changes.md#privileged-schemes-registration
        protocol.registerSchemesAsPrivileged([{
            privileges: {
                allowServiceWorkers: false,
                bypassCSP: false,
                corsEnabled: true,
                secure: true,
                standard: true,
                supportFetchAPI: true,
            },
            scheme: READIUM2_ELECTRON_HTTP_PROTOCOL,
        }]);
    }

    app.on("ready", async () => {
        debug("app ready");

        try {
            await clearSessions();
        } catch (err) {
            debug(err);
        }

        // registered below (session.defaultSession.protocol === protocol)
        // protocol.registerHttpProtocol(
        //     READIUM2_ELECTRON_HTTP_PROTOCOL,
        //     httpProtocolHandler,
        //     (error: Error) => {
        //         if (error) {
        //             debug(error);
        //         } else {
        //             debug("registerHttpProtocol OKAY (protocol session)");
        //         }
        //     });
        if (session.defaultSession) {
            if (USE_STREAM_PROTOCOL_INSTEAD_OF_HTTP) {

                session.defaultSession.protocol.registerStreamProtocol(
                    READIUM2_ELECTRON_HTTP_PROTOCOL,
                    streamProtocolHandler,
                    (error: Error) => {
                        if (error) {
                            debug("registerStreamProtocol ERROR (default session)");
                            debug(error);
                        } else {
                            debug("registerStreamProtocol OKAY (default session)");
                        }
                    });
            } else {
                session.defaultSession.protocol.registerHttpProtocol(
                    READIUM2_ELECTRON_HTTP_PROTOCOL,
                    httpProtocolHandler,
                    (error: Error) => {
                        if (error) {
                            debug("registerHttpProtocol ERROR (default session)");
                            debug(error);
                        } else {
                            debug("registerHttpProtocol OKAY (default session)");
                        }
                    });
            }
        }
        const webViewSession = getWebViewSession();
        if (webViewSession) {
            if (USE_STREAM_PROTOCOL_INSTEAD_OF_HTTP) {

                webViewSession.protocol.registerStreamProtocol(
                    READIUM2_ELECTRON_HTTP_PROTOCOL,
                    streamProtocolHandler,
                    (error: Error) => {
                        if (error) {
                            debug("registerStreamProtocol ERROR (webview session)");
                            debug(error);
                        } else {
                            debug("registerStreamProtocol OKAY (webview session)");
                        }
                    });
            } else {
                webViewSession.protocol.registerHttpProtocol(
                    READIUM2_ELECTRON_HTTP_PROTOCOL,
                    httpProtocolHandler,
                    (error: Error) => {
                        if (error) {
                            debug("registerHttpProtocol ERROR (webview session)");
                            debug(error);
                        } else {
                            debug("registerHttpProtocol OKAY (webview session)");
                        }
                    });
            }

            webViewSession.setPermissionRequestHandler((wc, permission, callback) => {
                debug("setPermissionRequestHandler");
                debug(wc.getURL());
                debug(permission);
                callback(true);
            });
        }
    });

    async function willQuitCallback(evt: Electron.Event) {
        debug("app will quit");
        evt.preventDefault();

        app.removeListener("will-quit", willQuitCallback);

        try {
            await clearSessions();
        } catch (err) {
            debug(err);
        }
        debug("Cache and StorageData cleared, now quitting...");
        app.quit();
    }

    app.on("will-quit", willQuitCallback);
}

export async function clearSession(sess: Electron.Session, str: string): Promise<void> {

    const prom1 = sess.clearCache();

    const prom2 = sess.clearStorageData({
        origin: "*",
        quotas: [
            "temporary",
            "persistent",
            "syncable",
        ],
        storages: [
            "appcache",
            // "cookies",
            // "filesystem",
            // "indexdb",
            // "localstorage", BLOCKS!?
            // "shadercache",
            // "websql",
            "serviceworkers",
        ],
    });

    try {
        const results = await promiseAllSettled<void>([prom1, prom2]);
        for (const result of results) {
            debug(`SESSION CACHE + STORAGE DATA CLEARED - ${str} => ${result.status}`);
        }
    } catch (err) {
        debug(err);
    }

    return Promise.resolve();
}

export function getWebViewSession() {
    return session.fromPartition(R2_SESSION_WEBVIEW, { cache: true });
}

export async function clearWebviewSession(): Promise<void> {
    const sess = getWebViewSession();
    if (sess) {
        try {
            await clearSession(sess, "[" + R2_SESSION_WEBVIEW + "]");
        } catch (err) {
            debug(err);
        }
    }

    return Promise.resolve();
}

export async function clearDefaultSession(): Promise<void> {
    if (session.defaultSession) {
        try {
            await clearSession(session.defaultSession, "[default]");
        } catch (err) {
            debug(err);
        }
    }

    return Promise.resolve();
}

export async function clearSessions(): Promise<void> {
    try {
        await promiseAllSettled([clearDefaultSession(), clearWebviewSession()]);
    } catch (err) {
        debug(err);
    }

    return Promise.resolve();
}
