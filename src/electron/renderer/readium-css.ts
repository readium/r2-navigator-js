// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { Link } from "@r2-shared-js/models/publication-link";

import { IEventPayload_R2_EVENT_READIUMCSS } from "../common/events";
import { IReadiumElectronBrowserWindow } from "./webview/state";

export function isRTL(/* link: Link | undefined */): boolean {
    // if (link && link.Properties) {
    //     if (link.Properties.Direction === "rtl") {
    //         return true;
    //     }
    //     if (typeof link.Properties.Direction !== "undefined") {
    //         return false;
    //     }
    // }

    const publication = (window as IReadiumElectronBrowserWindow).READIUM2.publication;

    if (publication &&
        publication.Metadata &&
        publication.Metadata.Direction) {
        return publication.Metadata.Direction.toLowerCase() === "rtl"; //  any other value is LTR
    }
    return false;
}

export function isFixedLayout(link: Link | undefined): boolean {
    if (link && link.Properties) {
        if (link.Properties.Layout === "fixed") {
            return true;
        }
        if (typeof link.Properties.Layout !== "undefined") {
            return false;
        }
    }

    const publication = (window as IReadiumElectronBrowserWindow).READIUM2.publication;

    if (publication &&
        publication.Metadata &&
        publication.Metadata.Rendition) {
        return publication.Metadata.Rendition.Layout === "fixed";
    }
    return false;
}

export function __computeReadiumCssJsonMessage(link: Link | undefined): IEventPayload_R2_EVENT_READIUMCSS {

    if (isFixedLayout(link)) {
        const activeWebView = (window as IReadiumElectronBrowserWindow).READIUM2.getActiveWebView();
        return {
            fixedLayoutWebViewHeight: activeWebView ? activeWebView.clientHeight : undefined,
            fixedLayoutWebViewWidth: activeWebView ? activeWebView.clientWidth : undefined,
            isFixedLayout: true,
            setCSS: undefined,
        };
    }

    if (!_computeReadiumCssJsonMessage) {
        return { setCSS: undefined, isFixedLayout: false };
    }

    const readiumCssJsonMessage = _computeReadiumCssJsonMessage();
    return readiumCssJsonMessage;
}
let _computeReadiumCssJsonMessage: () => IEventPayload_R2_EVENT_READIUMCSS = () => {
    return { setCSS: undefined, isFixedLayout: false };
};
export function setReadiumCssJsonGetter(func: () => IEventPayload_R2_EVENT_READIUMCSS) {
    _computeReadiumCssJsonMessage = func;
}
