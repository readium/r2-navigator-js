// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

import * as debug_ from "debug";
import { ipcRenderer } from "electron";

import { Link } from "@r2-shared-js/models/publication-link";

import { mediaOverlaysInterrupt } from "./media-overlays";
import { Locator } from "../common/locator";
import { Publication } from "@r2-shared-js/models/publication";

import { CONTEXT_MENU_SETUP } from "../common/context-menu";
import {
    IEventPayload_R2_EVENT_CAPTIONS, IEventPayload_R2_EVENT_CLIPBOARD_COPY,
    IEventPayload_R2_EVENT_DEBUG_VISUALS, IEventPayload_R2_EVENT_FXL_CONFIGURE,
    IEventPayload_R2_EVENT_PAGE_TURN, IEventPayload_R2_EVENT_READIUMCSS,
    IEventPayload_R2_EVENT_WEBVIEW_KEYDOWN, IEventPayload_R2_EVENT_WEBVIEW_KEYUP, IKeyboardEvent,
    R2_EVENT_CAPTIONS, R2_EVENT_CLIPBOARD_COPY, R2_EVENT_DEBUG_VISUALS, R2_EVENT_FXL_CONFIGURE,
    R2_EVENT_KEYBOARD_FOCUS_REQUEST, R2_EVENT_MEDIA_OVERLAY_INTERRUPT,
    R2_EVENT_PAGE_TURN_RES, R2_EVENT_READIUMCSS, R2_EVENT_SHOW, R2_EVENT_WEBVIEW_KEYDOWN,
    R2_EVENT_WEBVIEW_KEYUP,
} from "../common/events";
import { READIUM_CSS_URL_PATH } from "../common/readium-css-settings";
import {
    R2_SESSION_WEBVIEW, READIUM2_ELECTRON_HTTP_PROTOCOL, convertCustomSchemeToHttpUrl,
} from "../common/sessions";
import { WebViewSlotEnum } from "../common/styles";
import { URL_PARAM_DEBUG_VISUALS } from "./common/url-params";
import { highlightsHandleIpcMessage } from "./highlight";
import {
    LocatorExtended, getCurrentReadingLocation, handleLinkLocator, locationHandleIpcMessage,
    setWebViewStyle, shiftWebview,
} from "./location";
import { mediaOverlaysHandleIpcMessage } from "./media-overlays";
import {
    checkTtsState, ttsClickEnable, ttsHandleIpcMessage, ttsOverlayEnable, ttsPlaybackRate,
    ttsSentenceDetectionEnable, ttsSkippabilityEnable, ttsVoice,
} from "./readaloud";
import { adjustReadiumCssJsonMessageForFixedLayout, isFixedLayout, obtainReadiumCss } from "./readium-css";
import { soundtrackHandleIpcMessage } from "./soundtrack";
import { ReadiumElectronBrowserWindow, IReadiumElectronWebview } from "./webview/state";

const ELEMENT_ID_SLIDING_VIEWPORT = "r2_navigator_sliding_viewport";
const ELEMENT_ID_CAPTIONS = "r2_navigator_captions_overlay";
const ELEMENT_ID_READIUM_CSS_STYLE = "r2_navigator_readium_css";
/* align-items: center; DOES NOT WORK with overflow-y: scroll; because top clipping */
const captionsOverlayCssStyles = `
    overflow: hidden;
    overflow-y: auto;
    display: flex;
    justify-content: center;
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    box-sizing: border-box;
    border: 0;
    margin: 0;
    padding: 2em;
    line-height: initial;
    user-select: none;
`.replace(/[\r\n]/g, " ").replace(/\s\s+/g, " ").trim();
const captionsOverlayParaCssStyles = `
    margin: 0;
    margin-top: auto;
    margin-bottom: auto;
    padding: 0;
    max-width: 900px;
    font-weight: bolder;
    text-align: center;
`.replace(/[\r\n]/g, " ").replace(/\s\s+/g, " ").trim();
// replace "{RCSS_BASE_URL}"
const readiumCssStyle = `
@font-face {
font-family: AccessibleDfA;
font-style: normal;
font-weight: normal;
src: local("AccessibleDfA"),
url("{RCSS_BASE_URL}fonts/AccessibleDfA.otf") format("opentype");
}

@font-face {
font-family: "IA Writer Duospace";
font-style: normal;
font-weight: normal;
src: local("iAWriterDuospace-Regular"),
url("{RCSS_BASE_URL}fonts/iAWriterDuospace-Regular.ttf") format("truetype");
}
`;

