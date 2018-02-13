import * as crypto from "crypto";
import * as debug_ from "debug";
import { CertificateVerifyProcRequest, app, protocol, session } from "electron";

import { Server } from "@r2-streamer-js/http/server";

import {
    R2_SESSION_WEBVIEW,
    READIUM2_ELECTRON_HTTP_PROTOCOL,
    convertCustomSchemeToHttpUrl,
} from "../common/sessions";

const debug = debug_("r2:navigator#electron/main/sessions");
const debugHttps = debug_("r2:https");

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

export function secureSessions(server: Server) {

    const filter = { urls: ["*", "*://*/*"] };

    const onBeforeSendHeadersCB = (details: any, callback: any) => {
        // debug("onBeforeSendHeaders");
        // debug(details);

        // details.requestHeaders["User-Agent"] = "R2 Electron";

        if (server.isSecured()) {
            const info = server.serverInfo();
            if (info && info.trustKey && info.trustCheck && info.trustCheckIV) {

                // @ts-ignorexx: TS2454 (variable is used before being assigned)
                // instead: exclamation mark "definite assignment"
                let t1!: [number, number];
                if (IS_DEV) {
                    t1 = process.hrtime();
                }

                const encrypteds: Buffer[] = [];
                // encrypteds.push(info.trustCheckIV);
                const encryptStream = crypto.createCipheriv("aes-256-cbc",
                    info.trustKey,
                    info.trustCheckIV);
                encryptStream.setAutoPadding(true);
                // milliseconds since epoch (midnight, 1 Jan 1970)
                const now = Date.now(); // +new Date()
                const jsonStr = `{"url":"${details.url}","time":${now}}`;
                // const jsonBuff = new Buffer(jsonStr, "utf8");
                const buff1 = encryptStream.update(jsonStr, "utf8"); // jsonBuff
                if (buff1) {
                    encrypteds.push(buff1);
                }
                const buff2 = encryptStream.final();
                if (buff2) {
                    encrypteds.push(buff2);
                }
                const encrypted = Buffer.concat(encrypteds);

                const base64 = new Buffer(encrypted).toString("base64");
                details.requestHeaders["X-" + info.trustCheck] = base64;

                if (IS_DEV) {
                    const t2 = process.hrtime(t1);
                    const seconds = t2[0];
                    const nanoseconds = t2[1];
                    const milliseconds = nanoseconds / 1e6;
                    // const totalNanoseconds = (seconds * 1e9) + nanoseconds;
                    // const totalMilliseconds = totalNanoseconds / 1e6;
                    // const totalSeconds = totalNanoseconds / 1e9;

                    debugHttps(`< A > ${seconds}s ${milliseconds}ms [ ${details.url} ]`);
                }
            }
        }
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    };

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
        session.defaultSession.webRequest.onBeforeSendHeaders(filter, onBeforeSendHeadersCB);
        session.defaultSession.setCertificateVerifyProc(setCertificateVerifyProcCB);
    }

    const webViewSession = getWebViewSession();
    if (webViewSession) {
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
    // debug(url);

    callback({
        method: request.method,
        // referrer: request.referrer,
        // session: getWebViewSession() session.defaultSession
        url,
    });
};

export function initSessions() {

    protocol.registerStandardSchemes([READIUM2_ELECTRON_HTTP_PROTOCOL], { secure: true });

    app.on("ready", () => {
        debug("app ready");

        clearSessions(undefined, undefined);
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
            "syncable"],
        storages: [
            "appcache",
            "cookies",
            "filesystem",
            "indexdb",
            "localstorage",
            "shadercache",
            "websql",
            "serviceworkers"],
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
