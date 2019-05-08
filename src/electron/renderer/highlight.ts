// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import {
    IEventPayload_R2_EVENT_HIGHLIGHT_CLICK,
    IEventPayload_R2_EVENT_HIGHLIGHT_CREATE,
    IEventPayload_R2_EVENT_HIGHLIGHT_REMOVE,
    R2_EVENT_HIGHLIGHT_CLICK,
    R2_EVENT_HIGHLIGHT_CREATE,
    R2_EVENT_HIGHLIGHT_REMOVE,
    R2_EVENT_HIGHLIGHT_REMOVE_ALL,
} from "../common/events";
import { IHighlight, IHighlightDefinition } from "../common/highlight";
import { IReadiumElectronBrowserWindow, IReadiumElectronWebview } from "./webview/state";

// import * as debug_ from "debug";
// const debug = debug_("r2:navigator#electron/renderer/index");
// const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

export function highlightsHandleIpcMessage(
    eventChannel: string,
    eventArgs: any[],
    eventCurrentTarget: IReadiumElectronWebview): boolean {

    if (eventChannel === R2_EVENT_HIGHLIGHT_CLICK) {
        // (window as IReadiumElectronBrowserWindow).READIUM2.getActiveWebView();
        const activeWebView = eventCurrentTarget;
        // if (!activeWebView) {
        //     return false;
        // }
        const payload = eventArgs[0] as IEventPayload_R2_EVENT_HIGHLIGHT_CLICK;
        if (_highlightsClickListener && activeWebView.READIUM2.link) {
            _highlightsClickListener(activeWebView.READIUM2.link.Href, payload.highlight);
        }
        return true;
    } else if (eventChannel === R2_EVENT_HIGHLIGHT_CREATE) {
        return true;
    } else {
        return false;
    }
}

let _highlightsClickListener: ((href: string, highlight: IHighlight) => void) | undefined;
export function highlightsClickListen(highlightsClickListener: (href: string, highlight: IHighlight) => void) {
    _highlightsClickListener = highlightsClickListener;
}
export function highlightsRemoveAll(href: string) {
    const activeWebView = (window as IReadiumElectronBrowserWindow).READIUM2.getActiveWebView();
    if (activeWebView && activeWebView.READIUM2.link && activeWebView.READIUM2.link.Href === href) {
        activeWebView.send(R2_EVENT_HIGHLIGHT_REMOVE_ALL);
    }
}
export function highlightsRemove(href: string, highlightIDs: string[]) {
    const activeWebView = (window as IReadiumElectronBrowserWindow).READIUM2.getActiveWebView();
    if (activeWebView && activeWebView.READIUM2.link && activeWebView.READIUM2.link.Href === href) {
        const payload: IEventPayload_R2_EVENT_HIGHLIGHT_REMOVE = {
            highlightIDs,
        };
        activeWebView.send(R2_EVENT_HIGHLIGHT_REMOVE, payload);
    }
}
export async function highlightsCreate(
    href: string,
    highlightDefinitions: IHighlightDefinition[] | undefined):
    Promise<Array<IHighlight | null>> {
    return new Promise<Array<IHighlight | null>>((resolve, reject) => {

        const activeWebView = (window as IReadiumElectronBrowserWindow).READIUM2.getActiveWebView();
        if (!activeWebView) {
            reject("No navigator webview?!");
            return;
        }
        if (!activeWebView.READIUM2.link) {
            reject("No navigator webview link?!");
            return;
        }
        if (activeWebView.READIUM2.link.Href !== href) {
            reject("Navigator webview link no match?!");
            return;
        }

        const cb = (event: Electron.IpcMessageEvent) => {
            if (event.channel === R2_EVENT_HIGHLIGHT_CREATE) {
                const webview = event.currentTarget as IReadiumElectronWebview;
                if (webview !== activeWebView) {
                    reject("Wrong navigator webview?!");
                    return;
                }
                const payloadPong = event.args[0] as IEventPayload_R2_EVENT_HIGHLIGHT_CREATE;
                activeWebView.removeEventListener("ipc-message", cb);
                if (!payloadPong.highlights) { // includes undefined and empty array
                    reject("highlightCreate fail?!");
                } else {
                    resolve(payloadPong.highlights);
                }
            }
        };
        activeWebView.addEventListener("ipc-message", cb);
        const payloadPing: IEventPayload_R2_EVENT_HIGHLIGHT_CREATE = {
            highlightDefinitions,
            highlights: undefined,
        };
        activeWebView.send(R2_EVENT_HIGHLIGHT_CREATE, payloadPing);
    });
}
