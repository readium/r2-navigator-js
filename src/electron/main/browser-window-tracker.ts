// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debug_ from "debug";
import { app } from "electron";

import { IEventPayload_R2_EVENT_LINK, R2_EVENT_LINK } from "../common/events";

// import { READIUM2_ELECTRON_HTTP_PROTOCOL } from "../common/sessions";

const debug = debug_("r2:navigator#electron/main/browser-window-tracker");

let _electronBrowserWindows: Electron.BrowserWindow[];

// let _serverURL: string | undefined;

export function trackBrowserWindow(win: Electron.BrowserWindow, _serverURL?: string) {

    // _serverURL = serverURL;

    if (!_electronBrowserWindows) {
        _electronBrowserWindows = [];
    }
    _electronBrowserWindows.push(win);

    win.on("closed", () => {
        const i = _electronBrowserWindows.indexOf(win);
        if (i < 0) {
            return;
        }
        _electronBrowserWindows.splice(i, 1);
    });
}

// https://github.com/electron/electron/blob/master/docs/tutorial/security.md#how-9
app.on("web-contents-created", (_evt, wc) => {
    wc.on("will-attach-webview", (_event, webPreferences, params) => {
        debug("WEBVIEW will-attach-webview");
        if (params.src && !params.src.startsWith("data:")) {
            debug(params.src);
        }

        // delete webPreferences.preload;
        // delete webPreferences.preloadURL;

        webPreferences.contextIsolation = false;
        webPreferences.javascript = true;
        webPreferences.webSecurity = true;
        webPreferences.nodeIntegration = false;
        webPreferences.nodeIntegrationInWorker = false;
        webPreferences.allowRunningInsecureContent = false;

        // works in Electron v3 because webPreferences is any instead of WebPreferences
        webPreferences.enableRemoteModule = false;

        // TODO: prevent loading remote publications?
        // const fail = !params.src.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL) &&
        //     (_serverURL ? !params.src.startsWith(_serverURL) :
        //         !(/^http[s]?:\/\/127\.0\.0\.1/.test(params.src))
        //         // (!params.src.startsWith("https://127.0.0.1") && !params.src.startsWith("http://127.0.0.1"))
        //         );

        // if (fail) {
        //     debug("WEBVIEW will-attach-webview FAIL: " + params.src);
        //     event.preventDefault();
        // }
    });

    if (!wc.hostWebContents) {
        return;
    }

    if (!_electronBrowserWindows || !_electronBrowserWindows.length) {
        return;
    }
    _electronBrowserWindows.forEach((win) => {
        if (wc.hostWebContents.id === win.webContents.id) {
            debug("WEBVIEW web-contents-created");

            wc.on("will-navigate", (event, url) => {
                debug("webview.getWebContents().on('will-navigate'");
                debug(url);
                event.preventDefault();

                // unfortunately 'will-navigate' enters an infinite loop with HTML <base href="HTTP_URL" /> ! :(
                if (event) { // THIS IS ALWAYS TRUE!
                    debug("'will-navigate' SKIPPED.");
                    return;
                }

                const payload: IEventPayload_R2_EVENT_LINK = {
                    url,
                };
                // ipcMain.emit
                win.webContents.send(R2_EVENT_LINK, payload);
            });
        }
    });
});