const debug = debug_("r2:navigator#electron/renderer/index");

const win = global.window as ReadiumElectronBrowserWindow;

let _resizeSkip = 0;
let _resizeWebviewsNeedReset = true;
let _resizeTimeout: number | undefined;
// let _resizeFirst = true;
win.addEventListener("resize", () => {
    // Skip non-navigator renderers that import this JS file for installNavigatorDOM() but don't actually use it (e.g. PDF or Divina in Thorium Reader.tsx)
    if (!win.READIUM2) {
        return;
    }

    let atLeastOneFXL = false;
    const actives = win.READIUM2.getActiveWebViews();
    for (const activeWebView of actives) {
        if (isFixedLayout(activeWebView.READIUM2?.link)) {
            atLeastOneFXL = true;
            break;
        }
    }
    // win.READIUM2.publication?.Metadata?.Rendition?.Layout !== "fixed"
    if (!atLeastOneFXL) {
        debug("Window resize (TOP), !FXL SKIP ...");
        return;
    }

    //     debug("Window resize (TOP), SKIP FIRST");
    //     _resizeFirst = false;
    //     return;
    // }
    if (_resizeSkip > 0) {
        debug("Window resize (TOP), SKIP ...", _resizeSkip);
        return;
    }

    if (_resizeWebviewsNeedReset) {
        _resizeWebviewsNeedReset = false;

        debug("Window resize (TOP), IMMEDIATE");
        const activeWebViews = win.READIUM2.getActiveWebViews();
        for (const activeWebView of activeWebViews) {
            const wvSlot = activeWebView.getAttribute("data-wv-slot") as WebViewSlotEnum;
            if (wvSlot) {
                debug("Window resize (TOP), IMMEDIATE ... setWebViewStyle");
                setWebViewStyle(activeWebView, wvSlot);
            }
        }
    }

    if (_resizeTimeout) {
        clearTimeout(_resizeTimeout);
    }
    _resizeTimeout = win.setTimeout(async () => {
        debug("Window resize (TOP), DEFERRED");
        _resizeTimeout = undefined;
        _resizeWebviewsNeedReset = true;
        const activeWebViews = win.READIUM2.getActiveWebViews();
        _resizeSkip = activeWebViews.length;
        for (const activeWebView of activeWebViews) {
            const wvSlot = activeWebView.getAttribute("data-wv-slot") as WebViewSlotEnum;
            if (wvSlot) {
                try {
                    // will trigger R2_EVENT_FXL_CONFIGURE => setWebViewStyle
                    if (activeWebView.READIUM2?.DOMisReady) {
                        await activeWebView.send("R2_EVENT_WINDOW_RESIZE", win.READIUM2.fixedLayoutZoomPercent);
                    }
                } catch (e) {
                    debug(e);
                }
            }
        }

    }, 1000);
});

ipcRenderer.on("accessibility-support-changed", (_e, accessibilitySupportEnabled) => {
    // Skip non-navigator renderers that import this JS file for installNavigatorDOM() but don't actually use it (e.g. PDF or Divina in Thorium Reader.tsx)
    if (!win.READIUM2) {
        return;
    }

    debug("accessibility-support-changed event received in WebView ", accessibilitySupportEnabled);
    win.READIUM2.isScreenReaderMounted = accessibilitySupportEnabled;
});

// const queryParams = getURLQueryParams();

