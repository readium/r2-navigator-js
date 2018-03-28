// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import debounce = require("debounce");
import ResizeSensor = require("resize-sensor/ResizeSensor");

import { ipcRenderer } from "electron";

import {
    IEventPayload_R2_EVENT_LINK,
    IEventPayload_R2_EVENT_PAGE_TURN,
    IEventPayload_R2_EVENT_READING_LOCATION,
    IEventPayload_R2_EVENT_SCROLLTO,
    IEventPayload_R2_EVENT_WEBVIEW_READY,
    R2_EVENT_LINK,
    R2_EVENT_PAGE_TURN,
    R2_EVENT_PAGE_TURN_RES,
    R2_EVENT_READING_LOCATION,
    R2_EVENT_SCROLLTO,
    R2_EVENT_WEBVIEW_READY,
} from "../../common/events";

// import { READIUM2_ELECTRON_HTTP_PROTOCOL } from "../../common/sessions";
import { IPropertyAnimationState, animateProperty } from "../common/animateProperty";
import { fullQualifiedSelector } from "../common/cssselector";
import { easings } from "../common/easings";
import { getURLQueryParams } from "../common/querystring";
import { URL_PARAM_GOTO, URL_PARAM_PREVIOUS } from "../common/url-params";
import {
    DEBUG_VISUALS,
    configureFixedLayout,
    injectDefaultCSS,
    injectReadPosCSS,
    isRTL,
    isVerticalWritingMode,
    readiumCSS,
} from "./readium-css";
import { IElectronWebviewTagWindow } from "./state";

// webFrame.registerURLSchemeAsSecure(READIUM2_ELECTRON_HTTP_PROTOCOL);
// webFrame.registerURLSchemeAsBypassingCSP(READIUM2_ELECTRON_HTTP_PROTOCOL);
// webFrame.registerURLSchemeAsPrivileged(READIUM2_ELECTRON_HTTP_PROTOCOL, {
//     allowServiceWorkers: false,
//     bypassCSP: false,
//     corsEnabled: false,
//     secure: true,
//     supportFetchAPI: false,
// });

const win = (global as any).window as IElectronWebviewTagWindow;
win.READIUM2 = {
    fxlViewportHeight: 0,
    fxlViewportWidth: 0,
    hashElement: null,
    isFixedLayout: false,
    locationHashOverride: undefined,
    locationHashOverrideCSSselector: undefined,
    readyEventSent: false,
    readyPassDone: false,
    urlQueryParams: undefined,
};

win.READIUM2.urlQueryParams = win.location.search ? getURLQueryParams(win.location.search) : undefined;

// console.log("-----");
// console.log(win.location.href);
// console.log(win.location.origin);
// console.log(win.location.pathname);
// console.log(win.location.search);
// console.log(win.location.hash);

ipcRenderer.on(R2_EVENT_SCROLLTO, (_event: any, payload: IEventPayload_R2_EVENT_SCROLLTO) => {
    // console.log("R2_EVENT_SCROLLTO");
    // console.log(payload);

    if (!win.READIUM2.urlQueryParams) {
        win.READIUM2.urlQueryParams = {};
    }
    if (payload.previous) {
        // tslint:disable-next-line:no-string-literal
        win.READIUM2.urlQueryParams[URL_PARAM_PREVIOUS] = "true";
    } else {
        // tslint:disable-next-line:no-string-literal
        if (typeof win.READIUM2.urlQueryParams[URL_PARAM_PREVIOUS] !== "undefined") {
            // tslint:disable-next-line:no-string-literal
            delete win.READIUM2.urlQueryParams[URL_PARAM_PREVIOUS];
        }
    }
    if (payload.goto) {
        // tslint:disable-next-line:no-string-literal
        win.READIUM2.urlQueryParams[URL_PARAM_GOTO] = payload.goto;
    } else {
        // tslint:disable-next-line:no-string-literal
        if (typeof win.READIUM2.urlQueryParams[URL_PARAM_GOTO] !== "undefined") {
            // tslint:disable-next-line:no-string-literal
            delete win.READIUM2.urlQueryParams[URL_PARAM_GOTO];
        }
    }
    if (payload.hash) {
        win.READIUM2.hashElement = win.document.getElementById(payload.hash);
    } else {
        win.READIUM2.hashElement = null;
    }

    win.READIUM2.readyEventSent = false;
    win.READIUM2.locationHashOverride = undefined;
    scrollToHashRaw(false);

    // const payload: IEventPayload_R2_EVENT_WEBVIEW_READY = {
    //     href: win.location.href,
    // };
    // ipcRenderer.sendToHost(R2_EVENT_WEBVIEW_READY, payload);
    // notifyReadingLocation();
});

