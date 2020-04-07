// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { Locator, LocatorLocations } from "@r2-shared-js/models/locator";

import { IAudioPlaybackInfo } from "./audiobook";
import { IDocInfo } from "./document";
import { IHighlight, IHighlightDefinition } from "./highlight";
import { IPaginationInfo } from "./pagination";
import { IReadiumCSS } from "./readium-css-settings";
import { ISelectionInfo } from "./selection";

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
    fixedLayoutWebViewWidth?: number;
    fixedLayoutWebViewHeight?: number;
    urlRoot?: string;
}

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_DEBUG_VISUALS = "R2_EVENT_DEBUG_VISUALS";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_DEBUG_VISUALS {
    debugVisuals: boolean;

    cssSelector?: string;
    cssClass?: string;
    cssStyles?: string;
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
export interface IEventPayload_R2_EVENT_READING_LOCATION extends Locator {
    audioPlaybackInfo: IAudioPlaybackInfo | undefined;
    paginationInfo: IPaginationInfo | undefined;
    selectionInfo: ISelectionInfo | undefined;
    docInfo: IDocInfo | undefined;
    selectionIsNew: boolean | undefined;

    // not NavDoc epub:type="page-list",
    // but target HTML document's epub:type="pagebreak" / role="doc-pagebreak"
    // (nearest preceding ancestor/sibling)
    epubPage: string | undefined;
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

// in MAIN: browserWindow.webContents.send()
// in RENDERER: ipcRenderer.on()
// in WEBVIEW: ipcRenderer.sendToHost()
// in RENDERER: webview.addEventListener("ipc-message")
export const R2_EVENT_AUDIO_SOUNDTRACK = "R2_EVENT_AUDIO_SOUNDTRACK";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_AUDIO_SOUNDTRACK {
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
export const R2_EVENT_AUDIO_DO_PLAY = "R2_EVENT_AUDIO_DO_PLAY";
export const R2_EVENT_AUDIO_DO_PAUSE = "R2_EVENT_AUDIO_DO_PAUSE";
export const R2_EVENT_AUDIO_TOGGLE_PLAY_PAUSE = "R2_EVENT_AUDIO_TOGGLE_PLAY_PAUSE";
export const R2_EVENT_AUDIO_REWIND = "R2_EVENT_AUDIO_REWIND";
export const R2_EVENT_AUDIO_FORWARD = "R2_EVENT_AUDIO_FORWARD";
// export const R2_EVENT_AUDIO_PLAYBACK_RATE = "R2_EVENT_AUDIO_PLAYBACK_RATE";
// // tslint:disable-next-line:class-name
// export interface IEventPayload_R2_EVENT_AUDIO_PLAYBACK_RATE {
//     speed: number;
// }
// in MAIN: browserWindow.webContents.send()
// in RENDERER: ipcRenderer.on()
// in WEBVIEW: ipcRenderer.sendToHost()
// in RENDERER: webview.addEventListener("ipc-message")
export const R2_EVENT_AUDIO_PLAYBACK_RATE = "R2_EVENT_AUDIO_PLAYBACK_RATE";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_AUDIO_PLAYBACK_RATE {
    speed: number;
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

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_HIGHLIGHT_CREATE = "R2_EVENT_HIGHLIGHT_CREATE";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_HIGHLIGHT_CREATE {
    highlightDefinitions: IHighlightDefinition[] | undefined;
    highlights: Array<IHighlight | null> | undefined; // return value, see below (R2_EVENT_HIGHLIGHT_CREATE_RES)
}
// // in WEBVIEW: ipcRenderer.sendToHost()
// // in RENDERER: webview.addEventListener("ipc-message")
// export const R2_EVENT_HIGHLIGHT_CREATE_RES = "R2_EVENT_HIGHLIGHT_CREATE_RES";
// // tslint:disable-next-line:class-name
// export interface IEventPayload_R2_EVENT_HIGHLIGHT_CREATE_RES {
//     highlightID: string;
// }

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_HIGHLIGHT_REMOVE = "R2_EVENT_HIGHLIGHT_REMOVE";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_HIGHLIGHT_REMOVE {
    highlightIDs: string[];
}

// in RENDERER: webview.send()
// in WEBVIEW: ipcRenderer.on()
export const R2_EVENT_HIGHLIGHT_REMOVE_ALL = "R2_EVENT_HIGHLIGHT_REMOVE_ALL";

// in WEBVIEW: ipcRenderer.sendToHost()
// in RENDERER: webview.addEventListener("ipc-message")
export const R2_EVENT_HIGHLIGHT_CLICK = "R2_EVENT_HIGHLIGHT_CLICK";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_HIGHLIGHT_CLICK {
    highlight: IHighlight;
}

// in WEBVIEW: ipcRenderer.sendToHost()
// in RENDERER: webview.addEventListener("ipc-message")
export const R2_EVENT_WEBVIEW_KEYDOWN = "R2_EVENT_WEBVIEW_KEYDOWN";
export const R2_EVENT_WEBVIEW_KEYUP = "R2_EVENT_WEBVIEW_KEYUP";
export interface IKeyboardEvent {
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;

    code: string;
    key?: string;
}
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_WEBVIEW_KEYDOWN extends IKeyboardEvent {
    elementName: string;
    elementAttributes: {[name: string]: string};
}
export type IEventPayload_R2_EVENT_WEBVIEW_KEYUP = IEventPayload_R2_EVENT_WEBVIEW_KEYDOWN;

// in WEBVIEW: ipcRenderer.sendToHost()
// in RENDERER: webview.addEventListener("ipc-message")
export const R2_EVENT_CLIPBOARD_COPY = "R2_EVENT_CLIPBOARD_COPY";
// tslint:disable-next-line:class-name
export interface IEventPayload_R2_EVENT_CLIPBOARD_COPY { // CliboardEvent
    txt: string;
    locator: IEventPayload_R2_EVENT_READING_LOCATION | undefined;
}
