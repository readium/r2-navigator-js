// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_READIUMCSS = "R2_EVENT_READIUMCSS";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_READIUMCSS {
    injectCSS: string;
    setCSS: string | {
        align: string;
        colCount: string;
        dark: boolean;
        font: string;
        fontSize: string;
        invert: boolean;
        lineHeight: string;
        night: boolean;
        paged: boolean;
        sepia: boolean;
    };
    isFixedLayout?: boolean;
    urlRoot?: string;
}

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_SCROLLTO = "R2_EVENT_SCROLLTO";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_SCROLLTO {
    goto: string | undefined;
    hash: string | undefined;
    previous: boolean;
}

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_PAGE_TURN = "R2_EVENT_PAGE_TURN";

// in WEBVIEW: ipcRenderer.sendToHost()
// in RENDERER: webview.addEventListener("ipc-message")
export const R2_EVENT_PAGE_TURN_RES = "R2_EVENT_PAGE_TURN_RES";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_PAGE_TURN {
    direction: string;
    go: string;
}

// in WEBVIEW: ipcRenderer.sendToHost()
// in RENDERER: webview.addEventListener("ipc-message")
export const R2_EVENT_READING_LOCATION = "R2_EVENT_READING_LOCATION";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_READING_LOCATION {
    cssSelector: string;
}

// in MAIN: browserWindow.webContents.send(()
// in RENDERER: ipcRenderer.on()
// in WEBVIEW: ipcRenderer.sendToHost()
// in RENDERER: webview.addEventListener("ipc-message")
export const R2_EVENT_LINK = "R2_EVENT_LINK";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_LINK {
    url: string;
}

// in WEBVIEW: ipcRenderer.sendToHost()
// in RENDERER: webview.addEventListener("ipc-message")
export const R2_EVENT_WEBVIEW_READY = "R2_EVENT_WEBVIEW_READY";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_WEBVIEW_READY {
    href: string;
}