let _lastAnimState: IPropertyAnimationState | undefined;

ipcRenderer.on(R2_EVENT_PAGE_TURN, (_event: any, payload: IEventPayload_R2_EVENT_PAGE_TURN) => {
    if (win.READIUM2.isFixedLayout || !win.document.body) {
        ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
        return;
    }

    // console.log("---");
    // console.log("webview.innerWidth: " + win.innerWidth);
    // console.log("document.offsetWidth: " + win.document.documentElement.offsetWidth);
    // console.log("document.clientWidth: " + win.document.documentElement.clientWidth);
    // console.log("document.scrollWidth: " + win.document.documentElement.scrollWidth);
    // console.log("document.scrollLeft: " + win.document.documentElement.scrollLeft);
    // console.log("body.offsetWidth: " + win.document.body.offsetWidth);
    // console.log("body.clientWidth: " + win.document.body.clientWidth);
    // console.log("body.scrollWidth: " + win.document.body.scrollWidth);
    // console.log("body.scrollLeft: " + win.document.body.scrollLeft);
    // console.log("---");
    // console.log("webview.innerHeight: " + win.innerHeight);
    // console.log("document.offsetHeight: " + win.document.documentElement.offsetHeight);
    // console.log("document.clientHeight: " + win.document.documentElement.clientHeight);
    // console.log("document.scrollHeight: " + win.document.documentElement.scrollHeight);
    // console.log("document.scrollTop: " + win.document.documentElement.scrollTop);
    // console.log("body.offsetHeight: " + win.document.body.offsetHeight);
    // console.log("body.clientHeight: " + win.document.body.clientHeight);
    // console.log("body.scrollHeight: " + win.document.body.scrollHeight);
    // console.log("body.scrollTop: " + win.document.body.scrollTop);
    // console.log("---");

    // win.document.body.offsetWidth === single column width (takes into account column gap?)
    // win.document.body.clientWidth === same
    // win.document.body.scrollWidth === full document width (all columns)

    // win.document.body.offsetHeight === full document height (sum of all columns minus trailing blank space?)
    // win.document.body.clientHeight === same
    // win.document.body.scrollHeight === visible viewport height

    // win.document.body.scrollLeft === positive number for horizontal shift
    // win.document.body.scrollTop === positive number for vertical shift

    const isPaged = win.document.documentElement.classList.contains("readium-paginated");
    // console.log("isPaged: " + isPaged);
    // const isTwoPage = isPaged && (win.document.documentElement.offsetWidth === (win.document.body.offsetWidth * 2));
    // const isTwoPage = isPaged && (win.document.documentElement.offsetWidth > win.document.body.offsetWidth);
    // console.log("isTwoPage: " + isTwoPage);
    // const nColumns = isPaged ? (win.document.body.offsetHeight / win.document.body.scrollHeight) : 0;
    // console.log("nColumns: " + nColumns);

    const maxHeightShift = isPaged ?
        ((isVerticalWritingMode() ?
            (win.document.body.scrollHeight - win.document.documentElement.offsetHeight) :
            (win.document.body.scrollWidth - win.document.documentElement.offsetWidth))) :
        ((isVerticalWritingMode() ?
            (win.document.body.scrollWidth - win.document.documentElement.clientWidth) :
            (win.document.body.scrollHeight - win.document.documentElement.clientHeight)));
    // console.log("maxHeightShift: " + maxHeightShift);

    const goPREVIOUS = payload.go === "PREVIOUS"; // any other value is NEXT

    // const isRTL = messageJson.direction === "RTL"; //  any other value is LTR
    // console.log(JSON.stringify(messageJson, null, "  "));

    if (!goPREVIOUS) { // goPREVIOUS && isRTL() || !goPREVIOUS && !isRTL()) { // right
        if (isPaged) {
            // console.log("element.scrollLeft: " + win.document.body.scrollLeft);
            if (Math.abs(win.document.body.scrollLeft) < maxHeightShift) { // not at end
                if (_lastAnimState && _lastAnimState.animating) {
                    win.cancelAnimationFrame(_lastAnimState.id);
                    _lastAnimState.object[_lastAnimState.property] = _lastAnimState.destVal;
                }
                const newVal = win.document.body.scrollLeft +
                    (isRTL() ? -1 : 1) * win.document.documentElement.offsetWidth;
                // console.log("element.scrollLeft NEW: " + newVal);
                _lastAnimState = animateProperty(
                    win.cancelAnimationFrame,
                    undefined,
                    // (cancelled: boolean) => {
                    //     console.log(cancelled);
                    // },
                    "scrollLeft",
                    300,
                    win.document.body,
                    newVal,
                    win.requestAnimationFrame,
                    easings.easeInOutQuad,
                );
                return;
            }
        } else {
            // console.log("element.scrollTop: " + win.document.body.scrollTop);
            if (isVerticalWritingMode() && (Math.abs(win.document.body.scrollLeft) < maxHeightShift) ||
                !isVerticalWritingMode() && (Math.abs(win.document.body.scrollTop) < maxHeightShift)) {
                if (_lastAnimState && _lastAnimState.animating) {
                    win.cancelAnimationFrame(_lastAnimState.id);
                    _lastAnimState.object[_lastAnimState.property] = _lastAnimState.destVal;
                }
                const newVal = isVerticalWritingMode() ?
                    (win.document.body.scrollLeft +
                        (isRTL() ? -1 : 1) * win.document.documentElement.clientWidth) :
                    (win.document.body.scrollTop +
                        win.document.documentElement.clientHeight);
                // console.log("element.scrollTop NEW: " + newVal);
                _lastAnimState = animateProperty(
                    win.cancelAnimationFrame,
                    undefined,
                    // (cancelled: boolean) => {
                    //     console.log(cancelled);
                    // },
                    isVerticalWritingMode() ? "scrollLeft" : "scrollTop",
                    300,
                    win.document.body,
                    newVal,
                    win.requestAnimationFrame,
                    easings.easeInOutQuad,
                );
                return;
            }
        }
    } else if (goPREVIOUS) { //  && !isRTL() || !goPREVIOUS && isRTL()) { // left
        if (isPaged) {
            if (Math.abs(win.document.body.scrollLeft) > 0) { // not at begin
                if (_lastAnimState && _lastAnimState.animating) {
                    win.cancelAnimationFrame(_lastAnimState.id);
                    _lastAnimState.object[_lastAnimState.property] = _lastAnimState.destVal;
                }
                const newVal = win.document.body.scrollLeft -
                    (isRTL() ? -1 : 1) * win.document.documentElement.offsetWidth;
                // console.log("element.scrollLeft NEW: " + newVal);
                _lastAnimState = animateProperty(
                    win.cancelAnimationFrame,
                    undefined,
                    // (cancelled: boolean) => {
                    //     console.log(cancelled);
                    // },
                    "scrollLeft",
                    300,
                    win.document.body,
                    newVal,
                    win.requestAnimationFrame,
                    easings.easeInOutQuad,
                );
                return;
            }
        } else {
            if (isVerticalWritingMode() && (Math.abs(win.document.body.scrollLeft) > 0) ||
                !isVerticalWritingMode() && (Math.abs(win.document.body.scrollTop) > 0)) {
                if (_lastAnimState && _lastAnimState.animating) {
                    win.cancelAnimationFrame(_lastAnimState.id);
                    _lastAnimState.object[_lastAnimState.property] = _lastAnimState.destVal;
                }
                const newVal = isVerticalWritingMode() ?
                    (win.document.body.scrollLeft -
                        (isRTL() ? -1 : 1) * win.document.documentElement.clientWidth) :
                    (win.document.body.scrollTop -
                        win.document.documentElement.clientHeight);
                // console.log("element.scrollTop NEW: " + newVal);
                _lastAnimState = animateProperty(
                    win.cancelAnimationFrame,
                    undefined,
                    // (cancelled: boolean) => {
                    //     console.log(cancelled);
                    // },
                    isVerticalWritingMode() ? "scrollLeft" : "scrollTop",
                    300,
                    win.document.body,
                    newVal,
                    win.requestAnimationFrame,
                    easings.easeInOutQuad,
                );
                return;
            }
        }
    }

    ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
});

