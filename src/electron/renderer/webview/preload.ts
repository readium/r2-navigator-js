// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import ResizeSensor = require("css-element-queries/src/ResizeSensor");
// import ResizeSensor = require("resize-sensor/ResizeSensor");

import { debounce } from "debounce";

import { ipcRenderer } from "electron";

import {
    IEventPayload_R2_EVENT_LINK,
    IEventPayload_R2_EVENT_PAGE_TURN,
    IEventPayload_R2_EVENT_READING_LOCATION,
    IEventPayload_R2_EVENT_READING_LOCATION_PAGINATION_INFO,
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
import { URL_PARAM_CSS, URL_PARAM_EPUBREADINGSYSTEM, URL_PARAM_GOTO, URL_PARAM_PREVIOUS } from "../common/url-params";
import { setWindowNavigatorEpubReadingSystem } from "./epubReadingSystem";
import {
    DEBUG_VISUALS,
    calculateMaxScrollShift,
    calculateTotalColumns,
    configureFixedLayout,
    injectDefaultCSS,
    injectReadPosCSS,
    isPaginated,
    isRTL,
    isTwoPageSpread,
    isVerticalWritingMode,
    readiumCSS,
} from "./readium-css";
import { IElectronWebviewTagWindow } from "./state";

import { consoleRedirect } from "../console-redirect";

// const releaseConsoleRedirect =
consoleRedirect("r2:navigator#electron/renderer/webview/preload", process.stdout, process.stderr, true);

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
    locationHashOverrideInfo: {
        cfi: undefined,
        cssSelector: undefined,
        paginationInfo: undefined,
        position: undefined,
        progression: undefined,
    },
    readyEventSent: false,
    readyPassDone: false,
    urlQueryParams: undefined,
};

win.READIUM2.urlQueryParams = win.location.search ? getURLQueryParams(win.location.search) : undefined;