// // tslint:disable-next-line:no-string-literal
// const publicationJsonUrl = queryParams["pub"];
// debug(publicationJsonUrl);
// const publicationJsonUrl_ = publicationJsonUrl.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL) ?
//     convertCustomSchemeToHttpUrl(publicationJsonUrl) : publicationJsonUrl;
// debug(publicationJsonUrl_);
// const pathBase64 = publicationJsonUrl_.replace(/.*\/pub\/(.*)\/manifest.json/, "$1");
// debug(pathBase64);
// const pathDecoded = Buffer.from(decodeURIComponent(pathBase64), "base64").toString("utf8");
// debug(pathDecoded);
// const pathFileName = pathDecoded.substr(
//     pathDecoded.replace(/\\/g, "/").lastIndexOf("/") + 1,
//     pathDecoded.length - 1);
// debug(pathFileName);

// // tslint:disable-next-line:no-string-literal
// const lcpHint = queryParams["lcpHint"];

function readiumCssApplyToWebview(
    loc: LocatorExtended | undefined,
    activeWebView: IReadiumElectronWebview,
    pubLink: Link | undefined,
    rcss?: IEventPayload_R2_EVENT_READIUMCSS) {

    const actualReadiumCss = obtainReadiumCss(rcss);
    activeWebView.READIUM2.readiumCss = actualReadiumCss;

    const payloadRcss = adjustReadiumCssJsonMessageForFixedLayout(activeWebView, pubLink || activeWebView.READIUM2.link, actualReadiumCss);

    if (activeWebView.style.transform &&
        activeWebView.style.transform !== "none" &&
        !activeWebView.hasAttribute("data-wv-fxl")) {

        activeWebView.style.opacity = "0";
        // setTimeout(async () => {
        //    if (activeWebView.READIUM2?.DOMisReady) {}
        //     await activeWebView.send("R2_EVENT_HIDE",
        //         activeWebView.READIUM2.link ? isFixedLayout(activeWebView.READIUM2.link) : null);
        // }, 0);

        setTimeout(async () => {
            shiftWebview(activeWebView, 0, undefined); // reset
            if (activeWebView.READIUM2?.DOMisReady) {
                await activeWebView.send(R2_EVENT_READIUMCSS, payloadRcss);
            }
        }, 10);
    } else {
        setTimeout(async () => {
            if (activeWebView.READIUM2?.DOMisReady) {
                await activeWebView.send(R2_EVENT_READIUMCSS, payloadRcss);
            }
        }, 0);
    }

    if (loc && loc.locator.href === activeWebView.READIUM2.link?.Href) {

        setTimeout(() => {
            debug("readiumCssOnOff -> handleLinkLocator");
            stealFocusDisable(true);
            handleLinkLocator(loc.locator, actualReadiumCss);
            setTimeout(() => {
                stealFocusDisable(false);
            }, 200);
        }, 60);
    }
}

export function stealFocusDisable(doDisable: boolean) {
    if (win.READIUM2) {
        win.READIUM2.stealFocusDisabled = doDisable;
    }
}

const _fixedLayoutZoomPercentTimers: {
    [id: string]: number | undefined;
} = {};
export function fixedLayoutZoomPercent(zoomPercent: number) {
    // READIUM2 object created in installNavigatorDOM, no need to check here
    // if (!win.READIUM2) {
    //     return;
    // }

    win.READIUM2.domSlidingViewport.style.overflow = zoomPercent === 0 ? "hidden" : "auto";

    win.READIUM2.fixedLayoutZoomPercent = zoomPercent;

    const activeWebViews = win.READIUM2.getActiveWebViews();
    for (const activeWebView of activeWebViews) {
        if (_fixedLayoutZoomPercentTimers[activeWebView.id] !== undefined) {
            win.clearTimeout(_fixedLayoutZoomPercentTimers[activeWebView.id]);
            _fixedLayoutZoomPercentTimers[activeWebView.id] = undefined;
            // delete _fixedLayoutZoomPercentTimers[activeWebView.id];
        }
        const wvSlot = activeWebView.getAttribute("data-wv-slot") as WebViewSlotEnum;
        if (wvSlot) {
            debug("fixedLayoutZoomPercent ... setWebViewStyle");
            setWebViewStyle(activeWebView, wvSlot);

            _fixedLayoutZoomPercentTimers[activeWebView.id] = win.setTimeout(async () => {
                try {
                    _fixedLayoutZoomPercentTimers[activeWebView.id] = undefined;

                    // will trigger R2_EVENT_FXL_CONFIGURE => setWebViewStyle
                    if (activeWebView.READIUM2?.DOMisReady) {
                        await activeWebView.send("R2_EVENT_WINDOW_RESIZE", zoomPercent);
                    }
                } catch (e) {
                    debug(e);
                }
            }, 500);
        }
    }
}