const checkReadyPass = () => {
    if (win.READIUM2.readyPassDone) {
        return;
    }
    win.READIUM2.readyPassDone = true;

    if (DEBUG_VISUALS) {
        if (win.READIUM2.hashElement) {
            win.READIUM2.hashElement.classList.add("readium2-read-pos");
        }
    }

    // assumes debounced from outside (Electron's webview object embedded in main renderer process HTML)
    win.addEventListener("resize", () => {
        configureFixedLayout(win.READIUM2.isFixedLayout);

        scrollToHashRaw(false);
        // scrollToHash(); // debounced
    });

    // const docElement = win.document.documentElement;
    // let skipFirstResize = docElement.getAttribute("data-readiumcss") || false;
    // let skipFirstScroll = skipFirstResize;

    setTimeout(() => {
        if (!win.READIUM2.isFixedLayout) {
            scrollToHashRaw(true);
        }

        win.addEventListener("scroll", (_ev: Event) => {

            if (_ignoreScrollEvent) {
                _ignoreScrollEvent = false;
                return;
            }
            // if (skipFirstScroll) {
            //     skipFirstScroll = false;
            //     return;
            // }

            const x = (isRTL() ? win.document.documentElement.offsetWidth - 1 : 0);
            processXY(x, 0);
        });

    }, 800);

    const useResizeSensor = !win.READIUM2.isFixedLayout;
    if (useResizeSensor && win.document.body) {

        setTimeout(() => {
            window.requestAnimationFrame((_timestamp) => {
                // tslint:disable-next-line:no-unused-expression
                new ResizeSensor(win.document.body, () => {

                    console.log("ResizeSensor");

                    scrollToHash();

                    // if (skipFirstResize) {
                    //     console.log("ResizeSensor SKIP FIRST");

                    //     skipFirstResize = false;
                    //     return;
                    // } else {
                    //     console.log("ResizeSensor");
                    // }
                });
            });
        }, 2000);
    }

    if (win.document.body) {

        win.document.body.addEventListener("click", (ev: MouseEvent) => {

            const x = ev.clientX; // win.document.body.scrollLeft;
            const y = ev.clientY; // win.document.body.scrollTop;

            processXY(x, y);
        });
    }
};

