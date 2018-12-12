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
import { uniqueCssSelector } from "../common/cssselector2";
import { easings } from "../common/easings";
import { getURLQueryParams } from "../common/querystring";
import { URL_PARAM_CSS, URL_PARAM_EPUBREADINGSYSTEM, URL_PARAM_GOTO, URL_PARAM_PREVIOUS } from "../common/url-params";
import { consoleRedirect } from "../console-redirect";
import { setWindowNavigatorEpubReadingSystem } from "./epubReadingSystem";
import {
    DEBUG_VISUALS,
    calculateColumnDimension,
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
import {
    readPosCssStylesAttr1,
    readPosCssStylesAttr2,
    readPosCssStylesAttr3,
    readPosCssStylesAttr4,
} from "./styles";

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

ipcRenderer.on(R2_EVENT_SCROLLTO, (_event: any, payload: IEventPayload_R2_EVENT_SCROLLTO) => {

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

    if (!goPREVIOUS) { // goPREVIOUS && isRTL() || !goPREVIOUS && !isRTL()) { // right
        if (isPaged) {
            if (isVerticalWritingMode() && (Math.abs(win.document.body.scrollTop) < maxScrollShift) ||
                !isVerticalWritingMode() && (Math.abs(win.document.body.scrollLeft) < maxScrollShift)) { // not at end
                if (_lastAnimState && _lastAnimState.animating) {
                    win.cancelAnimationFrame(_lastAnimState.id);
                    _lastAnimState.object[_lastAnimState.property] = _lastAnimState.destVal;
                }
                const newVal = isVerticalWritingMode() ?
                    (win.document.body.scrollTop + win.document.documentElement.offsetHeight) :
                        (win.document.body.scrollLeft + (isRTL() ? -1 : 1) * win.document.documentElement.offsetWidth);

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
            if (isVerticalWritingMode() && (Math.abs(win.document.body.scrollLeft) < maxScrollShift) ||
                !isVerticalWritingMode() && (Math.abs(win.document.body.scrollTop) < maxScrollShift)) {
                if (_lastAnimState && _lastAnimState.animating) {
                    win.cancelAnimationFrame(_lastAnimState.id);
                    _lastAnimState.object[_lastAnimState.property] = _lastAnimState.destVal;
                }
                const newVal = isVerticalWritingMode() ?
                    (win.document.body.scrollLeft + (isRTL() ? -1 : 1) * win.document.documentElement.clientWidth) :
                    (win.document.body.scrollTop + win.document.documentElement.clientHeight);

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

// window load event, after DOMContentLoaded
const checkReadyPass = () => {
    if (win.READIUM2.readyPassDone) {
        return;
    }
    win.READIUM2.readyPassDone = true;

    if (DEBUG_VISUALS) {
        if (win.READIUM2.hashElement) {
            // const existings = document.querySelectorAll(`*[${readPosCssStylesAttr1}]`);
            // existings.forEach((existing) => {
            //     existing.removeAttribute(`${readPosCssStylesAttr1}`);
            // });
            win.READIUM2.hashElement.setAttribute(readPosCssStylesAttr1, "checkReadyPass hashElement");
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

function scrollElementIntoView(element: Element) {

    if (DEBUG_VISUALS) {
        const existings = document.querySelectorAll(`*[${readPosCssStylesAttr3}]`);
        existings.forEach((existing) => {
            existing.removeAttribute(`${readPosCssStylesAttr3}`);
        });
        element.setAttribute(readPosCssStylesAttr3, "scrollElementIntoView");
    }

    const isPaged = isPaginated();
    if (isPaged) {
        scrollIntoView(element as HTMLElement);
    } else {
        element.scrollIntoView({
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

// TODO: vertical writing mode
function scrollIntoView(element: HTMLElement) {

    if (!win.document || !win.document.documentElement || !win.document.body || !isPaginated()) {
        return;
    }

    const rect = element.getBoundingClientRect();

    const columnDimension = calculateColumnDimension();

    const isTwoPage = isTwoPageSpread();

    const fullOffset = (isRTL() ? ((columnDimension * (isTwoPage ? 2 : 1)) - rect.left) : rect.left) +
        ((isRTL() ? -1 : 1) * win.document.body.scrollLeft);

    const columnIndex = Math.floor(fullOffset / columnDimension); // 0-based index

    const spreadIndex = isTwoPage ? Math.floor(columnIndex / 2) : columnIndex; // 0-based index

    win.document.body.scrollLeft = (isRTL() ? -1 : 1) *
        (spreadIndex * (columnDimension * (isTwoPage ? 2 : 1)));
}

const scrollToHashRaw = (firstCall: boolean) => {

    if (!win.document || !win.document.documentElement) {
        return;
    }

    const isPaged = isPaginated();

    if (win.READIUM2.locationHashOverride) {

        if (win.READIUM2.locationHashOverride === win.document.body) {
            return;
        }

        notifyReady();

        _ignoreScrollEvent = true;
        scrollElementIntoView(win.READIUM2.locationHashOverride);

        notifyReadingLocation();
        return;
    } else if (win.READIUM2.hashElement) {

        win.READIUM2.locationHashOverride = win.READIUM2.hashElement;

        notifyReady();

        if (!firstCall) {
            _ignoreScrollEvent = true;
            scrollElementIntoView(win.READIUM2.hashElement);
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

                    let selected: Element | null = null;
                    try {
                        selected = document.querySelector(gotoCssSelector);
                    } catch (err) {
                        console.log(err);
                    }
                    if (selected) {

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
                        scrollElementIntoView(selected);

                        notifyReadingLocation();
                        return;
                    }
                }
            }

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
    checkReadyPass();
});

// // does not occur when re-using same webview (src="href")
// win.addEventListener("unload", () => {
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
                if (win.READIUM2.locationHashOverride) {
                    scrollElementIntoView(win.READIUM2.locationHashOverride);
                }
            }, 30);
        }
    });

    win.document.addEventListener("click", (e) => {
        const href = (e.target as any).href;
        if (!href) {
            return;
        }

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

    // const elems = document.elementsFromPoint(x, y);

    // let element: Element | undefined = elems && elems.length ? elems[0] : undefined;
    let element: Element | undefined;

    // if ((document as any).caretPositionFromPoint) {
    //     const range = (document as any).caretPositionFromPoint(x, y);
    //     const node = range.offsetNode;
    //     const offset = range.offset;
    // } else if (document.caretRangeFromPoint) {
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

    if (element) {
        win.READIUM2.locationHashOverride = element;
        notifyReadingLocation();

        if (DEBUG_VISUALS) {
            const existings = document.querySelectorAll(`*[${readPosCssStylesAttr2}]`);
            existings.forEach((existing) => {
                existing.removeAttribute(`${readPosCssStylesAttr2}`);
            });
            element.setAttribute(readPosCssStylesAttr2, "processXYRaw");
        }
    }
};
const processXY = debounce((x: number, y: number) => {
    processXYRaw(x, y);
}, 300);

interface IProgressionData {
    percentRatio: number;
    paginationInfo: IEventPayload_R2_EVENT_READING_LOCATION_PAGINATION_INFO | undefined;
}
export const computeProgressionData = (): IProgressionData => {

    const isPaged = isPaginated();

    const isTwoPage = isTwoPageSpread();

    const maxScrollShift = calculateMaxScrollShift();

    const totalColumns = calculateTotalColumns();

    let progressionRatio = 0;

    // zero-based index: 0 <= currentColumn < totalColumns
    let currentColumn = 0;
    let spreadIndex = 0;

    if (isPaged) {
        if (isVerticalWritingMode()) {
            progressionRatio = win.document.body.scrollTop / maxScrollShift;
        } else {
            progressionRatio = ((isRTL() ? -1 : 1) * win.document.body.scrollLeft) / maxScrollShift;
        }

        // because maxScrollShift excludes whole viewport width of content (0%-100% scroll but minus last page/spread)
        const adjustedTotalColumns = (totalColumns - (isTwoPage ? 2 : 1));

        currentColumn = adjustedTotalColumns * progressionRatio;

        currentColumn = Math.round(currentColumn);
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
        let offset = 0;

        if (isPaged) {
            const columnDimension = calculateColumnDimension();

            if (isVerticalWritingMode()) {
                offset = (currentColumn * win.document.body.scrollWidth) + rect.left +
                    (rect.top >= columnDimension ? win.document.body.scrollWidth : 0);
            } else {
                offset = (currentColumn * win.document.body.scrollHeight) + rect.top +
                        (((isRTL() ?
                            (win.document.documentElement.clientWidth - (rect.left + rect.width)) :
                            rect.left) >= columnDimension) ? win.document.body.scrollHeight : 0);
            }

            // includes whitespace beyond bottom/end of document, to fill the unnocupied remainder of the column
            progressionRatio = offset /
                ((isVerticalWritingMode() ? win.document.body.scrollWidth : win.document.body.scrollHeight) *
                    totalColumns);

            currentColumn = totalColumns * progressionRatio;

            currentColumn = Math.floor(currentColumn);
        } else {
            if (isVerticalWritingMode()) {
                offset = ((isRTL() ? -1 : 1) * win.document.body.scrollLeft) + rect.left + (isRTL() ? rect.width : 0);
            } else {
                offset = win.document.body.scrollTop + rect.top;
            }

            progressionRatio = offset /
                (isVerticalWritingMode() ? win.document.body.scrollWidth : win.document.body.scrollHeight);
        }
    }

    if (isPaged) {
        spreadIndex = isTwoPage ? Math.floor(currentColumn / 2) : currentColumn;
    }

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

    let progressionData: IProgressionData | undefined;

    const cssSelector = uniqueCssSelector(win.READIUM2.locationHashOverride, win.document);
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
        const existings = document.querySelectorAll(`*[${readPosCssStylesAttr4}]`);
        existings.forEach((existing) => {
            existing.removeAttribute(`${readPosCssStylesAttr4}`);
        });
        win.READIUM2.locationHashOverride.setAttribute(readPosCssStylesAttr4, "notifyReadingLocationRaw");

        console.log("notifyReadingLocation CSS SELECTOR: " + cssSelector);
        console.log("notifyReadingLocation CFI: " + cfi);
        console.log("notifyReadingLocation PROGRESSION: " + progression);
    }
};
const notifyReadingLocation = debounce(() => {
    notifyReadingLocationRaw();
}, 500);