if (win.READIUM2.urlQueryParams) {
    let readiumEpubReadingSystemJson: any = {};

    // tslint:disable-next-line:no-string-literal
    const base64EpubReadingSystem = win.READIUM2.urlQueryParams[URL_PARAM_EPUBREADINGSYSTEM];
    if (base64EpubReadingSystem) {
        try {
            const str = window.atob(base64EpubReadingSystem);
            readiumEpubReadingSystemJson = JSON.parse(str);
        } catch (err) {
            console.log(err);
        }
    }

    if (readiumEpubReadingSystemJson) {
        setWindowNavigatorEpubReadingSystem(win, readiumEpubReadingSystemJson);
    }
}

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

    let delayScrollIntoView = false;
    if (payload.hash) {
        console.log("R2_EVENT_SCROLLTO payload.hash: " + payload.hash);
        win.READIUM2.hashElement = win.document.getElementById(payload.hash);

        win.location.href = "#" + payload.hash;
        delayScrollIntoView = true;

        // unfortunately, does not sync CSS :target pseudo-class :(
        // win.history.replaceState({}, undefined, "#" + payload.hash);
    } else {
        win.READIUM2.hashElement = null;
    }

    win.READIUM2.readyEventSent = false;
    win.READIUM2.locationHashOverride = undefined;
    win.READIUM2.locationHashOverrideInfo = {
        cfi: undefined,
        cssSelector: undefined,
        paginationInfo: undefined,
        position: undefined,
        progression: undefined,
    };

    if (delayScrollIntoView) {
        setTimeout(() => {
            scrollToHashRaw(false);
        }, 100);
    } else {
        scrollToHashRaw(false);
    }

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

    if (!win.document || !win.document.documentElement) {
        return;
    }

    const isPaged = isPaginated();

    const maxScrollShift = calculateMaxScrollShift();

    const goPREVIOUS = payload.go === "PREVIOUS"; // any other value is NEXT

    // const isRTL = messageJson.direction === "RTL"; //  any other value is LTR
    // console.log(JSON.stringify(messageJson, null, "  "));

    // https://javascript.info/size-and-scroll
    // offsetW/H: excludes margin, includes border, scrollbar, padding.
    // clientW/H: excludes margin, border, scrollbar, includes padding.
    // scrollW/H: like client, but includes hidden (overflow) areas

    if (!goPREVIOUS) { // goPREVIOUS && isRTL() || !goPREVIOUS && !isRTL()) { // right
        if (isPaged) {
            // console.log("element.scrollLeft: " + win.document.body.scrollLeft);
            if (isVerticalWritingMode() && (Math.abs(win.document.body.scrollTop) < maxScrollShift) ||
                !isVerticalWritingMode() && (Math.abs(win.document.body.scrollLeft) < maxScrollShift)) { // not at end
                if (_lastAnimState && _lastAnimState.animating) {
                    win.cancelAnimationFrame(_lastAnimState.id);
                    _lastAnimState.object[_lastAnimState.property] = _lastAnimState.destVal;
                }
                const newVal = isVerticalWritingMode() ?
                    (win.document.body.scrollTop + win.document.documentElement.offsetHeight) :
                        (win.document.body.scrollLeft + (isRTL() ? -1 : 1) * win.document.documentElement.offsetWidth);
                // console.log("element.scrollLeft NEW: " + newVal);
                _lastAnimState = animateProperty(
                    win.cancelAnimationFrame,
                    undefined,
                    // (cancelled: boolean) => {
                    //     console.log(cancelled);
                    // },
                    isVerticalWritingMode() ? "scrollTop" : "scrollLeft",
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
            if (isVerticalWritingMode() && (Math.abs(win.document.body.scrollLeft) < maxScrollShift) ||
                !isVerticalWritingMode() && (Math.abs(win.document.body.scrollTop) < maxScrollShift)) {
                if (_lastAnimState && _lastAnimState.animating) {
                    win.cancelAnimationFrame(_lastAnimState.id);
                    _lastAnimState.object[_lastAnimState.property] = _lastAnimState.destVal;
                }
                const newVal = isVerticalWritingMode() ?
                    (win.document.body.scrollLeft + (isRTL() ? -1 : 1) * win.document.documentElement.clientWidth) :
                    (win.document.body.scrollTop + win.document.documentElement.clientHeight);
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
            if (isVerticalWritingMode() && (Math.abs(win.document.body.scrollTop) > 0) ||
                !isVerticalWritingMode() && (Math.abs(win.document.body.scrollLeft) > 0)) { // not at begin
                if (_lastAnimState && _lastAnimState.animating) {
                    win.cancelAnimationFrame(_lastAnimState.id);
                    _lastAnimState.object[_lastAnimState.property] = _lastAnimState.destVal;
                }
                const newVal = isVerticalWritingMode() ?
                    (win.document.body.scrollTop - win.document.documentElement.offsetHeight) :
                    (win.document.body.scrollLeft - (isRTL() ? -1 : 1) * win.document.documentElement.offsetWidth);
                // console.log("element.scrollLeft NEW: " + newVal);
                _lastAnimState = animateProperty(
                    win.cancelAnimationFrame,
                    undefined,
                    // (cancelled: boolean) => {
                    //     console.log(cancelled);
                    // },
                    isVerticalWritingMode() ? "scrollTop" : "scrollLeft",
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
                    (win.document.body.scrollLeft - (isRTL() ? -1 : 1) * win.document.documentElement.clientWidth) :
                    (win.document.body.scrollTop - win.document.documentElement.clientHeight);
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

            if (!win.document || !win.document.documentElement) {
                return;
            }

            // https://javascript.info/size-and-scroll
            // offsetW/H: excludes margin, includes border, scrollbar, padding.
            // clientW/H: excludes margin, border, scrollbar, includes padding.
            // scrollW/H: like client, but includes hidden (overflow) areas

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

            // relative to fixed window top-left corner
            // (unlike pageX/Y which is relative to top-left rendered content area, subject to scrolling)
            const x = ev.clientX;
            const y = ev.clientY;

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

function scrollIntoView(_element: HTMLElement) {

    if (!win.document || !win.document.documentElement || !win.document.body || !isPaginated()) {
        return;
    }

    // console.log("element.offsetTop: " + element.offsetTop);
    // // console.log("element.getBoundingClientRect().top: " + element.getBoundingClientRect().top);
    // // console.log("element.offsetLeft: " + element.offsetLeft);
    // // console.log("element.getBoundingClientRect().left: " + element.getBoundingClientRect().left);

    // let offsetTop = element.offsetTop; // includes margin
    // let offsetParent = element.offsetParent;
    // while (offsetParent && (offsetParent as any).offsetTop) {
    //     offsetTop += (offsetParent as any).offsetTop;
    //     offsetParent = (offsetParent as any).offsetParent;
    // }
    // console.log("offsetTop: " + offsetTop);

    // // https://javascript.info/size-and-scroll
    // // offsetW/H: excludes margin, includes border, scrollbar, padding.
    // // clientW/H: excludes margin, border, scrollbar, includes padding.
    // // scrollW/H: like client, but includes hidden (overflow) areas

    // const totalColumns = calculateTotalColumns();

    // const progressionRatio = offsetTop / (win.document.body.scrollHeight * totalColumns);
    // console.log("progressionRatio: " + progressionRatio);

    // const isTwoPage = isTwoPageSpread();
    // const maxScrollShift = calculateMaxScrollShift();

    // currentColumn = adjustedTotalColumns * progressionRatio;

    // currentColumn = Math.round(currentColumn);
    // console.log("currentColumn: " + currentColumn);

    // spreadIndex = isTwoPage ? Math.floor(currentColumn / 2) : currentColumn;
    // console.log("spreadIndex: " + spreadIndex);

    // let colIndex = (element.offsetTop + (isRTL() ? -20 : +20)) / win.document.body.scrollHeight;
    // // console.log("colIndex: " + colIndex);
    // colIndex = Math.ceil(colIndex); // 1-based index

    // const isTwoPage = isTwoPageSpread();
    // const spreadIndex = isTwoPage ? Math.ceil(colIndex / 2) : colIndex;
    // // console.log("spreadIndex: " + spreadIndex);

    // // console.log("element.getBoundingClientRect().top: " + element.getBoundingClientRect().top);
    // // console.log("element.getBoundingClientRect().left: " + element.getBoundingClientRect().left);

    // // const top = (colIndex * win.document.body.scrollHeight) + element.getBoundingClientRect().top;
    // // console.log("top: " + top);

    // // const left = (colIndex * win.document.body.offsetWidth);
    // const left = ((spreadIndex - 1) * win.document.documentElement.offsetWidth);
    // // console.log("left: " + left);

    // win.document.body.scrollLeft = (isRTL() ? -1 : 1) * left;
}

const scrollToHashRaw = (firstCall: boolean) => {

    // console.log("scrollToHash: " + firstCall);

    if (!win.document || !win.document.documentElement) {
        return;
    }

    const isPaged = isPaginated();

    if (win.READIUM2.locationHashOverride) {

        // console.log("win.READIUM2.locationHashOverride");

        if (win.READIUM2.locationHashOverride === win.document.body) {
            console.log("body...");

            return;
        }

        notifyReady();

        _ignoreScrollEvent = true;
        if (isPaged) {
            scrollIntoView(win.READIUM2.locationHashOverride as HTMLElement);
        } else {
            win.READIUM2.locationHashOverride.scrollIntoView({
                // TypeScript lib.dom.d.ts difference in 3.2.1
                // ScrollBehavior = "auto" | "instant" | "smooth" VS ScrollBehavior = "auto" | "smooth"
                behavior: "auto",
                // ScrollLogicalPosition = "start" | "center" | "end" | "nearest"
                block: "start",
                // ScrollLogicalPosition = "start" | "center" | "end" | "nearest"
                inline: "start",
            } as ScrollIntoViewOptions);
        }

        notifyReadingLocation();
        return;
    } else if (win.READIUM2.hashElement) {

        console.log("win.READIUM2.hashElement");

        win.READIUM2.locationHashOverride = win.READIUM2.hashElement;
        // win.READIUM2.locationHashOverrideCSSselector =
        // fullQualifiedSelector(win.READIUM2.locationHashOverride, false);

        notifyReady();

        if (!firstCall) {
            _ignoreScrollEvent = true;
            if (isPaged) {
                scrollIntoView(win.READIUM2.hashElement as HTMLElement);
            } else {
                win.READIUM2.hashElement.scrollIntoView({
                    // TypeScript lib.dom.d.ts difference in 3.2.1
                    // ScrollBehavior = "auto" | "instant" | "smooth" VS ScrollBehavior = "auto" | "smooth"
                    behavior: "auto",
                    // ScrollLogicalPosition = "start" | "center" | "end" | "nearest"
                    block: "start",
                    // ScrollLogicalPosition = "start" | "center" | "end" | "nearest"
                    inline: "start",
                } as ScrollIntoViewOptions);
            }
        }

        // win.READIUM2.hashElement.classList.add("readium2-hash");
        // setTimeout(() => {
        //     if (win.READIUM2.hashElement) {
        //         win.READIUM2.hashElement.classList.remove("readium2-hash");
        //     }
        // }, 1000);

        notifyReadingLocation();
        return;
    } else {
        if (win.document.body) {

            if (win.READIUM2.urlQueryParams) {
                // tslint:disable-next-line:no-string-literal
                const previous = win.READIUM2.urlQueryParams[URL_PARAM_PREVIOUS];
                const isPreviousNavDirection = previous === "true";
                if (isPreviousNavDirection) {

                    console.log(URL_PARAM_PREVIOUS);

                    const maxScrollShift = calculateMaxScrollShift();

                    _ignoreScrollEvent = true;
                    if (isPaged) {
                        if (isVerticalWritingMode()) {
                            win.document.body.scrollLeft = 0;
                            win.document.body.scrollTop = maxScrollShift;
                        } else {
                            win.document.body.scrollLeft = (isRTL() ? -1 : 1) * maxScrollShift;
                            win.document.body.scrollTop = 0;
                        }
                    } else {
                        if (isVerticalWritingMode()) {
                            win.document.body.scrollLeft = (isRTL() ? -1 : 1) * maxScrollShift;
                            win.document.body.scrollTop = 0;
                        } else {
                            win.document.body.scrollLeft = 0;
                            win.document.body.scrollTop = maxScrollShift;
                        }
                    }

                    win.READIUM2.locationHashOverride = undefined;
                    win.READIUM2.locationHashOverrideInfo = {
                        cfi: undefined,
                        cssSelector: undefined,
                        paginationInfo: undefined,
                        position: undefined,
                        progression: undefined,
                    };

                    // https://javascript.info/size-and-scroll
                    // offsetW/H: excludes margin, includes border, scrollbar, padding.
                    // clientW/H: excludes margin, border, scrollbar, includes padding.
                    // scrollW/H: like client, but includes hidden (overflow) areas

                    // relative to fixed window top-left corner
                    const y = (isPaged ?
                        (isVerticalWritingMode() ?
                            win.document.documentElement.offsetWidth :
                            win.document.documentElement.offsetHeight) :
                        (isVerticalWritingMode() ?
                            win.document.documentElement.clientWidth :
                            win.document.documentElement.clientHeight))
                    - 1;
                    processXYRaw(0, y);

                    console.log("BOTTOM (previous):");
                    console.log(win.READIUM2.locationHashOverride);

                    notifyReady();
                    if (!win.READIUM2.locationHashOverride) { // already in processXYRaw()
                        notifyReadingLocation();
                    }
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
                        win.READIUM2.locationHashOverrideInfo = {
                            cfi: undefined,
                            cssSelector: gotoCssSelector,
                            paginationInfo: undefined,
                            position: undefined,
                            progression: undefined,
                        };

                        notifyReady();

                        _ignoreScrollEvent = true;
                        if (isPaged) {
                            scrollIntoView(selected as HTMLElement);
                        } else {
                            selected.scrollIntoView({
                                // TypeScript lib.dom.d.ts difference in 3.2.1
                                // ScrollBehavior = "auto" | "instant" | "smooth" VS ScrollBehavior = "auto" | "smooth"
                                behavior: "auto",
                                // ScrollLogicalPosition = "start" | "center" | "end" | "nearest"
                                block: "start",
                                // ScrollLogicalPosition = "start" | "center" | "end" | "nearest"
                                inline: "start",
                            } as ScrollIntoViewOptions);
                        }

                        notifyReadingLocation();
                        return;
                    }
                }
            }

            console.log("win.READIUM2.locationHashOverride = win.document.body");

            win.READIUM2.locationHashOverride = win.document.body;
            win.READIUM2.locationHashOverrideInfo = {
                cfi: undefined,
                cssSelector: undefined,
                paginationInfo: undefined,
                position: undefined,
                progression: undefined,
            };

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
        const base64ReadiumCSS = win.READIUM2.urlQueryParams[URL_PARAM_CSS];
        // if (!base64ReadiumCSS) {
        //     console.log("!readiumcss BASE64 ??!");
        //     const token = URL_PARAM_CSS + "=";
        //     const i = win.location.search.indexOf(token);
        //     if (i > 0) {
        //         base64ReadiumCSS = win.location.search.substr(i + token.length);
        //         const j = base64ReadiumCSS.indexOf("&");
        //         if (j > 0) {
        //             base64ReadiumCSS = base64ReadiumCSS.substr(0, j);
        //         }
        //         base64ReadiumCSS = decodeURIComponent(base64ReadiumCSS);
        //     }
        // }
        if (base64ReadiumCSS) {
            try {
                const str = window.atob(base64ReadiumCSS);
                readiumcssJson = JSON.parse(str);
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

        if (!win.document || !win.document.documentElement) {
            return;
        }

        const isPaged = isPaginated();
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

// relative to fixed window top-left corner
const processXYRaw = (x: number, y: number) => {
    // console.log("processXY: " + x + ", " + y);

    // https://javascript.info/size-and-scroll
    // offsetW/H: excludes margin, includes border, scrollbar, padding.
    // clientW/H: excludes margin, border, scrollbar, includes padding.
    // scrollW/H: like client, but includes hidden (overflow) areas

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

// function computeOffsetTop(element: HTMLElement): number {

//     // console.log("element.offsetTop: " + element.offsetTop);
//     // console.log("element.getBoundingClientRect().top: " + element.getBoundingClientRect().top);
//     // console.log("element.offsetLeft: " + element.offsetLeft);
//     // console.log("element.getBoundingClientRect().left: " + element.getBoundingClientRect().left);

//     let offsetTop = 0;
//     let offsetParent: Element | null = element;
//     while (offsetParent && (typeof (offsetParent as HTMLElement).offsetTop !== "undefined")) {
//         if ((offsetParent as HTMLElement).offsetTop) {
//             console.log("... offsetTop: " + (offsetParent as HTMLElement).offsetTop);
//         }
//         offsetTop += (offsetParent as HTMLElement).offsetTop;

//         const elementStyle = win.getComputedStyle(offsetParent);
//         if (elementStyle) {
//             const marginTopPropVal = elementStyle.getPropertyValue("margin-top");
//             const marginTop = parseInt(marginTopPropVal, 10);
//             if (marginTop) {
//                 console.log("... marginTop: " + marginTop);
//             }

//             offsetTop += marginTop;
//         }

//         offsetParent = (offsetParent as HTMLElement).offsetParent;
//     }

//     console.log("offsetTop: " + offsetTop);
//     return offsetTop;
// }
interface IProgressionData {
    percentRatio: number;
    paginationInfo: IEventPayload_R2_EVENT_READING_LOCATION_PAGINATION_INFO | undefined;
}
export const computeProgressionData = (): IProgressionData => {

    const isPaged = isPaginated();

    const isTwoPage = isTwoPageSpread();
    console.log("isTwoPage: " + isTwoPage);

    const maxScrollShift = calculateMaxScrollShift();
    console.log("maxScrollShift: " + maxScrollShift);

    const totalColumns = calculateTotalColumns();

    let progressionRatio = 0;

    // zero-based index: 0 <= currentColumn < totalColumns
    let currentColumn = 0;
    let spreadIndex = 0;

    // https://javascript.info/size-and-scroll
    // offsetW/H: excludes margin, includes border, scrollbar, padding.
    // clientW/H: excludes margin, border, scrollbar, includes padding.
    // scrollW/H: like client, but includes hidden (overflow) areas

    if (isPaged) {
        if (isVerticalWritingMode()) {
            progressionRatio = win.document.body.scrollTop / maxScrollShift;
        } else {
            progressionRatio = ((isRTL() ? -1 : 1) * win.document.body.scrollLeft) / maxScrollShift;
        }
        console.log("progressionRatio: " + progressionRatio);
        console.log("totalColumns: " + totalColumns);

        // because maxScrollShift excludes whole viewport width of content (0%-100% scroll but minus last page/spread)
        const adjustedTotalColumns = (totalColumns - (isTwoPage ? 2 : 1));

        currentColumn = adjustedTotalColumns * progressionRatio;

        currentColumn = Math.round(currentColumn);
        console.log("currentColumn: " + currentColumn);
    } else {
        if (isVerticalWritingMode()) {
            progressionRatio = ((isRTL() ? -1 : 1) * win.document.body.scrollLeft) / maxScrollShift;
        } else {
            progressionRatio = win.document.body.scrollTop / maxScrollShift;
        }
    }

    if (win.READIUM2.locationHashOverride) {
        const element = win.READIUM2.locationHashOverride as HTMLElement;

        // imprecise
        // const offsetTop = computeOffsetTop(element);

        const rect = element.getBoundingClientRect();
        // console.log("element.getBoundingClientRect().top: " + rect.top);
        // console.log("element.getBoundingClientRect().left: " + rect.left);
        // console.log("element.getBoundingClientRect().width: " + rect.width);
        // console.log("element.getBoundingClientRect().height: " + rect.height);
        let offset = 0;

        if (isPaged) {
            if (isVerticalWritingMode()) {
                offset = (currentColumn * win.document.body.scrollWidth) + rect.left +
                    (rect.top >= win.document.body.offsetHeight ?
                    win.document.body.scrollWidth : 0);
            } else {
                offset = (currentColumn * win.document.body.scrollHeight) + rect.top +
                    (rect.left >= win.document.body.offsetWidth ?
                    win.document.body.scrollHeight : 0);
            }

            console.log("getBoundingClientRect offset: " + offset);

            // https://javascript.info/size-and-scroll
            // offsetW/H: excludes margin, includes border, scrollbar, padding.
            // clientW/H: excludes margin, border, scrollbar, includes padding.
            // scrollW/H: like client, but includes hidden (overflow) areas

            // includes whitespace beyond bottom/end of document, to fill the unnocupied remainder of the column
            progressionRatio = offset /
                ((isVerticalWritingMode() ? win.document.body.scrollWidth : win.document.body.scrollHeight) *
                    totalColumns);
            // no end-padding whitespace
            // progressionRatio = offsetTop / ((isVerticalWritingMode() ? win.document.body.offsetWidth :
            // win.document.body.offsetHeight);
            console.log("progressionRatio elem: " + progressionRatio);

            currentColumn = totalColumns * progressionRatio;
            console.log("currentColumn elem 1: " + currentColumn);

            currentColumn = Math.floor(currentColumn);
            console.log("currentColumn elem 2: " + currentColumn);
        } else {
            // if (isVerticalWritingMode()) {
            // } else {
            // }
        }
    }

    if (isPaged) {
        spreadIndex = isTwoPage ? Math.floor(currentColumn / 2) : currentColumn;
        console.log("spreadIndex: " + spreadIndex);

        // if (bodyStyle) {
        //     let totalColumns_ = 0;
        //     if (isVerticalWritingMode()) {
        //         let propVal = bodyStyle.getPropertyValue("margin-top");
        //         const bodyMarginTop = parseInt(propVal, 10);
        //         console.log("body.marginTop: " + bodyMarginTop);

        //         propVal = bodyStyle.getPropertyValue("margin-bottom");
        //         const bodyMarginBottom = parseInt(propVal, 10);
        //         console.log("body.marginBottom: " + bodyMarginBottom);

        //         // TODO column gap?
        //         const bodyTotalHeight = win.document.body.offsetHeight + bodyMarginTop + bodyMarginBottom;
        //         console.log("body.offsetHeight + margins: " + bodyTotalHeight);

        //         totalColumns_ = win.document.body.scrollHeight / bodyTotalHeight;
        //     } else {
        //         let propVal = bodyStyle.getPropertyValue("margin-left");
        //         const bodyMarginLeft = parseInt(propVal, 10);
        //         console.log("body.marginLeft: " + bodyMarginLeft + " // " + propVal);

        //         propVal = bodyStyle.getPropertyValue("margin-right");
        //         const bodyMarginRight = parseInt(propVal, 10);
        //         console.log("body.marginRight: " + bodyMarginRight + " // " + propVal);

        //         // TODO column gap?
        //         const bodyTotalWidth = win.document.body.offsetWidth + bodyMarginLeft + bodyMarginRight;
        //         console.log("body.offsetWidth + margins: " + bodyTotalWidth);

        //         totalColumns_ = win.document.body.scrollWidth / bodyTotalWidth;
        //     }
        //     if (totalColumns_ !== totalColumns) {
        //         console.log("*** totalColumns!? " + totalColumns_);
        //     }
        // }
    }

    // debugCSSMetrics();

    return {
        paginationInfo: isPaged ? {
            currentColumn,
            isTwoPageSpread: isTwoPage,
            spreadIndex,
            totalColumns,
        } : undefined,
        percentRatio: progressionRatio,
    };
};

export const computeCFI = (node: Node): string | undefined => {

    // TODO: handle character position inside text node
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return undefined;
    }

    let cfi = "";

    let currentElement = node as Element;
    while (currentElement.parentNode && currentElement.parentNode.nodeType === Node.ELEMENT_NODE) {
        const currentElementChildren = (currentElement.parentNode as Element).children;
        let currentElementIndex = -1;
        for (let i = 0; i < currentElementChildren.length; i++) {
            if (currentElement === currentElementChildren[i]) {
                currentElementIndex = i;
                break;
            }
        }
        if (currentElementIndex >= 0) {
            const cfiIndex = (currentElementIndex + 1) * 2;
            cfi = cfiIndex +
                (currentElement.id ? ("[" + currentElement.id + "]") : "") +
                (cfi.length ? ("/" + cfi) : "");
        }
        currentElement = currentElement.parentNode as Element;
    }

    return "/" + cfi;
};

const notifyReadingLocationRaw = () => {
    if (!win.READIUM2.locationHashOverride) {
        return;
    }

    // win.READIUM2.locationHashOverride.nodeType === ELEMENT_NODE

    console.log("#######################################################");
    console.log("------- notifyReadingLocationRaw");

    let progressionData: IProgressionData | undefined;

    const cssSelector = fullQualifiedSelector(win.READIUM2.locationHashOverride, false);
    const cfi = computeCFI(win.READIUM2.locationHashOverride);
    let progression = 0;
    if (win.READIUM2.isFixedLayout) {
        progression = 1;
    } else {
        progressionData = computeProgressionData();
        progression = progressionData.percentRatio;
    }

    win.READIUM2.locationHashOverrideInfo = {
        cfi,
        cssSelector,
        paginationInfo: (progressionData && progressionData.paginationInfo) ?
            progressionData.paginationInfo : undefined,
        position: undefined, // calculated in host index.js renderer, where publication object is available
        progression,
    };
    const payload: IEventPayload_R2_EVENT_READING_LOCATION = win.READIUM2.locationHashOverrideInfo;
    ipcRenderer.sendToHost(R2_EVENT_READING_LOCATION, payload);

    if (DEBUG_VISUALS) {
        win.READIUM2.locationHashOverride.classList.add("readium2-read-pos");

        console.log("notifyReadingLocation CSS SELECTOR: " + cssSelector);
        console.log("notifyReadingLocation CFI: " + cfi);
        console.log("notifyReadingLocation PROGRESSION: " + progression);
    }
};
const notifyReadingLocation = debounce(() => {
    notifyReadingLocationRaw();
}, 500);