const notifyReady = () => {
    if (win.READIUM2.readyEventSent) {
        return;
    }
    win.READIUM2.readyEventSent = true;

    const payload: IEventPayload_R2_EVENT_WEBVIEW_READY = {
        href: win.location.href,
    };
    ipcRenderer.sendToHost(R2_EVENT_WEBVIEW_READY, payload);
};

function scrollIntoView(element: HTMLElement) {
    if (!win.document.body) {
        return;
    }
    // console.log("element.offsetTop: " + element.offsetTop);
    // console.log("win.document.body.scrollHeight: " + win.document.body.scrollHeight);

    // TODO: element.offsetTop probably breaks in nested DOM / CSS box contexts (relative to...)

    let colIndex = (element.offsetTop + (isRTL() ? -20 : +20)) / win.document.body.scrollHeight;
    // console.log("colIndex: " + colIndex);
    colIndex = Math.ceil(colIndex); // 1-based index

    const isTwoPage = win.document.documentElement.offsetWidth > win.document.body.offsetWidth;
    const spreadIndex = isTwoPage ? Math.ceil(colIndex / 2) : colIndex;
    // console.log("spreadIndex: " + spreadIndex);

    // console.log("element.getBoundingClientRect().top: " + element.getBoundingClientRect().top);
    // console.log("element.getBoundingClientRect().left: " + element.getBoundingClientRect().left);

    // const top = (colIndex * win.document.body.scrollHeight) + element.getBoundingClientRect().top;
    // console.log("top: " + top);

    // const left = (colIndex * win.document.body.offsetWidth);
    const left = ((spreadIndex - 1) * win.document.documentElement.offsetWidth);
    // console.log("left: " + left);

    win.document.body.scrollLeft = (isRTL() ? -1 : 1) * left;
}

