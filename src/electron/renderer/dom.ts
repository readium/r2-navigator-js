// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

import { debounce } from "debounce";
import * as debug_ from "debug";
import { remote, webContents } from "electron";
import * as util from "util";

import { Locator } from "@r2-shared-js/models/locator";
import { Publication } from "@r2-shared-js/models/publication";

import {
    IEventPayload_R2_EVENT_CLIPBOARD_COPY, IEventPayload_R2_EVENT_DEBUG_VISUALS,
    IEventPayload_R2_EVENT_READIUMCSS, IEventPayload_R2_EVENT_WEBVIEW_KEYDOWN,
    IEventPayload_R2_EVENT_WEBVIEW_KEYUP, IKeyboardEvent, R2_EVENT_CLIPBOARD_COPY,
    R2_EVENT_DEBUG_VISUALS, R2_EVENT_READIUMCSS, R2_EVENT_WEBVIEW_KEYDOWN, R2_EVENT_WEBVIEW_KEYUP,
} from "../common/events";
import { R2_SESSION_WEBVIEW } from "../common/sessions";
import { URL_PARAM_DEBUG_VISUALS } from "./common/url-params";
import { ENABLE_WEBVIEW_RESIZE } from "./common/webview-resize";
import { highlightsHandleIpcMessage } from "./highlight";
import {
    getCurrentReadingLocation, handleLinkLocator, locationHandleIpcMessage, shiftWebview,
} from "./location";
import { mediaOverlaysHandleIpcMessage } from "./media-overlays";
import { ttsClickEnable, ttsHandleIpcMessage } from "./readaloud";
import { adjustReadiumCssJsonMessageForFixedLayout, obtainReadiumCss } from "./readium-css";
import { soundtrackHandleIpcMessage } from "./soundtrack";
import { IReadiumElectronBrowserWindow, IReadiumElectronWebview } from "./webview/state";

// import { registerProtocol } from "@r2-navigator-js/electron/renderer/common/protocol";
// registerProtocol();

// const CLASS_POS_RIGHT = "r2_posRight";
// const CLASS_SHIFT_LEFT = "r2_shiftedLeft";
// const CLASS_ANIMATED = "r2_animated";

const ELEMENT_ID_SLIDING_VIEWPORT = "r2_navigator_sliding_viewport";

const debug = debug_("r2:navigator#electron/renderer/index");

const win = window as IReadiumElectronBrowserWindow;

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

// legacy function, old confusing name (see readiumCssUpdate() below)
export function readiumCssOnOff(rcss?: IEventPayload_R2_EVENT_READIUMCSS) {

    const activeWebView = win.READIUM2.getActiveWebView();
    if (activeWebView) {
        const loc = getCurrentReadingLocation();

        const actualReadiumCss = obtainReadiumCss(rcss);
        activeWebView.READIUM2.readiumCss = actualReadiumCss;

        const payloadRcss = adjustReadiumCssJsonMessageForFixedLayout(activeWebView.READIUM2.link, actualReadiumCss);

        if (activeWebView.style.transform !== "none") {
            setTimeout(async () => {
                await activeWebView.send("R2_EVENT_HIDE");
            }, 0);

            setTimeout(async () => {
                shiftWebview(activeWebView, 0, undefined); // reset
                await activeWebView.send(R2_EVENT_READIUMCSS, payloadRcss);
            }, 10);
        } else {
            setTimeout(async () => {
                await activeWebView.send(R2_EVENT_READIUMCSS, payloadRcss);
            }, 0);
        }

        if (loc) {
            setTimeout(() => {
                debug(`readiumCssOnOff -> handleLinkLocator`);
                handleLinkLocator(loc.locator, activeWebView.READIUM2.readiumCss);
            }, 60);
        }
    }
}
export function readiumCssUpdate(rcss: IEventPayload_R2_EVENT_READIUMCSS) {
    return readiumCssOnOff(rcss);
}

let _webview1: IReadiumElectronWebview;

