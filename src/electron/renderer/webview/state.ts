// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { remote } from "electron";

import { Publication } from "@r2-shared-js/models/publication";
import { Link } from "@r2-shared-js/models/publication-link";

import {
    IEventPayload_R2_EVENT_CLIPBOARD_COPY, IEventPayload_R2_EVENT_READING_LOCATION,
} from "../../common/events";
import { IStringMap } from "../common/querystring";

export interface IReadiumElectronWebviewWindowState {
    // init'ed from  win.location.search immediately in preload.js
    // updated in R2_EVENT_SCROLLTO IPC renderer event
    urlQueryParams: IStringMap | undefined;

    hashElement: Element | null;
    locationHashOverride: Element | undefined;
    locationHashOverrideInfo: IEventPayload_R2_EVENT_READING_LOCATION | undefined;

    isFixedLayout: boolean;
    fxlViewportWidth: number;
    fxlViewportHeight: number;
    fxlViewportScale: number;

    DEBUG_VISUALS: boolean;

    ttsClickEnabled: boolean;

    isClipboardIntercept: boolean;
}
export interface IReadiumElectronWebviewWindow extends Window {
    READIUM2: IReadiumElectronWebviewWindowState;
}

export interface IReadiumElectronWebviewState {
    id: number;
    link: Link | undefined;
    forceRefresh?: boolean;
}
export interface IReadiumElectronWebview extends Electron.WebviewTag {
    READIUM2: IReadiumElectronWebviewState;
}

export interface IReadiumElectronBrowserWindowState {
    publication: Publication;
    publicationURL: string;

    domRootElement: HTMLElement;
    domSlidingViewport: HTMLElement;

    DEBUG_VISUALS: boolean;

    ttsClickEnabled: boolean;

    clipboardInterceptor: (data: IEventPayload_R2_EVENT_CLIPBOARD_COPY) => void;

    preloadScriptPath: string;

    getActiveWebView: () => IReadiumElectronWebview | undefined;
    destroyActiveWebView: () => void;
    createActiveWebView: () => void;

    enableScreenReaderAccessibilityWebViewHardRefresh: boolean;
}

export interface IWithReadiumElectronBrowserWindowState {
    READIUM2: IReadiumElectronBrowserWindowState;
}
export type TWindow = typeof window;
export type IReadiumElectronBrowserWindow = TWindow & IWithReadiumElectronBrowserWindowState;

let _isScreenReaderMounted: boolean | undefined;
export function isScreenReaderMounted() {
    if (typeof _isScreenReaderMounted === "undefined") {
        _isScreenReaderMounted = remote.app.isAccessibilitySupportEnabled();

        // Instead of dynamically updating this state via the app event,
        // the detection of mounted screen reader is done at every launch of a reader window.
        //
        // app.on("accessibility-support-changed", (_ev, accessibilitySupportEnabled) => {
        //     _isScreenReaderMounted = accessibilitySupportEnabled;
        // });
    }
    return _isScreenReaderMounted;
}