const scrollToHashRaw = (firstCall: boolean) => {

    // console.log("scrollToHash: " + firstCall);

    const isPaged = win.document.documentElement.classList.contains("readium-paginated");

    if (win.READIUM2.locationHashOverride) {

        // console.log("win.READIUM2.locationHashOverride");

        if (win.READIUM2.locationHashOverride === win.document.body) {
            console.log("body...");

            return;
        }

        notifyReady();
        notifyReadingLocation();

        _ignoreScrollEvent = true;
        if (isPaged) {
            scrollIntoView(win.READIUM2.locationHashOverride as HTMLElement);
        } else {
            win.READIUM2.locationHashOverride.scrollIntoView({
                behavior: "instant",
                block: "start",
                inline: "start",
            });
        }

        return;
    } else if (win.READIUM2.hashElement) {

        console.log("win.READIUM2.hashElement");

        win.READIUM2.locationHashOverride = win.READIUM2.hashElement;
        // win.READIUM2.locationHashOverrideCSSselector =
        // fullQualifiedSelector(win.READIUM2.locationHashOverride, false);

        notifyReady();
        notifyReadingLocation();

        if (!firstCall) {
            _ignoreScrollEvent = true;
            if (isPaged) {
                scrollIntoView(win.READIUM2.hashElement as HTMLElement);
            } else {
                win.READIUM2.hashElement.scrollIntoView({
                    behavior: "instant",
                    block: "start",
                    inline: "start",
                });
            }
        }

        // win.READIUM2.hashElement.classList.add("readium2-hash");
        // setTimeout(() => {
        //     if (win.READIUM2.hashElement) {
        //         win.READIUM2.hashElement.classList.remove("readium2-hash");
        //     }
        // }, 1000);

        return;
    } else {
        if (win.document.body) {

            if (win.READIUM2.urlQueryParams) {
                // tslint:disable-next-line:no-string-literal
                const previous = win.READIUM2.urlQueryParams[URL_PARAM_PREVIOUS];
                const isPreviousNavDirection = previous === "true";
                if (isPreviousNavDirection) {

                    console.log(URL_PARAM_PREVIOUS);

                    const maxHeightShift = isPaged ?
                        ((isVerticalWritingMode() ?
                            (win.document.body.scrollHeight - win.document.documentElement.offsetHeight) :
                            (win.document.body.scrollWidth - win.document.documentElement.offsetWidth))) :
                        ((isVerticalWritingMode() ?
                            (win.document.body.scrollWidth - win.document.documentElement.clientWidth) :
                            (win.document.body.scrollHeight - win.document.documentElement.clientHeight)));
                    // console.log("maxHeightShift: " + maxHeightShift);

                    _ignoreScrollEvent = true;
                    if (isPaged) {
                        if (isVerticalWritingMode()) {
                            win.document.body.scrollLeft = 0;
                            win.document.body.scrollTop = maxHeightShift;
                        } else {
                            win.document.body.scrollLeft = (isRTL() ? -1 : 1) * maxHeightShift;
                            win.document.body.scrollTop = 0;
                        }
                    } else {
                        if (isVerticalWritingMode()) {
                            win.document.body.scrollLeft = (isRTL() ? -1 : 1) * maxHeightShift;
                            win.document.body.scrollTop = 0;
                        } else {
                            win.document.body.scrollLeft = 0;
                            win.document.body.scrollTop = maxHeightShift;
                        }
                    }

                    win.READIUM2.locationHashOverride = undefined;
                    win.READIUM2.locationHashOverrideCSSselector = undefined;
                    processXYRaw(0,
                        (isPaged ?
                            (isVerticalWritingMode() ?
                                win.document.documentElement.offsetWidth :
                                win.document.documentElement.offsetHeight) :
                            (isVerticalWritingMode() ?
                                win.document.documentElement.clientWidth :
                                win.document.documentElement.clientHeight))
                        - 1);

                    console.log("BOTTOM (previous):");
                    console.log(win.READIUM2.locationHashOverride);

                    notifyReady();
                    notifyReadingLocation();
                    return;
                }

                // tslint:disable-next-line:no-string-literal
                let gotoCssSelector = win.READIUM2.urlQueryParams[URL_PARAM_GOTO];
                if (gotoCssSelector) {
                    gotoCssSelector = gotoCssSelector.replace(/\+/g, " ");
                    // console.log("GOTO: " + gotoCssSelector);
                    let selected: Element | null = null;
                    try {
                        selected = document.querySelector(gotoCssSelector);
                    } catch (err) {
                        console.log(err);
                    }
                    if (selected) {

                        // console.log(URL_PARAM_GOTO);

                        win.READIUM2.locationHashOverride = selected;
                        win.READIUM2.locationHashOverrideCSSselector = gotoCssSelector;

                        notifyReady();
                        notifyReadingLocation();

                        _ignoreScrollEvent = true;
                        if (isPaged) {
                            scrollIntoView(selected as HTMLElement);
                        } else {
                            selected.scrollIntoView({
                                behavior: "instant",
                                block: "start",
                                inline: "start",
                            });
                        }

                        return;
                    }
                }
            }

            console.log("win.READIUM2.locationHashOverride = win.document.body");

            win.READIUM2.locationHashOverride = win.document.body;
            win.READIUM2.locationHashOverrideCSSselector = undefined;

            _ignoreScrollEvent = true;
            win.document.body.scrollLeft = 0;
            win.document.body.scrollTop = 0;
        }
    }

    notifyReady();
    notifyReadingLocation();
};