function createWebViewInternal(preloadScriptPath: string): IReadiumElectronWebview {

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
        "contextIsolation=0, webSecurity=1, allowRunningInsecureContent=0, enableRemoteModule=0");
    wv.setAttribute("partition", R2_SESSION_WEBVIEW);

    const publicationURL_ = win.READIUM2.publicationURL;
    if (publicationURL_) {
        // const ref = publicationURL_.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://") ?
        //     publicationURL_ : convertHttpUrlToCustomScheme(publicationURL_);
        wv.setAttribute("httpreferrer", publicationURL_);
    }
    wv.setAttribute("style", "display: flex; margin: 0; padding: 0; box-sizing: border-box; " +
        "position: absolute; left: 0; width: 50%; bottom: 0; top: 0;");
    wv.setAttribute("preload", preloadScriptPath); // "file://"

    if (ENABLE_WEBVIEW_RESIZE) {
        wv.setAttribute("disableguestresize", "");
    }

    setTimeout(() => {
        wv.removeAttribute("tabindex");
    }, 500);

    wv.addEventListener("dom-ready", () => {
        // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#webcontents

        wv.clearHistory();

        if (IS_DEV) {
            const wc = remote.webContents.fromId(wv.getWebContentsId());
            // const wc = wv.getWebContents();

            wc.on("context-menu", (_ev, params) => {
                const { x, y } = params;
                const openDevToolsAndInspect = () => {
                    const devToolsOpened = () => {
                        wc.off("devtools-opened", devToolsOpened);
                        wc.inspectElement(x, y);

                        setTimeout(() => {
                            if (wc.devToolsWebContents && wc.isDevToolsOpened()) {
                                wc.devToolsWebContents.focus();
                            }
                        }, 500);
                    };
                    wc.on("devtools-opened", devToolsOpened);
                    wc.openDevTools({ activate: true, mode: "detach" });
                };
                remote.Menu.buildFromTemplate([{
                    click: () => {
                        const wasOpened = wc.isDevToolsOpened();
                        if (!wasOpened) {
                            openDevToolsAndInspect();
                        } else {
                            if (!wc.isDevToolsFocused()) {
                                // wc.toggleDevTools();
                                wc.closeDevTools();

                                setImmediate(() => {
                                    openDevToolsAndInspect();
                                });
                            } else {
                                // right-click context menu normally occurs when focus
                                // is in BrowserWindow / WebView's WebContents,
                                // but some platforms (e.g. MacOS) allow mouse interaction
                                // when the window is in the background.
                                wc.inspectElement(x, y);
                            }
                        }
                    },
                    label: "Inspect element",
                }]).popup({window: remote.getCurrentWindow()});
            });
        }

        if (win.READIUM2) {
            ttsClickEnable(win.READIUM2.ttsClickEnabled);
        }

        // mediaOverlaysNotifyDocumentLoaded();
    });

    wv.addEventListener("ipc-message", (event: Electron.IpcMessageEvent) => {
        const webview = event.currentTarget as IReadiumElectronWebview;
        const activeWebView = win.READIUM2.getActiveWebView();
        if (webview !== activeWebView) {
            return;
        }
        if (event.channel === R2_EVENT_WEBVIEW_KEYDOWN) {
            const payload = event.args[0] as IEventPayload_R2_EVENT_WEBVIEW_KEYDOWN;
            if (_keyDownEventHandler) {
                _keyDownEventHandler(payload, payload.elementName, payload.elementAttributes);
            }
        } else if (event.channel === R2_EVENT_WEBVIEW_KEYUP) {
            const payload = event.args[0] as IEventPayload_R2_EVENT_WEBVIEW_KEYUP;
            if (_keyUpEventHandler) {
                _keyUpEventHandler(payload, payload.elementName, payload.elementAttributes);
            }
        } else if (event.channel === R2_EVENT_CLIPBOARD_COPY) {
            const clipboardInterceptor = win.READIUM2.clipboardInterceptor;
            if (clipboardInterceptor) {
                const payload = event.args[0] as IEventPayload_R2_EVENT_CLIPBOARD_COPY;
                clipboardInterceptor(payload);
            }
        } else if (!highlightsHandleIpcMessage(event.channel, event.args, webview) &&
            !ttsHandleIpcMessage(event.channel, event.args, webview) &&
            !locationHandleIpcMessage(event.channel, event.args, webview) &&
            !mediaOverlaysHandleIpcMessage(event.channel, event.args, webview) &&
            !soundtrackHandleIpcMessage(event.channel, event.args, webview)) {

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

        const wc = webContents.fromId(webview.getWebContentsId());
        // const wc = webview.getWebContents();

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
        const activeWebView = win.READIUM2.getActiveWebView();
        if (activeWebView) {
            adjustResize(activeWebView);
        }
    }, 200);
    window.addEventListener("resize", () => {
        // const activeWebView = win.READIUM2.getActiveWebView();
        // if (!isFixedLayout(activeWebView.READIUM2.link)) {
        //     if (_rootHtmlElement) {
        //         _rootHtmlElement.dispatchEvent(new Event(DOM_EVENT_HIDE_VIEWPORT));
        //     }
        // }
        onResizeDebounced();
    });
}