// legacy function, old confusing name (see readiumCssUpdate() below)
export function readiumCssOnOff(rcss?: IEventPayload_R2_EVENT_READIUMCSS) {

    const loc = getCurrentReadingLocation();

    const activeWebViews = win.READIUM2.getActiveWebViews();
    for (const activeWebView of activeWebViews) {
        readiumCssApplyToWebview(loc, activeWebView, undefined, rcss);
    }
}
export function readiumCssUpdate(rcss: IEventPayload_R2_EVENT_READIUMCSS) {
    return readiumCssOnOff(rcss);
}

let _webview1: IReadiumElectronWebview | undefined;
let _webview2: IReadiumElectronWebview | undefined;

function createWebViewInternal(preloadScriptPath: string): IReadiumElectronWebview {

    const wv = document.createElement("webview");
    // tslint:disable-next-line:max-line-length
    // https://github.com/electron/electron/blob/master/docs/tutorial/security.md#3-enable-context-isolation-for-remote-content
    wv.setAttribute("webpreferences",
        `enableRemoteModule=0, allowRunningInsecureContent=0, backgroundThrottling=0, nodeIntegration=0, contextIsolation=0, nodeIntegrationInWorker=0, sandbox=0, webSecurity=1, webviewTag=0, partition=${R2_SESSION_WEBVIEW}`);

    wv.setAttribute("partition", R2_SESSION_WEBVIEW);

    const publicationURL_ = win.READIUM2.publicationURL;
    if (publicationURL_) {
        // const ref = publicationURL_.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://") ?
        //     publicationURL_ : convertHttpUrlToCustomScheme(publicationURL_);
        wv.setAttribute("httpreferrer", publicationURL_);
    }
    debug("createWebViewInternal ... setWebViewStyle");
    setWebViewStyle(wv as IReadiumElectronWebview, WebViewSlotEnum.center);
    wv.setAttribute("preload", preloadScriptPath); // "file://"

    // if (ENABLE_WEBVIEW_RESIZE) {
    //     wv.setAttribute("disableguestresize", "");
    // }

    // setTimeout(() => {
    //     // wv.removeAttribute("tabindex");
    //     wv.setAttribute("tabindex", "-1");
    //     // wv.setAttribute("aria-label", "");
    // }, 500);

    wv.addEventListener("did-start-loading", () => {
        debug("DOMisReady... did-start-loading => false");
        (wv as IReadiumElectronWebview).READIUM2.DOMisReady = false;
    });
    wv.addEventListener("did-navigate-in-page", () => {
        debug("DOMisReady... did-navigate-in-page => true");
        (wv as IReadiumElectronWebview).READIUM2.DOMisReady = true;
    });
    wv.addEventListener("dom-ready", () => {
        // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#webcontents

        debug("DOMisReady... dom-ready => true");
        (wv as IReadiumElectronWebview).READIUM2.DOMisReady = true;

        wv.clearHistory();

        if (IS_DEV) {
            ipcRenderer.send(CONTEXT_MENU_SETUP, wv.getWebContentsId());
        }

        if (win.READIUM2) {
            ttsVoice(win.READIUM2.ttsVoice);
            ttsPlaybackRate(win.READIUM2.ttsPlaybackRate);
            ttsClickEnable(win.READIUM2.ttsClickEnabled);
            ttsSentenceDetectionEnable(win.READIUM2.ttsSentenceDetectionEnabled);
            ttsSkippabilityEnable(win.READIUM2.ttsSkippabilityEnabled);
            ttsOverlayEnable(win.READIUM2.ttsOverlayEnabled);
            // fixedLayoutZoomPercent(win.READIUM2.fixedLayoutZoomPercent);
        }

        checkTtsState(wv as IReadiumElectronWebview);
        // mediaOverlaysNotifyDocumentLoaded();
    });

    wv.addEventListener("ipc-message", (event: Electron.IpcMessageEvent) => {
        const webview = event.currentTarget as IReadiumElectronWebview;
        if (webview !== wv) {
            debug("Wrong navigator webview?!");
            return;
        }
        if (event.channel === R2_EVENT_MEDIA_OVERLAY_INTERRUPT) {
            mediaOverlaysInterrupt();
        } else if (event.channel === R2_EVENT_KEYBOARD_FOCUS_REQUEST) {
            const skip = win.READIUM2?.stealFocusDisabled;

            debug("KEYBOARD FOCUS REQUEST (2) ", webview.id, win.document.activeElement?.id, skip);

            if (!skip) {
                if (win.document.activeElement && (win.document.activeElement as HTMLElement).blur) {
                    (win.document.activeElement as HTMLElement).blur();
                }

                const iframe = webview.shadowRoot?.querySelector("iframe");
                if (iframe) {
                    iframe.focus();
                } else {
                    webview.focus();
                }
            }

            // win.blur();
            // win.focus();

            // ipcRenderer.invoke(R2_EVENT_KEYBOARD_FOCUS_REQUEST, webview.getWebContentsId());
        } else if (event.channel === R2_EVENT_SHOW) {
            webview.style.opacity = "1";
        } else if (event.channel === R2_EVENT_FXL_CONFIGURE) {
            const payload = event.args[0] as IEventPayload_R2_EVENT_FXL_CONFIGURE;
            debug("R2_EVENT_FXL_CONFIGURE ... setWebViewStyle");
            if (payload.fxl) {
                setWebViewStyle(webview, WebViewSlotEnum.center, payload.fxl);
            } else {
                setWebViewStyle(webview, WebViewSlotEnum.center, null);
            }
            _resizeSkip--;
        } else if (event.channel === R2_EVENT_WEBVIEW_KEYDOWN) {
            const payload = event.args[0] as IEventPayload_R2_EVENT_WEBVIEW_KEYDOWN;
            if (_keyDownEventHandler) {
                _keyDownEventHandler(payload, payload.elementName, payload.elementAttributes);
            }
        } else if (event.channel === R2_EVENT_WEBVIEW_KEYUP) {
            const payload = event.args[0] as IEventPayload_R2_EVENT_WEBVIEW_KEYUP;
            if (_keyUpEventHandler) {
                _keyUpEventHandler(payload, payload.elementName, payload.elementAttributes);
            }
        } else if (event.channel === R2_EVENT_CAPTIONS) {
            const payload = event.args[0] as IEventPayload_R2_EVENT_CAPTIONS;

            let captionElement = win.document.getElementById(ELEMENT_ID_CAPTIONS);
            let rssStyleElement = win.document.getElementById(ELEMENT_ID_READIUM_CSS_STYLE);
            const rootElement = win.document.getElementById(ELEMENT_ID_SLIDING_VIEWPORT);
            if (payload.text && rootElement) {
                if (!rssStyleElement) {
                    const urlStr = win.READIUM2.publicationURL.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL) ?
                        convertCustomSchemeToHttpUrl(win.READIUM2.publicationURL) :
                        win.READIUM2.publicationURL;
                    const rcssUrl = new URL(urlStr);
                    rcssUrl.pathname = `${READIUM_CSS_URL_PATH}/`;
                    rssStyleElement = win.document.createElement("style");
                    rssStyleElement.setAttribute("id", ELEMENT_ID_READIUM_CSS_STYLE);
                    const styleTxtNode = win.document.createTextNode(
                        readiumCssStyle.replace(/{RCSS_BASE_URL}/g, rcssUrl.toString()));
                    rssStyleElement.appendChild(styleTxtNode);
                    win.document.head.appendChild(rssStyleElement);
                }
                if (!captionElement) {
                    captionElement = win.document.createElement("div");
                    captionElement.setAttribute("id", ELEMENT_ID_CAPTIONS);
                    // captionElement.setAttribute("style", captionsOverlayCssStyles);
                    const para = win.document.createElement("p");
                    // para.setAttribute("style", captionsOverlayParaCssStyles);
                    captionElement.appendChild(para);

                    rootElement.appendChild(captionElement);
                    // win.document.body.appendChild(captionElement);
                }
                captionElement.setAttribute("style",
                    captionsOverlayCssStyles +
                    (payload.containerStyle ? ` ${payload.containerStyle}` : " "));
                const p = captionElement.firstElementChild;
                if (p) {
                    p.setAttribute("style",
                        captionsOverlayParaCssStyles +
                        (payload.textStyle ? ` ${payload.textStyle}` : " "));
                    p.textContent = payload.text;
                }
            } else {
                if (captionElement && captionElement.parentNode) {
                    captionElement.parentNode.removeChild(captionElement);
                }
            }
        } else if (event.channel === R2_EVENT_CLIPBOARD_COPY) {
            const clipboardInterceptor = win.READIUM2.clipboardInterceptor;
            if (clipboardInterceptor) {
                const payload = event.args[0] as IEventPayload_R2_EVENT_CLIPBOARD_COPY;
                clipboardInterceptor(payload);
            }
        } else if (event.channel === R2_EVENT_PAGE_TURN_RES &&
            (event.args[0] as IEventPayload_R2_EVENT_PAGE_TURN).go === ""
            // && (event.args[0] as IEventPayload_R2_EVENT_PAGE_TURN).direction === ""
        ) {
            checkTtsState(wv as IReadiumElectronWebview);
        } else if (!highlightsHandleIpcMessage(event.channel, event.args, webview) &&
            !ttsHandleIpcMessage(event.channel, event.args, webview) &&
            !locationHandleIpcMessage(event.channel, event.args, webview) &&
            !mediaOverlaysHandleIpcMessage(event.channel, event.args, webview) &&
            !soundtrackHandleIpcMessage(event.channel, event.args, webview)) {

            debug("webview ipc-message");
            debug(event.channel);
        }
    });

    return wv as IReadiumElectronWebview;
}