const scrollToHash = debounce(() => {
    scrollToHashRaw(false);
}, 500);

let _ignoreScrollEvent = false;

// const injectResizeSensor = () => {
//     ensureHead();
//     const scriptElement = win.document.createElement("script");
//     scriptElement.setAttribute("id", "Readium2-ResizeSensor");
//     scriptElement.setAttribute("type", "application/javascript");
//     scriptElement.setAttribute("src", urlResizeSensor);
//     scriptElement.appendChild(win.document.createTextNode(" "));
//     win.document.head.appendChild(scriptElement);
//     scriptElement.addEventListener("load", () => {
//         console.log("ResizeSensor LOADED");
//     });
// };

// after DOMContentLoaded
win.addEventListener("load", () => {
    // console.log("PRELOAD WIN LOAD");
    checkReadyPass();
});

// // does not occur when re-using same webview (src="href")
// win.addEventListener("unload", () => {
//     console.log("PRELOAD WIN UNLOAD");
//     resetInitialState();
// });

win.addEventListener("DOMContentLoaded", () => {

    // const linkUri = new URI(win.location.href);

    if (win.location.hash && win.location.hash.length > 1) {
        win.READIUM2.hashElement = win.document.getElementById(win.location.hash.substr(1));
    }

    // resetInitialState();
    win.READIUM2.locationHashOverride = undefined;
    win.READIUM2.readyPassDone = false;
    win.READIUM2.readyEventSent = false;

    let readiumcssJson: any = {};
    if (win.READIUM2.urlQueryParams) {
        // tslint:disable-next-line:no-string-literal
        const base64 = win.READIUM2.urlQueryParams["readiumcss"];
        // if (!base64) {
        //     console.log("!readiumcss BASE64 ??!");
        //     const token = "readiumcss=";
        //     const i = win.location.search.indexOf(token);
        //     if (i > 0) {
        //         base64 = win.location.search.substr(i + token.length);
        //         const j = base64.indexOf("&");
        //         if (j > 0) {
        //             base64 = base64.substr(0, j);
        //         }
        //         base64 = decodeURIComponent(base64);
        //     }
        // }
        if (base64) {
            try {
                // console.log(base64);
                const str = window.atob(base64);
                // console.log(str);

                readiumcssJson = JSON.parse(str);
                // console.log(readiumcssJson);

            } catch (err) {
                console.log(err);
            }
        }
    }
    win.READIUM2.isFixedLayout = readiumcssJson && readiumcssJson.isFixedLayout;
    configureFixedLayout(win.READIUM2.isFixedLayout);
    if (win.READIUM2.isFixedLayout) {
        notifyReady();
    }

    injectDefaultCSS();

    if (DEBUG_VISUALS) {
        injectReadPosCSS();
    }

    // // DEBUG
    // win.document.body.addEventListener("focus", (ev: any) => {
    //     console.log("focus:");
    //     console.log(ev.target);
    // }, true);
    // win.document.body.addEventListener("focusin", (ev: any) => {
    //     console.log("focusin:");
    //     console.log(ev.target);
    // });
    // // DEBUG

    win.document.body.addEventListener("focusin", (ev: any) => {
        const isPaged = win.document.documentElement.classList.contains("readium-paginated");
        if (isPaged) {
            setTimeout(() => {
                win.READIUM2.locationHashOverride = ev.target;
                scrollIntoView(ev.target as HTMLElement);
            }, 30);
        }
    });

    win.document.addEventListener("click", (e) => {
        const href = (e.target as any).href;
        if (!href) {
            return;
        }

        // console.log("+++++");
        // console.log(href);

        e.preventDefault();
        e.stopPropagation();

        const payload: IEventPayload_R2_EVENT_LINK = {
            url: href,
        };
        ipcRenderer.sendToHost(R2_EVENT_LINK, payload);
        return false;
    }, true);

    // injectResizeSensor();

    if (readiumcssJson) {
        readiumCSS(readiumcssJson);
    }
});