function createWebView() {
    const preloadScriptPath = win.READIUM2.preloadScriptPath;
    _webview1 = createWebViewInternal(preloadScriptPath);
    _webview1.READIUM2 = {
        id: 1,
        link: undefined,
        readiumCss: undefined,
    };
    _webview1.setAttribute("id", "webview1");

    const domSlidingViewport = win.READIUM2.domSlidingViewport;
    domSlidingViewport.appendChild(_webview1 as Node);
    // domSlidingViewport.appendChild(_webview2 as Node);

    // if (isRTL()) {
    //     _webview1.classList.add(CLASS_POS_RIGHT);
    //     _webview1.style.left = "50%";
    // }
    // else {
    //     _webview2.classList.add(CLASS_POS_RIGHT);
    //     _webview2.style.left = "50%";
    // }
}

function destroyWebView(): void {
    const domSlidingViewport = win.READIUM2.domSlidingViewport;
    domSlidingViewport.removeChild(_webview1 as Node);
    (_webview1 as any).READIUM2 = undefined;
    (_webview1 as any) = undefined;
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
    domSlidingViewport.setAttribute("style", "display: block; position: absolute; left: 0; width: 200%; " +
        "top: 0; bottom: 0; margin: 0; padding: 0; box-sizing: border-box; background: white; overflow: hidden;");

    win.READIUM2 = {
        DEBUG_VISUALS: false,
        clipboardInterceptor,
        createActiveWebView: createWebView,
        destroyActiveWebView: destroyWebView,
        domRootElement,
        domSlidingViewport,
        enableScreenReaderAccessibilityWebViewHardRefresh:
            enableScreenReaderAccessibilityWebViewHardRefresh ? true : false,
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
        mediaOverlaysPlaybackRate: 1,
        preloadScriptPath,
        publication,
        publicationURL,
        sessionInfo,
        ttsClickEnabled: false,
        ttsPlaybackRate: 1,
    };

    if (IS_DEV) {
        debug("||||||++||||| installNavigatorDOM: ", JSON.stringify(location));

        const debugVisualz = (window.localStorage &&
            window.localStorage.getItem(URL_PARAM_DEBUG_VISUALS) === "true") ? true : false;
        debug("debugVisuals GET: ", debugVisualz);

        win.READIUM2.DEBUG_VISUALS = debugVisualz;

        (window as any).READIUM2.debug = (debugVisuals: boolean) => {
            debug("debugVisuals SET: ", debugVisuals);
            win.READIUM2.DEBUG_VISUALS = debugVisuals;

            const activeWebView = win.READIUM2.getActiveWebView();
            if (activeWebView) {
                const payload: IEventPayload_R2_EVENT_DEBUG_VISUALS
                    = { debugVisuals };
                setTimeout(async () => {
                    await activeWebView.send(R2_EVENT_DEBUG_VISUALS, payload);
                }, 0);
            }
            if (window.localStorage) {
                window.localStorage.setItem(URL_PARAM_DEBUG_VISUALS, debugVisuals ? "true" : "false");
            }
            setTimeout(() => {
                const loc = getCurrentReadingLocation();
                if (loc) {
                    debug(`READIUM2.debug -> handleLinkLocator`);
                    handleLinkLocator(
                        loc.locator,
                        activeWebView ? activeWebView.READIUM2.readiumCss : undefined,
                    );
                }
            }, 100);
        };

        (window as any).READIUM2.debugItems =
            (cssSelector: string, cssClass: string, cssStyles: string | undefined) => {

                if (cssStyles) {
                    debug("debugVisuals ITEMS: ", `${cssSelector} --- ${cssClass} --- ${cssStyles}`);
                }

                const activeWebView = win.READIUM2.getActiveWebView();
                // let delay = 0;
                // if (!win.READIUM2.DEBUG_VISUALS) {
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
                    const d = win.READIUM2.DEBUG_VISUALS;
                    const payload: IEventPayload_R2_EVENT_DEBUG_VISUALS
                        = { debugVisuals: d, cssSelector, cssClass, cssStyles };

                    setTimeout(async () => {
                        await activeWebView.send(R2_EVENT_DEBUG_VISUALS, payload);
                    }, 0);
                }
            };
    }

    domRootElement.appendChild(domSlidingViewport);

    createWebView();

    setTimeout(() => {
        debug(`installNavigatorDOM -> handleLinkLocator`);
        handleLinkLocator(location, rcss);
    }, 100);
}

let _keyDownEventHandler: (
    ev: IKeyboardEvent,
    elementName: string,
    elementAttributes: {[name: string]: string},
) => void;
export function setKeyDownEventHandler(func: (
    ev: IKeyboardEvent,
    elementName: string,
    elementAttributes: {[name: string]: string},
) => void) {

    _keyDownEventHandler = func;
}

let _keyUpEventHandler: (
    ev: IKeyboardEvent,
    elementName: string,
    elementAttributes: {[name: string]: string},
) => void;
export function setKeyUpEventHandler(func: (
    ev: IKeyboardEvent,
    elementName: string,
    elementAttributes: {[name: string]: string},
) => void) {

    _keyUpEventHandler = func;
}
