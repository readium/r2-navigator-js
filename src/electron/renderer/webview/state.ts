import { Link } from "@models/publication-link";
import { IStringMap } from "../common/querystring";

export interface IReadium2State {
    // init'ed from  win.location.search immediately in preload.js
    // updated in R2_EVENT_SCROLLTO IPC renderer event
    urlQueryParams: IStringMap | undefined;

    hashElement: Element | null;
    locationHashOverride: Element | undefined;
    locationHashOverrideCSSselector: string | undefined;
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