// if (ENABLE_WEBVIEW_RESIZE) {
//     // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#webcontents
//     // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#webview
//     // wv.setAttribute("disableguestresize", "");
//     const adjustResize = (webview: IReadiumElectronWebview) => {
//         // https://javascript.info/size-and-scroll
//         // offsetW/H: excludes margin, includes border, scrollbar, padding.
//         // clientW/H: excludes margin, border, scrollbar, includes padding.
//         // scrollW/H: like client, but includes hidden (overflow) areas
//         const width = webview.clientWidth;
//         const height = webview.clientHeight;

//         const wc = webContents.fromId(webview.getWebContentsId());
//         // const wc = webview.getWebContents();

//         if (wc && (wc as any).setSize && width && height) {
//             (wc as any).setSize({ // wc is WebContents, works in Electron < 3.0
//                 normal: {
//                     height,
//                     width,
//                 },
//             });
//         }
//     };
//     const onResizeDebounced = debounce(() => {
//         const activeWebViews = win.READIUM2.getActiveWebViews();
//         if (activeWebView) {
//             adjustResize(activeWebView);
//         }
//     }, 200);
//     win.addEventListener("resize", () => {
//         // const activeWebViews = win.READIUM2.getActiveWebViews();
//         // if (!isFixedLayout(activeWebView.READIUM2.link)) {
//         //     if (_rootHtmlElement) {
//         //         _rootHtmlElement.dispatchEvent(new Event(DOM_EVENT_HIDE_VIEWPORT));
//         //     }
//         // }
//         onResizeDebounced();
//     });
// }

