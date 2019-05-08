// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

import { Locator } from "@r2-shared-js/models/locator";
import { Publication } from "@r2-shared-js/models/publication";
import { debounce } from "debounce";
import * as debug_ from "debug";

import {
    IEventPayload_R2_EVENT_DEBUG_VISUALS,
    R2_EVENT_DEBUG_VISUALS,
    R2_EVENT_READIUMCSS,
} from "../common/events";
import {
    R2_SESSION_WEBVIEW,
} from "../common/sessions";
import {
    URL_PARAM_DEBUG_VISUALS,
} from "./common/url-params";
import { highlightsHandleIpcMessage } from "./highlight";
import { getCurrentReadingLocation, handleLinkLocator, locationHandleIpcMessage, shiftWebview } from "./location";
import { __computeReadiumCssJsonMessage } from "./readium-css";
import { ttsClickEnable, ttsHandleIpcMessage } from "./tts";
import { IReadiumElectronBrowserWindow, IReadiumElectronWebview } from "./webview/state";

// import { registerProtocol } from "@r2-navigator-js/electron/renderer/common/protocol";
// registerProtocol();

const ENABLE_WEBVIEW_RESIZE = true;

// const CLASS_POS_RIGHT = "r2_posRight";
// const CLASS_SHIFT_LEFT = "r2_shiftedLeft";
// const CLASS_ANIMATED = "r2_animated";

const ELEMENT_ID_SLIDING_VIEWPORT = "r2_navigator_sliding_viewport";

const debug = debug_("r2:navigator#electron/renderer/index");

// const queryParams = getURLQueryParams();

// // tslint:disable-next-line:no-string-literal
// const publicationJsonUrl = queryParams["pub"];
// debug(publicationJsonUrl);
// const publicationJsonUrl_ = publicationJsonUrl.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL) ?
//     convertCustomSchemeToHttpUrl(publicationJsonUrl) : publicationJsonUrl;
// debug(publicationJsonUrl_);
// const pathBase64 = publicationJsonUrl_.replace(/.*\/pub\/(.*)\/manifest.json/, "$1");
// debug(pathBase64);
// const pathDecoded = new Buffer(decodeURIComponent(pathBase64), "base64").toString("utf8");
// debug(pathDecoded);
// const pathFileName = pathDecoded.substr(
//     pathDecoded.replace(/\\/g, "/").lastIndexOf("/") + 1,
//     pathDecoded.length - 1);
// debug(pathFileName);

// // tslint:disable-next-line:no-string-literal
// const lcpHint = queryParams["lcpHint"];

export function readiumCssOnOff() {

    const loc = getCurrentReadingLocation();

    const activeWebView = (window as IReadiumElectronBrowserWindow).READIUM2.getActiveWebView();
    if (activeWebView) {
        const payload1 = __computeReadiumCssJsonMessage(activeWebView.READIUM2.link);

        if (activeWebView.style.transform !== "none") {
            activeWebView.send("R2_EVENT_HIDE");

            setTimeout(() => {
                shiftWebview(activeWebView, 0, undefined); // reset
                activeWebView.send(R2_EVENT_READIUMCSS, payload1);
            }, 10);
        } else {
            activeWebView.send(R2_EVENT_READIUMCSS, payload1);
        }
    }

    if (loc) {
        setTimeout(() => {
            handleLinkLocator(loc.locator);
        }, 60);
    }
}

let _webview1: IReadiumElectronWebview;