const processXYRaw = (x: number, y: number) => {
    // console.log("processXY: " + x + ", " + y);

    // const elems = document.elementsFromPoint(x, y);
    // // console.log(elems);
    // let element: Element | undefined = elems && elems.length ? elems[0] : undefined;
    let element: Element | undefined;

    // if ((document as any).caretPositionFromPoint) {
    //     console.log("caretPositionFromPoint");
    //     const range = (document as any).caretPositionFromPoint(x, y);
    //     const node = range.offsetNode;
    //     const offset = range.offset;
    // } else if (document.caretRangeFromPoint) {
    //     console.log("caretRangeFromPoint");
    // }

    // let textNode: Node | undefined;
    // let textNodeOffset = 0;

    const range = document.caretRangeFromPoint(x, y);
    if (range) {
        const node = range.startContainer;
        // const offset = range.startOffset;

        if (node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                element = node as Element;
            } else if (node.nodeType === Node.TEXT_NODE) {
                // textNode = node;
                // textNodeOffset = offset;
                if (node.parentNode && node.parentNode.nodeType === Node.ELEMENT_NODE) {
                    element = node.parentNode as Element;
                }
            }
        }
    }

    if (DEBUG_VISUALS) {
        const existings = document.querySelectorAll(".readium2-read-pos, .readium2-read-pos2");
        existings.forEach((existing) => {
            existing.classList.remove("readium2-read-pos");
            existing.classList.remove("readium2-read-pos2");
        });
    }
    if (element) {
        win.READIUM2.locationHashOverride = element;
        notifyReadingLocation();

        // console.log("element.offsetTop: " + (element as HTMLElement).offsetTop);
        // console.log("element.getBoundingClientRect().top: " + element.getBoundingClientRect().top);
        // console.log("element.offsetLeft: " + (element as HTMLElement).offsetLeft);
        // console.log("element.getBoundingClientRect().left: " + element.getBoundingClientRect().left);

        if (DEBUG_VISUALS) {
            element.classList.add("readium2-read-pos2");

            // // console.log("fullQualifiedSelector TRUE");
            // // const sel1 = fullQualifiedSelector(element, true);
            // // console.log(sel1);

            // // console.log("fullQualifiedSelector FALSE");
            // const sel2 = fullQualifiedSelector(element, false);
            // // console.log(sel2);

            // const selecteds = document.querySelectorAll(sel2);
            // selecteds.forEach((selected) => {
            //     selected.classList.remove("readium2-read-pos");
            //     selected.classList.add("readium2-read-pos2");
            // });
        }
    }
};
const processXY = debounce((x: number, y: number) => {
    processXYRaw(x, y);
}, 300);

const notifyReadingLocation = () => {
    if (!win.READIUM2.locationHashOverride) {
        return;
    }

    if (DEBUG_VISUALS) {
        win.READIUM2.locationHashOverride.classList.add("readium2-read-pos");
    }

    win.READIUM2.locationHashOverrideCSSselector = fullQualifiedSelector(win.READIUM2.locationHashOverride, false);
    const payload: IEventPayload_R2_EVENT_READING_LOCATION = {
        cssSelector: win.READIUM2.locationHashOverrideCSSselector,
    };
    ipcRenderer.sendToHost(R2_EVENT_READING_LOCATION, payload);
};