function createWebView(second?: boolean) {
    const preloadScriptPath = win.READIUM2.preloadScriptPath;
    const domSlidingViewport = win.READIUM2.domSlidingViewport;

    if (second) {
        if (_webview2) {
            destroyWebView(true);
        }
        _webview2 = createWebViewInternal(preloadScriptPath);
        _webview2.READIUM2 = {
            id: 2,
            link: undefined,
            readiumCss: undefined,
            highlights: undefined,
        };
        _webview2.setAttribute("id", "r2_webview2");
        domSlidingViewport.appendChild(_webview2 as Node);
    } else {
        if (_webview1) {
            destroyWebView(false);
        }
        _webview1 = createWebViewInternal(preloadScriptPath);
        _webview1.READIUM2 = {
            id: 1,
            link: undefined,
            readiumCss: undefined,
            highlights: undefined,
        };
        _webview1.setAttribute("id", "r2_webview1");
        domSlidingViewport.appendChild(_webview1 as Node);
    }
}

function destroyWebView(second?: boolean): void {
    const domSlidingViewport = win.READIUM2.domSlidingViewport;
    if (second) {
        if (_webview2) {
            domSlidingViewport.removeChild(_webview2 as Node);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (_webview2 as any).READIUM2 = undefined;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (_webview2 as any) = undefined;
        }
    } else {
        if (_webview1) {
            domSlidingViewport.removeChild(_webview1 as Node);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (_webview1 as any).READIUM2 = undefined;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (_webview1 as any) = undefined;
        }
    }
}

