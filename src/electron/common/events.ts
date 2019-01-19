// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { LocatorLocations } from "@r2-shared-js/models/locator";

import { IReadiumCSS } from "./readium-css-settings";

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
// in WEBVIEW: ipcRenderer.sendToHost()
// in RENDERER: webview.addEventListener("ipc-message")
export const R2_EVENT_LOCATOR_VISIBLE = "R2_EVENT_LOCATOR_VISIBLE";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_LOCATOR_VISIBLE {
    visible: boolean;
    location: LocatorLocations;
}

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_READIUMCSS = "R2_EVENT_READIUMCSS";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_READIUMCSS {
    setCSS: IReadiumCSS | undefined;
    isFixedLayout?: boolean;
    urlRoot?: string;
}

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_DEBUG_VISUALS = "R2_EVENT_DEBUG_VISUALS";

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
export interface IEventPayload_R2_EVENT_READING_LOCATION_PAGINATION_INFO {
    totalColumns: number | undefined;
    currentColumn: number | undefined;
    isTwoPageSpread: boolean | undefined;
    spreadIndex: number | undefined;
}

// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_READING_LOCATION extends LocatorLocations {
    // interface LocatorLocations {
    //     cfi?: string;
    //     cssSelector?: string;
    //     position?: number;
    //     progression?: number;
    // }
    // cfi: string | undefined;
    // cssSelector: string | undefined;
    // progression: number | undefined;
    // position: number | undefined;

    paginationInfo: IEventPayload_R2_EVENT_READING_LOCATION_PAGINATION_INFO | undefined;
}

// in MAIN: browserWindow.webContents.send()
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
export const R2_EVENT_SHIFT_VIEW_X = "R2_EVENT_SHIFT_VIEW_X";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_SHIFT_VIEW_X {
    offset: number;
    backgroundColor: string | undefined;
}

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_TTS_CLICK_ENABLE = "R2_EVENT_TTS_CLICK_ENABLE";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_TTS_CLICK_ENABLE {
    doEnable: boolean;
}

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_TTS_DO_PLAY = "R2_EVENT_TTS_DO_PLAY";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_TTS_DO_PLAY {
    rootElement: string; // CSS selector
    startElement: string | undefined; // CSS selector
}

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_TTS_DO_PAUSE = "R2_EVENT_TTS_DO_PAUSE";

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_TTS_DO_RESUME = "R2_EVENT_TTS_DO_RESUME";

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_TTS_DO_STOP = "R2_EVENT_TTS_DO_STOP";

// in WEBVIEW: ipcRenderer.sendToHost()
// in RENDERER: webview.addEventListener("ipc-message")
export const R2_EVENT_TTS_IS_STOPPED = "R2_EVENT_TTS_IS_STOPPED";

// in WEBVIEW: ipcRenderer.sendToHost()
// in RENDERER: webview.addEventListener("ipc-message")
export const R2_EVENT_TTS_IS_PAUSED = "R2_EVENT_TTS_IS_PAUSED";

// in WEBVIEW: ipcRenderer.sendToHost()
// in RENDERER: webview.addEventListener("ipc-message")
export const R2_EVENT_TTS_IS_PLAYING = "R2_EVENT_TTS_IS_PLAYING";

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_TTS_DO_NEXT = "R2_EVENT_TTS_DO_NEXT";

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_TTS_DO_PREVIOUS = "R2_EVENT_TTS_DO_PREVIOUS";
