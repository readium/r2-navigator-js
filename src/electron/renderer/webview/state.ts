// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { Publication } from "@r2-shared-js/models/publication";
import { Link } from "@r2-shared-js/models/publication-link";

import {
    IEventPayload_R2_EVENT_READING_LOCATION,
} from "../../common/events";
import { IStringMap } from "../common/querystring";

export interface IElectronWebviewTagWindowState {
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
}
export interface IElectronWebviewTagWindow extends Window {
    READIUM2: IElectronWebviewTagWindowState;
}

export interface IElectronWebviewTagState {
    id: number;
    link: Link | undefined;
}
export interface IElectronWebviewTag extends Electron.WebviewTag {
    READIUM2: IElectronWebviewTagState;
}

export interface IElectronBrowserWindowState {
    publication: Publication;
    publicationURL: string;

    DEBUG_VISUALS: boolean;
    ttsClickEnabled: boolean;
}
export interface IElectronBrowserWindow extends Window {
    READIUM2: IElectronBrowserWindowState;
}
