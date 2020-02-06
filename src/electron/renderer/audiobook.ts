// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { R2_EVENT_AUDIO_DO_PAUSE, R2_EVENT_AUDIO_DO_PLAY } from "../common/events";
import { IReadiumElectronBrowserWindow } from "./webview/state";

const win = window as IReadiumElectronBrowserWindow;

export function audioPlay() {
    const activeWebView = win.READIUM2.getActiveWebView();
    if (!activeWebView) {
        return;
    }

    setTimeout(async () => {
        await activeWebView.send(R2_EVENT_AUDIO_DO_PLAY);
    }, 0);
}

export function audioPause() {
    const activeWebView = win.READIUM2.getActiveWebView();
    if (!activeWebView) {
        return;
    }

    setTimeout(async () => {
        await activeWebView.send(R2_EVENT_AUDIO_DO_PAUSE);
    }, 0);
}