export function installNavigatorDOM(
    publication: Publication,
    publicationURL: string,
    rootHtmlElementID: string,
    preloadScriptPath: string,
    location: Locator | undefined) {

    const domRootElement = document.getElementById(rootHtmlElementID) as HTMLElement;
    if (!domRootElement) {
        debug("!rootHtmlElementID ???");
        return;
    }

    const domSlidingViewport = document.createElement("div");
    domSlidingViewport.setAttribute("id", ELEMENT_ID_SLIDING_VIEWPORT);
    domSlidingViewport.setAttribute("style", "display: block; position: absolute; left: 0; width: 200%; " +
        "top: 0; bottom: 0; margin: 0; padding: 0; box-sizing: border-box; background: white; overflow: hidden;");

    (window as IReadiumElectronBrowserWindow).READIUM2 = {
        DEBUG_VISUALS: false,
        domRootElement,
        domSlidingViewport,
        getActiveWebView: (): IReadiumElectronWebview => {
            return _webview1;

            // let activeWebView: IReadiumElectronWebview;

            // const slidingViewport = document.getElementById(ELEMENT_ID_SLIDING_VIEWPORT) as HTMLElement;
            // if (slidingViewport.classList.contains(CLASS_SHIFT_LEFT)) {
            //     if (_webview1.classList.contains(CLASS_POS_RIGHT)) {
            //         activeWebView = _webview1;
            //     } else {
            //         activeWebView = _webview2;
            //     }
            // } else {
            //     if (_webview2.classList.contains(CLASS_POS_RIGHT)) {
            //         activeWebView = _webview1;
            //     } else {
            //         activeWebView = _webview2;
            //     }
            // }

            // return activeWebView;
        },
        publication,
        publicationURL,
        ttsClickEnabled: false,
    };

    if (IS_DEV) {
        debug("||||||++||||| installNavigatorDOM: ", JSON.stringify(location));

        const debugVisualz = (window.localStorage &&
            window.localStorage.getItem(URL_PARAM_DEBUG_VISUALS) === "true") ? true : false;
        debug("debugVisuals GET: ", debugVisualz);

        (window as IReadiumElectronBrowserWindow).READIUM2.DEBUG_VISUALS = debugVisualz;

        (window as any).READIUM2.debug = (debugVisuals: boolean) => {
            debug("debugVisuals SET: ", debugVisuals);
            (window as IReadiumElectronBrowserWindow).READIUM2.DEBUG_VISUALS = debugVisuals;

            const activeWebView = (window as IReadiumElectronBrowserWindow).READIUM2.getActiveWebView();
            if (activeWebView) {
                const payload: IEventPayload_R2_EVENT_DEBUG_VISUALS
                    = { debugVisuals };
                activeWebView.send(R2_EVENT_DEBUG_VISUALS, payload);
            }
            if (window.localStorage) {
                window.localStorage.setItem(URL_PARAM_DEBUG_VISUALS, debugVisuals ? "true" : "false");
            }
            setTimeout(() => {
                const loc = getCurrentReadingLocation();
                if (loc) {
                    handleLinkLocator(loc.locator);
                }
            }, 100);
        };

        (window as any).READIUM2.debugItems =
            (cssSelector: string, cssClass: string, cssStyles: string | undefined) => {

                if (cssStyles) {
                    debug("debugVisuals ITEMS: ", `${cssSelector} --- ${cssClass} --- ${cssStyles}`);
                }

                const activeWebView = (window as IReadiumElectronBrowserWindow).READIUM2.getActiveWebView();
                // let delay = 0;
                // if (!(window as IReadiumElectronBrowserWindow).READIUM2.DEBUG_VISUALS) {
                //     (window as any).READIUM2.debug(true);
                //     delay = 200;
                // }
                // setTimeout(() => {
                //     if (activeWebView) {
                //         const payload: IEventPayload_R2_EVENT_DEBUG_VISUALS
                //             = { debugVisuals: true, cssSelector, cssClass, cssStyles };
                //         activeWebView.send(R2_EVENT_DEBUG_VISUALS, payload);
                //     }
                // }, delay);

                if (activeWebView) {
                    const d = (window as IReadiumElectronBrowserWindow).READIUM2.DEBUG_VISUALS;
                    const payload: IEventPayload_R2_EVENT_DEBUG_VISUALS
                        = { debugVisuals: d, cssSelector, cssClass, cssStyles };
                    activeWebView.send(R2_EVENT_DEBUG_VISUALS, payload);
                }
            };
    }

    _webview1 = createWebView(preloadScriptPath);
    _webview1.READIUM2 = {
        id: 1,
        link: undefined,
    };
    _webview1.setAttribute("id", "webview1");

    domSlidingViewport.appendChild(_webview1 as Node);
    // slidingViewport.appendChild(_webview2 as Node);

    domRootElement.appendChild(domSlidingViewport);

    // if (isRTL()) {
    //     _webview1.classList.add(CLASS_POS_RIGHT);
    //     _webview1.style.left = "50%";
    // }
    // else {
    //     _webview2.classList.add(CLASS_POS_RIGHT);
    //     _webview2.style.left = "50%";
    // }

    setTimeout(() => {
        handleLinkLocator(location);
    }, 100);
}

