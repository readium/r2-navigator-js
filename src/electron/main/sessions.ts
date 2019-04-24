// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debug_ from "debug";
import { CertificateVerifyProcRequest, app, protocol, session } from "electron";

import { Server } from "@r2-streamer-js/http/server";

import {
    R2_SESSION_WEBVIEW,
    READIUM2_ELECTRON_HTTP_PROTOCOL,
    convertCustomSchemeToHttpUrl,
} from "../common/sessions";

const debug = debug_("r2:navigator#electron/main/sessions");

export function secureSessions(server: Server) {

    const filter = { urls: ["*", "*://*/*"] };

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
        request: CertificateVerifyProcRequest,
        callback: (verificationResult: number) => void) => {
        // debug("setCertificateVerifyProc");
        // debug(request);

        if (server.isSecured()) {
            const info = server.serverInfo();
            if (info) {
                // debug(info);
                if (request.hostname === info.urlHost) {
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
        // debug(error);
        // debug(certificate);

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

const httpProtocolHandler = (
    request: Electron.RegisterHttpProtocolRequest,
    callback: (redirectRequest: Electron.RedirectRequest) => void) => {

    // debug("httpProtocolHandler:");
    // debug(request.url);
    // debug(request.referrer);
    // debug(request.method);

    const url = convertCustomSchemeToHttpUrl(request.url);

    callback({
        method: request.method,
        // referrer: request.referrer,
        // session: getWebViewSession() session.defaultSession
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

    app.on("ready", () => {
        debug("app ready");

        clearSessions(undefined, undefined);

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
            session.defaultSession.protocol.registerHttpProtocol(
                READIUM2_ELECTRON_HTTP_PROTOCOL,
                httpProtocolHandler,
                (error: Error) => {
                    if (error) {
                        debug(error);
                    } else {
                        debug("registerHttpProtocol OKAY (default session)");
                    }
                });
        }
        const webViewSession = getWebViewSession();
        if (webViewSession) {
            webViewSession.protocol.registerHttpProtocol(
                READIUM2_ELECTRON_HTTP_PROTOCOL,
                httpProtocolHandler,
                (error: Error) => {
                    if (error) {
                        debug(error);
                    } else {
                        debug("registerHttpProtocol OKAY (webview session)");
                    }
                });

            webViewSession.setPermissionRequestHandler((wc, permission, callback) => {
                debug("setPermissionRequestHandler");
                debug(wc.getURL());
                debug(permission);
                callback(true);
            });
        }
    });

    function willQuitCallback(evt: Electron.Event) {
        debug("app will quit");

        app.removeListener("will-quit", willQuitCallback);

        let done = false;

        setTimeout(() => {
            if (done) {
                return;
            }
            done = true;
            debug("Cache and StorageData clearance waited enough => force quitting...");
            app.quit();
        }, 6000);

        let sessionCleared = 0;
        const callback = () => {
            sessionCleared++;
            if (sessionCleared >= 2) {
                if (done) {
                    return;
                }
                done = true;
                debug("Cache and StorageData cleared, now quitting...");
                app.quit();
            }
        };
        clearSessions(callback, callback);

        evt.preventDefault();
    }

    app.on("will-quit", willQuitCallback);
}

export function clearSession(
    sess: Electron.Session,
    str: string,
    callbackCache: (() => void) | undefined,
    callbackStorageData: (() => void) | undefined) {

    sess.clearCache(() => {
        debug("SESSION CACHE CLEARED - " + str);
        if (callbackCache) {
            callbackCache();
        }
    });

    // TODO: this does not seem to work (localStorage not wiped!)
    sess.clearStorageData({
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
            // "localstorage",
            // "shadercache",
            // "websql",
            "serviceworkers",
        ],
    }, () => {
        debug("SESSION STORAGE DATA CLEARED - " + str);
        if (callbackStorageData) {
            callbackStorageData();
        }
    });
}

export function getWebViewSession() {
    return session.fromPartition(R2_SESSION_WEBVIEW, { cache: true });
}

export function clearWebviewSession(
    callbackCache: (() => void) | undefined,
    callbackStorageData: (() => void) | undefined) {

    const sess = getWebViewSession();
    if (sess) {
        clearSession(sess, "[" + R2_SESSION_WEBVIEW + "]", callbackCache, callbackStorageData);
    } else {
        if (callbackCache) {
            callbackCache();
        }
        if (callbackStorageData) {
            callbackStorageData();
        }
    }
}

export function clearDefaultSession(
    callbackCache: (() => void) | undefined,
    callbackStorageData: (() => void) | undefined) {

    if (session.defaultSession) {
        clearSession(session.defaultSession, "[default]", callbackCache, callbackStorageData);
    } else {
        if (callbackCache) {
            callbackCache();
        }
        if (callbackStorageData) {
            callbackStorageData();
        }
    }
}

export function clearSessions(
    callbackCache: (() => void) | undefined,
    callbackStorageData: (() => void) | undefined) {

    let done = false;

    setTimeout(() => {
        if (done) {
            return;
        }
        done = true;
        debug("Cache and StorageData clearance waited enough (default session) => force webview session...");
        clearWebviewSession(callbackCache, callbackStorageData);
    }, 6000);

    let sessionCleared = 0;
    const callback = () => {
        sessionCleared++;
        if (sessionCleared >= 2) {
            if (done) {
                return;
            }
            done = true;
            debug("Cache and StorageData cleared (default session), now webview session...");
            clearWebviewSession(callbackCache, callbackStorageData);
        }
    };
    clearDefaultSession(callback, callback);
}
