// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { Link } from "@models/publication-link";
import { IStringMap } from "../common/querystring";

export interface IReadium2State {
    // init'ed from  win.location.search immediately in preload.js
    // updated in R2_EVENT_SCROLLTO IPC renderer event
    urlQueryParams: IStringMap | undefined;

    hashElement: Element | null;
    locationHashOverride: Element | undefined;
    locationHashOverrideCSSselector: string | undefined;
    locationHashOverrideCFI: string | undefined;
    readyPassDone: boolean;
    readyEventSent: boolean;

    isFixedLayout: boolean;
    fxlViewportWidth: number;
    fxlViewportHeight: number;
}

export interface IWebViewState {
    id: number;
    link: Link | undefined;
}

export interface IElectronWebviewTag extends Electron.WebviewTag {
    READIUM2: IWebViewState;
}

export interface IElectronWebviewTagWindow extends Window {
    READIUM2: IReadium2State;
}
