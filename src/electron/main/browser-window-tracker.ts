// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debug_ from "debug";
import { BrowserWindow, Menu, app, ipcMain, webContents } from "electron";

import { CONTEXT_MENU_SETUP } from "../common/context-menu";
import { IEventPayload_R2_EVENT_LINK, R2_EVENT_LINK } from "../common/events";
import { READIUM2_ELECTRON_HTTP_PROTOCOL } from "../common/sessions";

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

app.on("accessibility-support-changed", (_ev, accessibilitySupportEnabled: boolean) => {

    debug("accessibility-support-changed ... ", accessibilitySupportEnabled);
    if (app.accessibilitySupportEnabled !== accessibilitySupportEnabled) {
        debug("!!?? app.accessibilitySupportEnabled !== accessibilitySupportEnabled");
    }

    if (!_electronBrowserWindows || !_electronBrowserWindows.length) {
        return;
    }
    _electronBrowserWindows.forEach((win) => {
        if (win.webContents) {
            debug("accessibility-support-changed event to WebViewContents ", accessibilitySupportEnabled);
            win.webContents.send("accessibility-support-changed", accessibilitySupportEnabled);
        }

        // const allWebContents = webContents.getAllWebContents();
        // if (allWebContents && allWebContents.length) {
        //     for (const wc of allWebContents) {
        //         if (!wc.hostWebContents) {
        //             continue;
        //         }
        //         if (wc.hostWebContents.id === win.webContents.id) {
        //             // NOPE
        //         }
        //     }
        // }
    });
});
ipcMain.on("accessibility-support-changed", (ev) => {
    const accessibilitySupportEnabled = app.accessibilitySupportEnabled;
    debug("accessibility-support-changed REQUEST, sending to WebViewContents ", accessibilitySupportEnabled);
    ev.sender.send("accessibility-support-changed", accessibilitySupportEnabled);
});

export const contextMenuSetup = (webContent: Electron.WebContents, webContentID: number) => {

    debug(`MAIN CONTEXT_MENU_SETUP ${webContentID}`);

    // const wc = remote.webContents.fromId(wv.getWebContentsId());
    // const wc = wv.getWebContents();
    const wc = webContents.fromId(webContentID);

    // This is always the case: webContentID is the inner WebView
    // inside the main reader BrowserWindow (webContent === event.sender)
    // if (wc !== webContent) {
    //     debug(`!!!!?? CONTEXT_MENU_SETUP __ wc ${wc.id} !== webContent ${webContentID}`);
    // }
    wc.on("context-menu", (_ev, params) => {
        const { x, y } = params;
        debug(`MAIN context-menu EVENT on WebView`);

        const win = BrowserWindow.fromWebContents(webContent) || undefined;

        const openDevToolsAndInspect = () => {
            const devToolsOpened = () => {
                wc.off("devtools-opened", devToolsOpened);
                wc.inspectElement(x, y);

                setTimeout(() => {
                    if (wc.devToolsWebContents && wc.isDevToolsOpened()) {
                        wc.devToolsWebContents.focus();
                    }
                }, 500);
            };
            wc.on("devtools-opened", devToolsOpened);
            wc.openDevTools({ activate: true, mode: "detach" });
        };
        Menu.buildFromTemplate([{
            click: () => {
                const wasOpened = wc.isDevToolsOpened();
                if (!wasOpened) {
                    openDevToolsAndInspect();
                } else {
                    if (!wc.isDevToolsFocused()) {
                        // wc.toggleDevTools();
                        wc.closeDevTools();

                        setImmediate(() => {
                            openDevToolsAndInspect();
                        });
                    } else {
                        // right-click context menu normally occurs when focus
                        // is in BrowserWindow / WebView's WebContents,
                        // but some platforms (e.g. MacOS) allow mouse interaction
                        // when the window is in the background.
                        wc.inspectElement(x, y);
                    }
                }
            },
            label: "Inspect element",
        }]).popup({window: win});
    });
};
ipcMain.on(CONTEXT_MENU_SETUP, (event, webContentID: number) => {
    contextMenuSetup(event.sender, webContentID);
});

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
        // webPreferences.enableRemoteModule = false;

        // TODO: prevent loading remote publications?
        // const fail = !params.src.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL) &&
        //     (_serverURL ? !params.src.startsWith(_serverURL) :
        //         !(/^https?:\/\/127\.0\.0\.1/.test(params.src))
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

                // Note that event.stopPropagation() and event.url
                // only exists on WebView `will-navigate` event,
                // but not WebContents! However the WebView event.preventDefault() does NOT prevent link loading!
                // https://www.electronjs.org/docs/api/webview-tag#event-will-navigate
                // vs.:
                // https://www.electronjs.org/docs/api/web-contents#event-will-navigate
                // TODO: see if we can intercept `will-navigate` in the renderer process
                // directly where WebView elements are created. Perhaps the infinite loop problem
                // (see below) does not occur in this alternative context.

                // unfortunately 'will-navigate' enters an infinite loop with HTML <base href="HTTP_URL" /> ! :(
                // so we check for the no-HTTP streamer scheme/custom protocol
                // (which doesn't transform the HTML base URL)
                if (!url ||
                    (!url.startsWith("thoriumhttps") &&
                    !url.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL))) {

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