function createWebView(preloadScriptPath: string): IReadiumElectronWebview {

    // Unfortunately the Chromium web inspector crashes when closing preload :(
    // Also, the debugger fails to open the sourcemaps (maybe related issue?)
    // process.stderr.write("\n####\n" + preloadScriptPath + "\n####\n");
    // TODO: what are the critical features needed from Node context
    // that justify using webview.preload? Can we instead use regular DOM code?
    // The ReadiumCSS injection is now streamer-based (best performance / timing)
    // and we can use postMessage instead of Electron IPC.
    // Also, preload really does most of its processing once DOM-ready.
    // Perhaps the main problem would be exposing the internal logic of navigator
    // into EPUB content documents? (preload is good for isolating app code)

    const wv = document.createElement("webview");
    // tslint:disable-next-line:max-line-length
    // https://github.com/electron/electron/blob/master/docs/tutorial/security.md#3-enable-context-isolation-for-remote-content
    wv.setAttribute("webpreferences",
        "nodeIntegration=0, nodeIntegrationInWorker=0, sandbox=0, javascript=1, " +
        "contextIsolation=0, webSecurity=1, allowRunningInsecureContent=0");
    wv.setAttribute("partition", R2_SESSION_WEBVIEW);

    const publicationURL_ = (window as IReadiumElectronBrowserWindow).READIUM2.publicationURL;
    if (publicationURL_) {
        // const ref = publicationURL_.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://") ?
        //     publicationURL_ : convertHttpUrlToCustomScheme(publicationURL_);
        wv.setAttribute("httpreferrer", publicationURL_);
    }
    wv.setAttribute("style", "display: flex; margin: 0; padding: 0; box-sizing: border-box; " +
        "position: absolute; left: 0; width: 50%; bottom: 0; top: 0;");
    wv.setAttribute("preload", preloadScriptPath); // "file://"

    // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#webview
    if (ENABLE_WEBVIEW_RESIZE) {
        wv.setAttribute("disableguestresize", "");
    }

    setTimeout(() => {
        wv.removeAttribute("tabindex");
    }, 500);

    wv.addEventListener("dom-ready", () => {
        // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#webcontents
        // wc.openDevTools({ mode: "detach" });
        wv.clearHistory();

        if ((window as IReadiumElectronBrowserWindow).READIUM2) {
            ttsClickEnable((window as IReadiumElectronBrowserWindow).READIUM2.ttsClickEnabled);
        }
    });

    wv.addEventListener("ipc-message", (event: Electron.IpcMessageEvent) => {
        const webview = event.currentTarget as IReadiumElectronWebview;
        const activeWebView = (window as IReadiumElectronBrowserWindow).READIUM2.getActiveWebView();
        if (webview !== activeWebView) {
            return;
        }

        if (!highlightsHandleIpcMessage(event.channel, event.args, webview) &&
        !ttsHandleIpcMessage(event.channel, event.args, webview) &&
        !locationHandleIpcMessage(event.channel, event.args, webview)) {
            debug("webview1 ipc-message");
            debug(event.channel);
        }
    });

    return wv as IReadiumElectronWebview;
}
if (ENABLE_WEBVIEW_RESIZE) {
    // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#webcontents
    // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#webview
    // wv.setAttribute("disableguestresize", "");
    const adjustResize = (webview: IReadiumElectronWebview) => {
        // https://javascript.info/size-and-scroll
        // offsetW/H: excludes margin, includes border, scrollbar, padding.
        // clientW/H: excludes margin, border, scrollbar, includes padding.
        // scrollW/H: like client, but includes hidden (overflow) areas
        const width = webview.clientWidth;
        const height = webview.clientHeight;
        const wc = webview.getWebContents();
        if (wc && (wc as any).setSize && width && height) {
            (wc as any).setSize({ // wc is WebContents, works in Electron < 3.0
                normal: {
                    height,
                    width,
                },
            });
        }
    };
    const onResizeDebounced = debounce(() => {
        const activeWebView = (window as IReadiumElectronBrowserWindow).READIUM2.getActiveWebView();
        if (activeWebView) {
            adjustResize(activeWebView);
        }
    }, 200);
    window.addEventListener("resize", () => {
        // const activeWebView = (window as IReadiumElectronBrowserWindow).READIUM2.getActiveWebView();
        // if (!isFixedLayout(activeWebView.READIUM2.link)) {
        //     if (_rootHtmlElement) {
        //         _rootHtmlElement.dispatchEvent(new Event(DOM_EVENT_HIDE_VIEWPORT));
        //     }
        // }
        onResizeDebounced();
    });
}
