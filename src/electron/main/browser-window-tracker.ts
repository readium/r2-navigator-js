// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debug_ from "debug";

import { app } from "electron";

import { IEventPayload_R2_EVENT_LINK, R2_EVENT_LINK } from "../common/events";

const debug = debug_("r2:navigator#electron/main/browser-window-tracker");

let _electronBrowserWindows: Electron.BrowserWindow[];

export function trackBrowserWindow(win: Electron.BrowserWindow) {

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

app.on("web-contents-created", (_evt, wc) => {
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

                // debug(event.sender);
                debug(url);

                const wcUrl = event.sender.getURL();
                debug(wcUrl);

                event.preventDefault();

                const payload: IEventPayload_R2_EVENT_LINK = {
                    url,
                };
                // ipcMain.emit
                win.webContents.send(R2_EVENT_LINK, payload);
            });
        }
    });
});
