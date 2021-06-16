// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { Publication } from "@r2-shared-js/models/publication";
import { Link } from "@r2-shared-js/models/publication-link";

import {
    IEventPayload_R2_EVENT_CLIPBOARD_COPY, IEventPayload_R2_EVENT_READING_LOCATION,
    IEventPayload_R2_EVENT_READIUMCSS,
} from "../../common/events";
import { WebViewSlotEnum } from "../../common/styles";
import { IStringMap } from "../common/querystring";

export interface IReadiumElectronWebviewWindowState {
    // init'ed from  win.location.search immediately in preload.js
    // updated in R2_EVENT_SCROLLTO IPC renderer event
    urlQueryParams: IStringMap | undefined;

    hashElement: Element | null;
    locationHashOverride: Element | undefined;
    locationHashOverrideInfo: IEventPayload_R2_EVENT_READING_LOCATION | undefined;

    isAudio: boolean;

    isFixedLayout: boolean;
    fxlViewportWidth: number;
    fxlViewportHeight: number;
    fxlViewportScale: number;
    webViewSlot: WebViewSlotEnum;

    DEBUG_VISUALS: boolean;

    ttsSentenceDetectionEnabled: boolean;
    ttsClickEnabled: boolean;
    ttsOverlayEnabled: boolean;
    ttsPlaybackRate: number;
    ttsVoice: SpeechSynthesisVoice | null;

    isClipboardIntercept: boolean;
}
export interface IReadiumElectronWebviewWindow extends Window {
    READIUM2: IReadiumElectronWebviewWindowState;
}

export interface IReadiumElectronWebviewState {
    id: number;
    link: Link | undefined;
    forceRefresh?: boolean;

    readiumCss: IEventPayload_R2_EVENT_READIUMCSS | undefined;
}
export interface IReadiumElectronWebview extends Electron.WebviewTag {
    READIUM2: IReadiumElectronWebviewState;
}

export interface IReadiumElectronBrowserWindowState {
    publication: Publication;
    publicationURL: string;

    sessionInfo: string | undefined;

    domRootElement: HTMLElement;
    domSlidingViewport: HTMLElement;

    DEBUG_VISUALS: boolean;

    ttsSentenceDetectionEnabled: boolean;
    ttsClickEnabled: boolean;
    ttsOverlayEnabled: boolean;
    ttsPlaybackRate: number;
    ttsVoice: SpeechSynthesisVoice | null;

    clipboardInterceptor: ((data: IEventPayload_R2_EVENT_CLIPBOARD_COPY) => void) | undefined;

    preloadScriptPath: string;

    getFirstWebView: () => IReadiumElectronWebview | undefined;
    destroyFirstWebView: () => void;
    createFirstWebView: () => void;

    getSecondWebView: (create: boolean) => IReadiumElectronWebview | undefined;
    destroySecondWebView: () => void;
    createSecondWebView: () => void;

    getFirstOrSecondWebView: () => IReadiumElectronWebview | undefined;

    getActiveWebViews: () => IReadiumElectronWebview[];

    enableScreenReaderAccessibilityWebViewHardRefresh: boolean;
    isScreenReaderMounted: boolean;
}

export interface IWithReadiumElectronBrowserWindowState {
    READIUM2: IReadiumElectronBrowserWindowState;
}
export type TWindow = typeof window;
export type IReadiumElectronBrowserWindow = TWindow & IWithReadiumElectronBrowserWindowState;