export function installNavigatorDOM(
    publication: Publication,
    publicationURL: string,
    rootHtmlElementID: string,
    preloadScriptPath: string,
    location: Locator | undefined,
    enableScreenReaderAccessibilityWebViewHardRefresh: boolean,
    clipboardInterceptor: ((data: IEventPayload_R2_EVENT_CLIPBOARD_COPY) => void) | undefined,
    sessionInfo: string | undefined,
    rcss: IEventPayload_R2_EVENT_READIUMCSS | undefined,
) {

    // debug(JSON.stringify(publication, null, 4));
    // debug(util.inspect(publication,
    //     { showHidden: false, depth: 1000, colors: true, customInspect: true }));

    const domRootElement = document.getElementById(rootHtmlElementID) as HTMLElement;
    if (!domRootElement) {
        debug("!rootHtmlElementID ???");
        return;
    }

    const domSlidingViewport = document.createElement("div");
    domSlidingViewport.setAttribute("id", ELEMENT_ID_SLIDING_VIEWPORT);
    domSlidingViewport.setAttribute("style",
        "display: block; position: relative; width: 100%; height: 100%; " +
        "margin: 0; padding: 0; box-sizing: border-box; background: white; overflow: hidden;");

    win.READIUM2 = {
        DEBUG_VISUALS: false,
        clipboardInterceptor,
        createFirstWebView: createWebView,
        createSecondWebView: () => {
            createWebView(true);
        },
        destroyFirstWebView: destroyWebView,
        destroySecondWebView: () => {
            destroyWebView(true);
        },
        domRootElement,
        domSlidingViewport,
        enableScreenReaderAccessibilityWebViewHardRefresh:
            enableScreenReaderAccessibilityWebViewHardRefresh ? false : false, // force disable (underscore link!)
        fixedLayoutZoomPercent: 0,
        getActiveWebViews: (): IReadiumElectronWebview[] => {
            const arr = [];
            if (_webview1) {
                arr.push(_webview1);
            }
            if (_webview2) {
                arr.push(_webview2);
            }
            return arr;
        },
        getFirstOrSecondWebView: (): IReadiumElectronWebview | undefined => {
            return _webview1 ? _webview1 : _webview2;
        },
        getFirstWebView: (): IReadiumElectronWebview | undefined => {
            return _webview1;
        },
        getSecondWebView: (create: boolean): IReadiumElectronWebview | undefined => {
            if (!_webview2 && create) {
                createWebView(true);
            }
            return _webview2;
        },
        // See "accessibility-support-changed" event cycles in MAIN and RENDERER (this BrowserWindow) processes
        isScreenReaderMounted: false,
        preloadScriptPath,
        publication,
        publicationURL,
        sessionInfo,
        ttsClickEnabled: false,
        ttsOverlayEnabled: false,
        ttsPlaybackRate: 1,
        ttsSkippabilityEnabled: false,
        ttsSentenceDetectionEnabled: true,
        ttsVoice: null,
        highlightsDrawMargin: false,
        stealFocusDisabled: false,
    };
    ipcRenderer.send("accessibility-support-changed");

    if (IS_DEV) {
        debug("||||||++||||| installNavigatorDOM: ", JSON.stringify(location));

        const debugVisualz = (win.localStorage &&
            win.localStorage.getItem(URL_PARAM_DEBUG_VISUALS) === "true") ? true : false;
        debug("debugVisuals GET: ", debugVisualz);

        win.READIUM2.DEBUG_VISUALS = debugVisualz;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (win.READIUM2 as any).debug = async (debugVisuals: boolean) => {
            debug("debugVisuals SET: ", debugVisuals);
            win.READIUM2.DEBUG_VISUALS = debugVisuals;
            if (win.localStorage) {
                win.localStorage.setItem(URL_PARAM_DEBUG_VISUALS, debugVisuals ? "true" : "false");
            }

            const loc = getCurrentReadingLocation();

            const activeWebViews = win.READIUM2.getActiveWebViews();
            for (const activeWebView of activeWebViews) {
                const payload: IEventPayload_R2_EVENT_DEBUG_VISUALS = { debugVisuals };
                setTimeout(async () => {
                    if (activeWebView.READIUM2?.DOMisReady) {
                        await activeWebView.send(R2_EVENT_DEBUG_VISUALS, payload);
                    }
                }, 0);
                if (loc && loc.locator.href === activeWebView.READIUM2.link?.Href) {

                    await new Promise<void>((res, _rej) => {
                        setTimeout(() => {
                            debug("READIUM2.debug -> handleLinkLocator");
                            handleLinkLocator(
                                loc.locator,
                                activeWebView.READIUM2.readiumCss,
                            );
                            res();
                        }, 100);
                    });
                }
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (win.READIUM2 as any).debugItems =
            (href: string, cssSelector: string, cssClass: string, cssStyles: string | undefined) => {

                if (cssStyles) {
                    debug("debugVisuals ITEMS: ", `${cssSelector} --- ${cssClass} --- ${cssStyles}`);
                }

                const activeWebViews = win.READIUM2.getActiveWebViews();
                for (const activeWebView of activeWebViews) {
                    if (activeWebView.READIUM2.link?.Href !== href) {
                        continue;
                    }
                    // let delay = 0;
                    // if (!win.READIUM2.DEBUG_VISUALS) {
                    //     (win.READIUM2 as any).debug(true);
                    //     delay = 200;
                    // }
                    // setTimeout(() => {
                    //     if (activeWebView) {
                    //         const payload: IEventPayload_R2_EVENT_DEBUG_VISUALS
                    //             = { debugVisuals: true, cssSelector, cssClass, cssStyles };
                    // if (activeWebView.READIUM2?.DOMisReady) {}
                    //         activeWebView.send(R2_EVENT_DEBUG_VISUALS, payload);
                    //     }
                    // }, delay);

                    const d = win.READIUM2.DEBUG_VISUALS;
                    const payload: IEventPayload_R2_EVENT_DEBUG_VISUALS
                        = { debugVisuals: d, cssSelector, cssClass, cssStyles };

                    setTimeout(async () => {
                        if (activeWebView.READIUM2?.DOMisReady) {
                            await activeWebView.send(R2_EVENT_DEBUG_VISUALS, payload);
                        }
                    }, 0);
                }
            };
    }

    domRootElement.appendChild(domSlidingViewport);

    createWebView();

    setTimeout(() => {
        debug("installNavigatorDOM -> handleLinkLocator");
        handleLinkLocator(location, rcss);
    }, 100);
}

let _keyDownEventHandler: (
    ev: IKeyboardEvent,
    elementName: string,
    elementAttributes: { [name: string]: string },
) => void;
export function setKeyDownEventHandler(func: (
    ev: IKeyboardEvent,
    elementName: string,
    elementAttributes: { [name: string]: string },
) => void) {

    _keyDownEventHandler = func;
}

let _keyUpEventHandler: (
    ev: IKeyboardEvent,
    elementName: string,
    elementAttributes: { [name: string]: string },
) => void;
export function setKeyUpEventHandler(func: (
    ev: IKeyboardEvent,
    elementName: string,
    elementAttributes: { [name: string]: string },
) => void) {

    _keyUpEventHandler = func;
}
