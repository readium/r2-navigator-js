// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

// import { consoleRedirect } from "../common/console-redirect";
if (IS_DEV) {
    // tslint:disable-next-line:no-var-requires
    const cr = require("../common/console-redirect");
    // const releaseConsoleRedirect =
    cr.consoleRedirect("r2:navigator#electron/renderer/webview/preload", process.stdout, process.stderr, true);
}

import { LocatorLocations } from "@r2-shared-js/models/locator";
import { debounce } from "debounce";
import * as debug_ from "debug";
import { ipcRenderer } from "electron";
import * as tabbable from "tabbable";

import {
    IEventPayload_R2_EVENT_LINK,
    IEventPayload_R2_EVENT_LOCATOR_VISIBLE,
    IEventPayload_R2_EVENT_PAGE_TURN,
    IEventPayload_R2_EVENT_READING_LOCATION,
    IEventPayload_R2_EVENT_READING_LOCATION_PAGINATION_INFO,
    IEventPayload_R2_EVENT_READIUMCSS,
    IEventPayload_R2_EVENT_SCROLLTO,
    IEventPayload_R2_EVENT_WEBVIEW_READY,
    R2_EVENT_DEBUG_VISUALS,
    R2_EVENT_LINK,
    R2_EVENT_LOCATOR_VISIBLE,
    R2_EVENT_PAGE_TURN,
    R2_EVENT_PAGE_TURN_RES,
    R2_EVENT_READING_LOCATION,
    R2_EVENT_SCROLLTO,
    R2_EVENT_WEBVIEW_READY,
} from "../../common/events";
import {
    configureFixedLayout,
    injectDefaultCSS,
    injectReadPosCSS,
    isPaginated,
} from "../../common/readium-css-inject";
import {
    FOOTNOTES_DIALOG_CLASS,
    ROOT_CLASS_INVISIBLE_MASK,
    ROOT_CLASS_KEYBOARD_INTERACT,
    ROOT_CLASS_NO_FOOTNOTES,
    readPosCssStylesAttr1,
    readPosCssStylesAttr2,
    readPosCssStylesAttr3,
    readPosCssStylesAttr4,
} from "../../common/styles";
// import { READIUM2_ELECTRON_HTTP_PROTOCOL } from "../../common/sessions";
import { IPropertyAnimationState, animateProperty } from "../common/animateProperty";
import { uniqueCssSelector } from "../common/cssselector2";
import { easings } from "../common/easings";
import { PopupDialog } from "../common/popup-dialog";
import { getURLQueryParams } from "../common/querystring";
import {
    URL_PARAM_CSS,
    URL_PARAM_DEBUG_VISUALS,
    URL_PARAM_EPUBREADINGSYSTEM,
    URL_PARAM_GOTO,
    URL_PARAM_PREVIOUS,
} from "../common/url-params";
import { INameVersion, setWindowNavigatorEpubReadingSystem } from "./epubReadingSystem";
import {
    calculateColumnDimension,
    calculateMaxScrollShift,
    calculateTotalColumns,
    computeVerticalRTL,
    isRTL,
    isTwoPageSpread,
    isVerticalWritingMode,
    readiumCSS,
} from "./readium-css";
import { IElectronWebviewTagWindow } from "./state";

import ResizeSensor = require("css-element-queries/src/ResizeSensor");
// import ResizeSensor = require("resize-sensor/ResizeSensor");

// import { registerProtocol } from "@r2-navigator-js/electron/renderer/common/protocol";
// registerProtocol();

const debug = debug_("r2:navigator#electron/renderer/webview/preload");

const win = (global as any).window as IElectronWebviewTagWindow;
win.READIUM2 = {
    DEBUG_VISUALS: false,
    // dialogs = [],
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

// const _winAlert = win.alert;
win.alert = (...args: any[]) => {
    console.log.apply(win, args);
};
// const _winConfirm = win.confirm;
win.confirm = (...args: any[]): boolean => {
    console.log.apply(win, args);
    return false;
};
// const _winPrompt = win.prompt;
win.prompt = (...args: any[]): string => {
    console.log.apply(win, args);
    return "";
};

// setTimeout(() => {
//     if (window.alert) {
//         window.alert("window.alert!");
//     }
//     if (window.confirm) {
//         const ok = window.confirm("window.confirm?");
//         console.log(ok);
//     }
//     // NOT SUPPORTED: fatal error in console.
//     if (window.prompt) {
//         const str = window.prompt("window.prompt:");
//         console.log(str);
//     }
// }, 2000);

win.READIUM2.urlQueryParams = win.location.search ? getURLQueryParams(win.location.search) : undefined;

if (win.READIUM2.urlQueryParams) {
    let readiumEpubReadingSystemJson: INameVersion | undefined;

    // tslint:disable-next-line:no-string-literal
    const base64EpubReadingSystem = win.READIUM2.urlQueryParams[URL_PARAM_EPUBREADINGSYSTEM];
    if (base64EpubReadingSystem) {
        try {
            const str = new Buffer(base64EpubReadingSystem, "base64").toString("utf8");
            readiumEpubReadingSystemJson = JSON.parse(str);
        } catch (err) {
            debug(err);
        }
    }

    if (readiumEpubReadingSystemJson) {
        setWindowNavigatorEpubReadingSystem(win, readiumEpubReadingSystemJson);
    }

    win.READIUM2.DEBUG_VISUALS = win.READIUM2.urlQueryParams[URL_PARAM_DEBUG_VISUALS] === "true";
}

if (IS_DEV) {
    ipcRenderer.on(R2_EVENT_DEBUG_VISUALS, (_event: any, payload: string) => {
        win.READIUM2.DEBUG_VISUALS = payload === "true";

        if (!win.READIUM2.DEBUG_VISUALS) {
            const existings = win.document.querySelectorAll(
                // tslint:disable-next-line:max-line-length
                `*[${readPosCssStylesAttr1}], *[${readPosCssStylesAttr2}], *[${readPosCssStylesAttr3}], *[${readPosCssStylesAttr4}]`);
            existings.forEach((existing) => {
                existing.removeAttribute(`${readPosCssStylesAttr1}`);
                existing.removeAttribute(`${readPosCssStylesAttr2}`);
                existing.removeAttribute(`${readPosCssStylesAttr3}`);
                existing.removeAttribute(`${readPosCssStylesAttr4}`);
            });
        }
    });
}

function computeVisibility_(element: Element): boolean {
    if (win.READIUM2.isFixedLayout) {
        return true;
    } else if (!win.document || !win.document.documentElement || !win.document.body) {
        return false;
    }

    const rect = element.getBoundingClientRect();
    // debug(rect.top);
    // debug(rect.left);
    // debug(rect.width);
    // debug(rect.height);

    if (!isPaginated(win.document)) { // scroll

        // let offset = 0;
        // if (isVerticalWritingMode()) {
        //     offset = ((isRTL() ? -1 : 1) * win.document.body.scrollLeft) + rect.left + (isRTL() ? rect.width : 0);
        // } else {
        //     offset = win.document.body.scrollTop + rect.top;
        // }
        // const progressionRatio = offset /
        //     (isVerticalWritingMode() ? win.document.body.scrollWidth : win.document.body.scrollHeight);

        // TODO: vertical writing mode
        if ((rect.top + rect.height) >= 0 && rect.top <= win.document.documentElement.clientHeight) {
            return true;
        }
        // tslint:disable-next-line:max-line-length
        debug(`computeVisibility_ FALSE: getBoundingClientRect() TOP: ${rect.top} -- win.document.documentElement.clientHeight: ${win.document.documentElement.clientHeight}`);
        return false;
    }
    // TODO: vertical writing mode
    const scrollOffset = scrollOffsetIntoView(element as HTMLElement);
    const cur = win.document.body.scrollLeft;
    if (scrollOffset >= (cur - 10) && scrollOffset <= (cur + 10)) {
        return true;
    }
    // TODO: RTL
    if (!isRTL() && ((rect.left + rect.width) > 0)) {
        return true;
    }
    debug(`computeVisibility_ FALSE: scrollOffsetIntoView: ${scrollOffset} -- win.document.body.scrollLeft: ${cur}`);
    return false;
}
function computeVisibility(location: LocatorLocations): boolean {

    let visible = false;
    if (win.READIUM2.isFixedLayout) {
        visible = true;
    } else if (!win.document || !win.document.documentElement || !win.document.body) {
        visible = false;
    } else if (!location || !location.cssSelector) {
        visible = false;
    } else {
        // payload.location.cssSelector = payload.location.cssSelector.replace(/\+/g, " ");
        let selected: Element | null = null;
        try {
            selected = win.document.querySelector(location.cssSelector);
        } catch (err) {
            debug(err);
        }
        if (selected) {
            visible = computeVisibility_(selected);
        }
    }
    return visible;
}

ipcRenderer.on(R2_EVENT_LOCATOR_VISIBLE, (_event: any, payload: IEventPayload_R2_EVENT_LOCATOR_VISIBLE) => {

    payload.visible = computeVisibility(payload.location);
    ipcRenderer.sendToHost(R2_EVENT_LOCATOR_VISIBLE, payload);
});

ipcRenderer.on(R2_EVENT_SCROLLTO, (_event: any, payload: IEventPayload_R2_EVENT_SCROLLTO) => {

    destroyPopupFootnotesDialogs();

    _cancelInitialScrollCheck = true;

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
        win.READIUM2.urlQueryParams[URL_PARAM_GOTO] = payload.goto; // decodeURIComponent
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
        if (win.READIUM2.DEBUG_VISUALS) {
            if (win.READIUM2.hashElement) {
                // const existings = win.document.querySelectorAll(`*[${readPosCssStylesAttr1}]`);
                // existings.forEach((existing) => {
                //     existing.removeAttribute(`${readPosCssStylesAttr1}`);
                // });
                win.READIUM2.hashElement.setAttribute(readPosCssStylesAttr1, "R2_EVENT_SCROLLTO hashElement");
            }
        }

        win.location.href = "#" + payload.hash;
        delayScrollIntoView = true;

        // unfortunately, does not sync CSS :target pseudo-class :(
        // win.history.replaceState({}, undefined, "#" + payload.hash);
    } else {
        win.location.href = "#";
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
            scrollToHashRaw();
        }, 100);
    } else {
        scrollToHashRaw();
    }

    // const payload: IEventPayload_R2_EVENT_WEBVIEW_READY = {
    //     href: win.location.href,
    // };
    // ipcRenderer.sendToHost(R2_EVENT_WEBVIEW_READY, payload);
    // notifyReadingLocationDebounced();
});

let _lastAnimState: IPropertyAnimationState | undefined;

function elementCapturesKeyboardArrowKeys(target: Element): boolean {

    if (target.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }

    const editable = target.getAttribute("contenteditable");
    if (editable) {
        return true;
    }

    const arrayOfKeyboardCaptureElements = [ "input", "textarea" ];
    if (arrayOfKeyboardCaptureElements.indexOf(target.tagName.toLowerCase()) >= 0) {
        return true;
    }

    return false;
}

function onEventPageTurn(payload: IEventPayload_R2_EVENT_PAGE_TURN) {

    let leftRightKeyWasUsedInsideKeyboardCapture = false;
    if (win.document.activeElement && elementCapturesKeyboardArrowKeys(win.document.activeElement)) {
        const oldDate = (win.document.activeElement as any).r2_leftrightKeyboardTimeStamp;
        if (oldDate) {
            const newDate = new Date();
            const msDiff = newDate.getTime() - oldDate.getTime();
            if (msDiff <= 300) {
                leftRightKeyWasUsedInsideKeyboardCapture = true;
            }
        }
    }
    if (leftRightKeyWasUsedInsideKeyboardCapture) {
        return;
    }

    destroyPopupFootnotesDialogs();

    if (win.READIUM2.isFixedLayout || !win.document.body) {
        ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
        return;
    }

    if (!win.document || !win.document.documentElement) {
        return;
    }

    const isPaged = isPaginated(win.document);

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
                    //     debug(cancelled);
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
                    //     debug(cancelled);
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
                    //     debug(cancelled);
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
                    //     debug(cancelled);
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
}
ipcRenderer.on(R2_EVENT_PAGE_TURN, (_event: any, payload: IEventPayload_R2_EVENT_PAGE_TURN) => {
    // Because 'r2_leftrightKeyboardTimeStamp' is set AFTER the main window left/right keyboard handler!
    setTimeout(() => { // we could debounce too?
        onEventPageTurn(payload);
    }, 100);
});

// window load event, after DOMContentLoaded
const checkReadyPass = () => {
    if (win.READIUM2.readyPassDone) {
        return;
    }
    win.READIUM2.readyPassDone = true;

    // assumes debounced from outside (Electron's webview object embedded in original renderer process HTML)
    win.addEventListener("resize", () => {
        const wh = configureFixedLayout(win.document, win.READIUM2.isFixedLayout,
            win.READIUM2.fxlViewportWidth, win.READIUM2.fxlViewportHeight,
            win.innerWidth, win.innerHeight);
        if (wh) {
            win.READIUM2.fxlViewportWidth = wh.width;
            win.READIUM2.fxlViewportHeight = wh.height;
        }

        scrollToHashRaw();
        // scrollToHash(); // debounced
    });

    // const docElement = win.document.documentElement;
    // let skipFirstResize = docElement.getAttribute("data-readiumcss") || false;
    // let skipFirstScroll = skipFirstResize;

    setTimeout(() => {
        // if (!win.READIUM2.isFixedLayout) {
        //     scrollToHashRaw();
        // }

        win.addEventListener("scroll", (_ev: UIEvent) => {

            if (win.document && win.document.documentElement &&
                win.document.documentElement.classList.contains(FOOTNOTES_DIALOG_CLASS)) {
                return;
            }

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
            processXYDebounced(x, 0);
        });

    }, 800);

    const useResizeSensor = !win.READIUM2.isFixedLayout;
    if (useResizeSensor && win.document.body) {

        setTimeout(() => {
            window.requestAnimationFrame((_timestamp) => {
                // tslint:disable-next-line:no-unused-expression
                new ResizeSensor(win.document.body, () => {

                    debug("ResizeSensor");
                    scrollToHashDebounced();
                });
            });
        }, 2000);
    }

    if (win.document.body) {
        win.document.body.addEventListener("click", (ev: MouseEvent) => {

            if (win.document && win.document.documentElement &&
                win.document.documentElement.classList.contains(FOOTNOTES_DIALOG_CLASS)) {
                return;
            }

            // relative to fixed window top-left corner
            // (unlike pageX/Y which is relative to top-left rendered content area, subject to scrolling)
            const x = ev.clientX;
            const y = ev.clientY;

            processXYDebounced(x, y);
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

    if (win.READIUM2.DEBUG_VISUALS) {
        const existings = win.document.querySelectorAll(`*[${readPosCssStylesAttr3}]`);
        existings.forEach((existing) => {
            existing.removeAttribute(`${readPosCssStylesAttr3}`);
        });
        element.setAttribute(readPosCssStylesAttr3, "scrollElementIntoView");
    }

    const isPaged = isPaginated(win.document);
    if (isPaged) {
        scrollIntoView(element as HTMLElement);
    } else {
        const rect = element.getBoundingClientRect();
        // calculateMaxScrollShift()
        // TODO: vertical writing mode
        const scrollTopMax = win.document.body.scrollHeight - win.document.documentElement.clientHeight;
        let offset = win.document.body.scrollTop + (rect.top - (win.document.documentElement.clientHeight / 2));
        if (offset > scrollTopMax) {
            offset = scrollTopMax;
        } else if (offset < 0) {
            offset = 0;
        }
        win.document.body.scrollTop = offset;
        // element.scrollIntoView({
        //     // TypeScript lib.dom.d.ts difference in 3.2.1
        //     // ScrollBehavior = "auto" | "instant" | "smooth" VS ScrollBehavior = "auto" | "smooth"
        //     behavior: "auto",
        //     // ScrollLogicalPosition = "start" | "center" | "end" | "nearest"
        //     block: "center",
        //     // ScrollLogicalPosition = "start" | "center" | "end" | "nearest"
        //     inline: "nearest",
        // } as ScrollIntoViewOptions);
    }
}

// TODO: vertical writing mode
function scrollOffsetIntoView(element: HTMLElement): number {
    if (!win.document || !win.document.documentElement || !win.document.body || !isPaginated(win.document)) {
        return 0;
    }

    const rect = element.getBoundingClientRect();

    const columnDimension = calculateColumnDimension();

    const isTwoPage = isTwoPageSpread();

    const fullOffset = (isRTL() ? ((columnDimension * (isTwoPage ? 2 : 1)) - rect.left) : rect.left) +
        ((isRTL() ? -1 : 1) * win.document.body.scrollLeft);

    const columnIndex = Math.floor(fullOffset / columnDimension); // 0-based index

    const spreadIndex = isTwoPage ? Math.floor(columnIndex / 2) : columnIndex; // 0-based index

    return (isRTL() ? -1 : 1) *
        (spreadIndex * (columnDimension * (isTwoPage ? 2 : 1)));
}

// TODO: vertical writing mode
function scrollIntoView(element: HTMLElement) {
    if (!win.document || !win.document.documentElement || !win.document.body || !isPaginated(win.document)) {
        return;
    }
    win.document.body.scrollLeft = scrollOffsetIntoView(element);
}

// let scrollToHashRawFirstCall = true;
const scrollToHashRaw = () => {
    // let first = false;
    // if (scrollToHashRawFirstCall) {
    //     scrollToHashRawFirstCall = false;
    //     first = true;
    // }

    if (!win.document || !win.document.documentElement) {
        return;
    }

    const isPaged = isPaginated(win.document);

    if (win.READIUM2.locationHashOverride) {
        if (win.READIUM2.locationHashOverride === win.document.body) {
            return;
        }

        notifyReady();

        _ignoreScrollEvent = true;
        scrollElementIntoView(win.READIUM2.locationHashOverride);

        notifyReadingLocationDebounced();
        return;
    } else if (win.READIUM2.hashElement) {
        win.READIUM2.locationHashOverride = win.READIUM2.hashElement;

        notifyReady();

        // if (!first) {
        _ignoreScrollEvent = true;
        scrollElementIntoView(win.READIUM2.hashElement);
        // }

        // win.READIUM2.hashElement.classList.add("readium2-hash");
        // setTimeout(() => {
        //     if (win.READIUM2.hashElement) {
        //         win.READIUM2.hashElement.classList.remove("readium2-hash");
        //     }
        // }, 1000);

        notifyReadingLocationDebounced();
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

                    showHideContentMask(false);

                    notifyReady();
                    if (!win.READIUM2.locationHashOverride) { // already in processXYRaw()
                        notifyReadingLocationDebounced();
                    }
                    return;
                }

                // tslint:disable-next-line:no-string-literal
                const gto = win.READIUM2.urlQueryParams[URL_PARAM_GOTO];
                let gotoCssSelector: string | undefined;
                if (gto) {
                    // decodeURIComponent
                    const s = new Buffer(gto, "base64").toString("utf8");
                    const js = JSON.parse(s);
                    gotoCssSelector = (js as LocatorLocations).cssSelector;
                    // TODO: CFI, etc.?
                }
                if (gotoCssSelector) {
                    gotoCssSelector = gotoCssSelector.replace(/\+/g, " ");
                    let selected: Element | null = null;
                    try {
                        selected = win.document.querySelector(gotoCssSelector);
                    } catch (err) {
                        debug(err);
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

                        notifyReadingLocationDebounced();
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
    notifyReadingLocationDebounced();
};

const scrollToHashDebounced = debounce(() => {
    scrollToHashRaw();
}, 500);

let _ignoreScrollEvent = false;

// function testReadiumCSS(readiumcssJson: IEventPayload_R2_EVENT_READIUMCSS | undefined) {
//     const oldHTML = win.document.documentElement.outerHTML;
//     const iBody = oldHTML.indexOf("<body");
//     debug(oldHTML.substr(0, iBody + 100));

//     let newHTML: string | undefined;
//     try {
//         newHTML = transformHTML(oldHTML, readiumcssJson, "application/xhtml+xml");
//     } catch (err) {
//         debug(err);
//         return;
//     }

//     const iBody_ = newHTML.indexOf("<body");
//     debug(newHTML.substr(0, iBody_ + 100));
// }

function showHideContentMask(doHide: boolean) {
    if (win.document.body) {
        if (win.READIUM2.urlQueryParams) {
            // tslint:disable-next-line:no-string-literal
            const previous = win.READIUM2.urlQueryParams[URL_PARAM_PREVIOUS];
            const isPreviousNavDirection = previous === "true";
            if (isPreviousNavDirection) {
                if (doHide) {
                    win.document.body.classList.add(ROOT_CLASS_INVISIBLE_MASK);
                } else {
                    win.document.body.classList.remove(ROOT_CLASS_INVISIBLE_MASK);
                }
            }
        }
    }
}

function focusScrollRaw(tab: HTMLOrSVGElement, doFocus: boolean) {
    win.READIUM2.locationHashOverride = tab as HTMLElement;
    scrollElementIntoView(win.READIUM2.locationHashOverride);
    if (doFocus) {
        setTimeout(() => {
            tab.focus();
        }, 10);
    }
}
const focusScrollDebounced = debounce((tab: HTMLOrSVGElement, doFocus: boolean) => {
    focusScrollRaw(tab, doFocus);
}, 20);

let _ignoreFocusInEvent = false;

function handleTab(target: HTMLElement, evt: KeyboardEvent | undefined) {
    if (!target || !win.document.body) {
        return;
    }

    _ignoreFocusInEvent = false;

    const tabbables = tabbable(win.document.body);
    // debug(tabbables);
    const i = tabbables.indexOf(target);
    if (i === 0) {
        // debug("FIRST TABBABLE");
        if (!evt || evt.shiftKey) { // prevent the webview from cycling scroll (yet focus leaves)
            _ignoreFocusInEvent = true;
            focusScrollDebounced(target as HTMLElement, false);
            return;
        }
        if (i < (tabbables.length - 1)) {
            // debug("TABBABLE FORWARD >>");
            evt.preventDefault();
            const nextTabbable = tabbables[i + 1];
            focusScrollDebounced(nextTabbable as HTMLElement, true);
            return;
        }
    } else if (i === (tabbables.length - 1)) {
        // debug("LAST TABBABLE");
        if (!evt || !evt.shiftKey) { // prevent the webview from cycling scroll (yet focus leaves)
            _ignoreFocusInEvent = true;
            focusScrollDebounced(target as HTMLElement, false);
            return;
        }
        if (i > 0) {
            // debug("TABBABLE BACKWARD <<");
            evt.preventDefault();
            const previousTabbable = tabbables[i - 1];
            focusScrollDebounced(previousTabbable as HTMLElement, true);
            return;
        }
    } else if (i > 0) {
        // debug("TABBABLE: " + i);
        if (evt) {
            if (evt.shiftKey) {
                // debug("TABBABLE BACKWARD <<");
                evt.preventDefault();
                const previousTabbable = tabbables[i - 1];
                focusScrollDebounced(previousTabbable as HTMLElement, true);
                return;
            } else {
                // debug("TABBABLE FORWARD >>");
                evt.preventDefault();
                const nextTabbable = tabbables[i + 1];
                focusScrollDebounced(nextTabbable as HTMLElement, true);
                return;
            }
        }
    }
}

win.addEventListener("DOMContentLoaded", () => {

    _cancelInitialScrollCheck = true;

    // const linkUri = new URI(win.location.href);

    if (win.location.hash && win.location.hash.length > 1) {
        win.READIUM2.hashElement = win.document.getElementById(win.location.hash.substr(1));
        if (win.READIUM2.DEBUG_VISUALS) {
            if (win.READIUM2.hashElement) {
                // const existings = win.document.querySelectorAll(`*[${readPosCssStylesAttr1}]`);
                // existings.forEach((existing) => {
                //     existing.removeAttribute(`${readPosCssStylesAttr1}`);
                // });
                win.READIUM2.hashElement.setAttribute(readPosCssStylesAttr1, "DOMContentLoaded hashElement");
            }
        }
    }

    win.READIUM2.locationHashOverride = undefined;
    win.READIUM2.readyPassDone = false;
    win.READIUM2.readyEventSent = false;

    let readiumcssJson: IEventPayload_R2_EVENT_READIUMCSS | undefined;
    if (win.READIUM2.urlQueryParams) {
        // tslint:disable-next-line:no-string-literal
        const base64ReadiumCSS = win.READIUM2.urlQueryParams[URL_PARAM_CSS];
        if (base64ReadiumCSS) {
            let str: string | undefined;
            try {
                str = new Buffer(base64ReadiumCSS, "base64").toString("utf8");
                readiumcssJson = JSON.parse(str);
            } catch (err) {
                debug("################## READIUM CSS PARSE ERROR?!");
                debug(base64ReadiumCSS);
                debug(err);
                debug(str);
            }
        }
    }

    if (readiumcssJson) {
        win.READIUM2.isFixedLayout = (typeof readiumcssJson.isFixedLayout !== "undefined") ?
            readiumcssJson.isFixedLayout : false;
    }

    if (!win.READIUM2.isFixedLayout) {
        // only applies to previous nav spine item reading order
        showHideContentMask(true);
    }

    // testReadiumCSS(readiumcssJson);

    const wh = configureFixedLayout(win.document, win.READIUM2.isFixedLayout,
        win.READIUM2.fxlViewportWidth, win.READIUM2.fxlViewportHeight,
        win.innerWidth, win.innerHeight);
    if (wh) {
        win.READIUM2.fxlViewportWidth = wh.width;
        win.READIUM2.fxlViewportHeight = wh.height;
    }
    // if (win.READIUM2.isFixedLayout) {
    //     notifyReady();
    // }

    const alreadedInjected = win.document.documentElement.hasAttribute("data-readiumcss");
    if (alreadedInjected) {
        debug(">>>>>1 ReadiumCSS already injected by streamer");
        console.log(">>>>>2 ReadiumCSS already injected by streamer");
    }

    if (!alreadedInjected) {
        injectDefaultCSS(win.document);
        if (IS_DEV) { // win.READIUM2.DEBUG_VISUALS
            injectReadPosCSS(win.document);
        }
    }

    win.document.body.addEventListener("focusin", (ev: any) => {

        if (win.document && win.document.documentElement &&
            win.document.documentElement.classList.contains(FOOTNOTES_DIALOG_CLASS)) {
            return;
        }

        if (_ignoreFocusInEvent) {
            _ignoreFocusInEvent = false;
            return;
        }

        if (ev.target) {
            handleTab(ev.target as HTMLElement, undefined);
        }
        // if (!win.document) {
        //     return;
        // }
        // const isPaged = isPaginated(win.document);
        // if (isPaged) {
        // }
    });

    win.document.body.addEventListener("keydown", (ev: KeyboardEvent) => {

        if (win.document && win.document.documentElement &&
            win.document.documentElement.classList.contains(FOOTNOTES_DIALOG_CLASS)) {
            return;
        }

        const TAB_KEY = 9;
        if (ev.which === TAB_KEY) {
            if (ev.target) {
                handleTab(ev.target as HTMLElement, ev);
            }
        }
        // if (!win.document) {
        //     return;
        // }
        // const isPaged = isPaginated(win.document);
        // if (isPaged) {
        // }
    }, true);

    win.document.documentElement.addEventListener("keydown", (ev: KeyboardEvent) => {

        if (win.document && win.document.documentElement) {
            win.document.documentElement.classList.add(ROOT_CLASS_KEYBOARD_INTERACT);
        }
        if (ev.keyCode === 37 || ev.keyCode === 39) { // left / right
            if (ev.target && elementCapturesKeyboardArrowKeys(ev.target as Element)) {
                (ev.target as any).r2_leftrightKeyboardTimeStamp = new Date();
            }
        }
    }, true);

    win.document.documentElement.addEventListener("mousedown", (_ev: MouseEvent) => {

        if (win.document && win.document.documentElement) {
            win.document.documentElement.classList.remove(ROOT_CLASS_KEYBOARD_INTERACT);
        }
    }, true);

    win.document.addEventListener("click", (e: MouseEvent) => {

        // TODO? xlink:href
        const href = (e.target as any).href;
        // const href = (e.target as Element).getAttribute("href");
        if (!href) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const done = popupFootNote(e.target as HTMLElement, href);
        if (!done) {
            const payload: IEventPayload_R2_EVENT_LINK = {
                url: href,
            };
            ipcRenderer.sendToHost(R2_EVENT_LINK, payload);
        }

        return false;
    }, true);

    // injectResizeSensor();

    computeVerticalRTL();
    if (readiumcssJson) {
        // ReadiumCSS already injected at the streamer level?
        if (isVerticalWritingMode() || // force update, because needs getComputedStyle()
            !alreadedInjected) {

            debug(">>>>>> ReadiumCSS inject again");
            readiumCSS(win.document, readiumcssJson);
        }
    }
});

function destroyPopupFootnotesDialogs() {
    const dialogs = win.document.querySelectorAll(`dialog[open]`);
    dialogs.forEach((dialog) => {
        if ((dialog as any).popDialog) {
            // ((dialog as any).popDialog as PopupDialog).hide();
            ((dialog as any).popDialog as PopupDialog).cancelRefocus();
            (dialog as HTMLDialogElement).close();
        }
    });
}

function popupFootNote(element: HTMLElement, href: string): boolean {

    if (!win.document || !win.document.documentElement ||
        win.document.documentElement.classList.contains(ROOT_CLASS_NO_FOOTNOTES)) {
        return false;
    }
    let epubType = element.getAttribute("epub:type");
    if (!epubType) {
        epubType = element.getAttributeNS("http://www.idpf.org/2007/ops", "type");
    }
    if (!epubType) {
        return false;
    }

    // epubType.indexOf("biblioref") >= 0 ||
    // epubType.indexOf("glossref") >= 0 ||
    // epubType.indexOf("annoref") >= 0
    const isNoteref = epubType.indexOf("noteref") >= 0;
    if (!isNoteref) {
        return false;
    }

    const url = new URL(href); // includes #
    if (!url.hash) {
        return false;
    }
    // const targetElement = win.document.getElementById(url.hash.substr(1));
    const targetElement = win.document.querySelector(url.hash);
    if (!targetElement) {
        return false;
    }

    const ID_PREFIX = "r2-footnote-popup-dialog-for_";
    const id = ID_PREFIX + targetElement.id;
    const existingDialog = win.document.getElementById(id);
    if (existingDialog) {
        ((existingDialog as any).popDialog as PopupDialog).show(element);
        return true;
    }

    let outerHTML = targetElement.outerHTML;
    if (!outerHTML) {
        return false;
    }

    outerHTML = outerHTML.replace(/xmlns=["']http:\/\/www.w3.org\/1999\/xhtml["']/g, " ");
    outerHTML = outerHTML.replace(/xmlns:epub=["']http:\/\/www.idpf.org\/2007\/ops["']/g, " ");
    outerHTML = outerHTML.replace(/epub:type=["'][^"']+["']/g, " ");
    outerHTML = outerHTML.replace(/<script>.+<\/script>/g, " ");

    const ID_PREFIX_ = "r2-footnote-content-of_";
    const id_ = ID_PREFIX_ + targetElement.id;
    outerHTML = outerHTML.replace(/id=["'][^"']+["']/, `id="${id_}"`);

    // outerHTML = outerHTML.replace(/click=["']javascript:.+["']/g, " ");
    // debug(outerHTML);

    // import * as xmldom from "xmldom";
    // const dom = new xmldom.DOMParser().parseFromString(outerHTML, "application/xhtml+xml");

    // const payload_: IEventPayload_R2_EVENT_LINK_FOOTNOTE = {
    //     hash: url.hash,
    //     html: outerHTML,
    //     url: href,
    // };
    // ipcRenderer.sendToHost(R2_EVENT_LINK_FOOTNOTE, payload_);

    function focusScroll(el: HTMLOrSVGElement, doFocus: boolean) {
        focusScrollRaw(el, doFocus);
    }
    const pop = new PopupDialog(win.document, outerHTML, id, focusScroll);

    pop.show(element);
    return true;
}

let _cancelInitialScrollCheck = false;
// after DOMContentLoaded
win.addEventListener("load", () => {
    // computeVerticalRTL();

    if (!win.READIUM2.isFixedLayout) {
        scrollToHashRaw();
        _cancelInitialScrollCheck = false;
        setTimeout(() => {
            if (_cancelInitialScrollCheck) {
                return;
            }
            if (!isPaginated(win.document)) {
                // scrollToHashRaw();
                return;
            }
            let visible = false;
            if (win.READIUM2.locationHashOverride) {
                visible = computeVisibility_(win.READIUM2.locationHashOverride);
            } else if (win.READIUM2.hashElement) {
                visible = computeVisibility_(win.READIUM2.hashElement);
            }
            if (!visible) {
                debug("!visible (delayed layout pass?) => forcing second scrollToHashRaw()...");
                scrollToHashRaw();
            }
        }, 500);
    } else {
        processXYDebounced(0, 0);
        notifyReady();
    }

    checkReadyPass();
});

// // does not occur when re-using same webview (src="href")
// win.addEventListener("unload", () => {
// });

// relative to fixed window top-left corner
const processXYRaw = (x: number, y: number) => {

    // const elems = win.document.elementsFromPoint(x, y);

    // let element: Element | undefined = elems && elems.length ? elems[0] : undefined;
    let element: Element | undefined;

    // if ((win.document as any).caretPositionFromPoint) {
    //     const range = (win.document as any).caretPositionFromPoint(x, y);
    //     const node = range.offsetNode;
    //     const offset = range.offset;
    // } else if (win.document.caretRangeFromPoint) {
    // }

    // let textNode: Node | undefined;
    // let textNodeOffset = 0;

    const range = win.document.caretRangeFromPoint(x, y);
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
        if (x !== 0 && y !== 0) {
            ttsPlayback(element);
        }

        win.READIUM2.locationHashOverride = element;
        notifyReadingLocationDebounced();

        if (win.READIUM2.DEBUG_VISUALS) {
            const existings = win.document.querySelectorAll(`*[${readPosCssStylesAttr2}]`);
            existings.forEach((existing) => {
                existing.removeAttribute(`${readPosCssStylesAttr2}`);
            });
            element.setAttribute(readPosCssStylesAttr2, "processXYRaw");
        }
    }
};
const processXYDebounced = debounce((x: number, y: number) => {
    processXYRaw(x, y);
}, 300);

interface IProgressionData {
    percentRatio: number;
    paginationInfo: IEventPayload_R2_EVENT_READING_LOCATION_PAGINATION_INFO | undefined;
}
export const computeProgressionData = (): IProgressionData => {

    const isPaged = isPaginated(win.document);

    const isTwoPage = isTwoPageSpread();

    const maxScrollShift = calculateMaxScrollShift();

    const totalColumns = calculateTotalColumns();

    let progressionRatio = 0;

    // zero-based index: 0 <= currentColumn < totalColumns
    let currentColumn = 0;
    let spreadIndex = 0;

    if (isPaged) {
        if (maxScrollShift <= 0) {
            progressionRatio = 0;
        } else {
            if (isVerticalWritingMode()) {
                progressionRatio = win.document.body.scrollTop / maxScrollShift;
            } else {
                progressionRatio = ((isRTL() ? -1 : 1) * win.document.body.scrollLeft) / maxScrollShift;
            }
        }

        // because maxScrollShift excludes whole viewport width of content (0%-100% scroll but minus last page/spread)
        const adjustedTotalColumns = (totalColumns - (isTwoPage ? 2 : 1));

        currentColumn = adjustedTotalColumns * progressionRatio;

        currentColumn = Math.round(currentColumn);
    } else {
        if (maxScrollShift <= 0) {
            progressionRatio = 0;
        } else {
            if (isVerticalWritingMode()) {
                progressionRatio = ((isRTL() ? -1 : 1) * win.document.body.scrollLeft) / maxScrollShift;
            } else {
                progressionRatio = win.document.body.scrollTop / maxScrollShift;
            }
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

function ttsPlayback(elem: Element) {
    // Paragraphs split:
    // .split(/(?:\s*\r?\n\s*){2,}/)
    const txtSelection = win.getSelection().toString().trim();
    let txt = txtSelection || elem.textContent;
    if (!txt) {
        return;
    }
    txt = txt.trim().replace(/\n/g, " ").replace(/&/g, "&amp;");

    // debug("SpeechSynthesisUtterance:");
    // debug(txt);

    // if (win.speechSynthesis.speaking) {
    //     win.speechSynthesis.pause();
    // }
    // if (win.speechSynthesis.pending) {
    //     win.speechSynthesis.cancel();
    // }
    win.speechSynthesis.cancel();

    destroyPopupFootnotesDialogs();

    const idTtsTxt = "r2-tts-txt";
    // tslint:disable-next-line:max-line-length
    // const outerHTML = `<textarea id="${idTtsTxt}" style="font-family: inherit; font-size: inherit; height: 400px; width: 600px; overflow: auto;">${txt}</textarea>`;
    // tslint:disable-next-line:max-line-length
    const outerHTML = `<div id="${idTtsTxt}">${txt}</div>`;

    const idTtsDialog = "r2-tts-dialog";
    let existingDialog = win.document.getElementById(idTtsDialog) as HTMLDialogElement;
    if (existingDialog) {
        (existingDialog as any).popDialog = undefined;
        existingDialog.remove();
    }

    function focusScroll(el: HTMLOrSVGElement, doFocus: boolean) {
        focusScrollRaw(el, doFocus);

        setTimeout(() => {
            // if (win.speechSynthesis.speaking) {
            //     win.speechSynthesis.pause();
            // }
            win.speechSynthesis.cancel();
        }, 0);
    }
    const pop = new PopupDialog(win.document, outerHTML, idTtsDialog, focusScroll);
    pop.show(elem);

    // const txtarea = win.document.getElementById(idTtsTxt) as HTMLTextAreaElement;
    // txtarea.readOnly = true;
    // // txtarea.disabled = true;

    const utterance = new SpeechSynthesisUtterance(txt);
    existingDialog = win.document.getElementById(idTtsDialog) as HTMLDialogElement;
    (existingDialog as any).ttsUtterance = utterance;
    // utterance.text
    // utterance.voice
    // utterance.rate
    // utterance.pitch
    // utterance.volume
    // utterance.lang
    utterance.onboundary = (ev: SpeechSynthesisEvent) => {
        if (ev.name !== "word") {
            return;
        }
        const ttsDialog = win.document.getElementById(idTtsDialog) as HTMLDialogElement;
        if (!ttsDialog.open) {
            return;
        }
        // const textarea = win.document.getElementById(idTtsTxt) as HTMLTextAreaElement;
        // if (!textarea || !textarea.value) {
        //     return;
        // }
        const textP = win.document.getElementById(idTtsTxt) as HTMLElement;
        if (!textP) {
            return;
        }

        const text = utterance.text;
        const start = text.slice(0, ev.charIndex + 1).search(/\S+$/);
        const right = text.slice(ev.charIndex).search(/\s/);
        const word = right < 0 ? text.slice(start) : text.slice(start, right + ev.charIndex);
        const end = start + word.length;
        // debug(word);

        const prefix = "<span id=\"r2-tts-active-word\">";
        const suffix = "</span>";

        const fullTxt = `${text.substr(0, start)}${prefix}${word}${suffix}${text.substr(end)}`;
        // textarea.value = fullTxt.substring(0, end);
        // textarea.scrollTop = textarea.scrollHeight;
        // textarea.value = fullTxt;
        // textarea.focus();
        // const offset = prefix.length;
        // textarea.setSelectionRange(start + offset, end + offset);
        textP.innerHTML = fullTxt;
        setTimeout(() => {
            const span = win.document.getElementById("r2-tts-active-word") as HTMLElement;
            if (span) {
                const rect = span.getBoundingClientRect();
                const rect2 = textP.getBoundingClientRect();
                const scrollTopMax = textP.scrollHeight - textP.clientHeight;
                let offset = textP.scrollTop + (rect.top - rect2.top - (textP.clientHeight / 2));
                if (offset > scrollTopMax) {
                    offset = scrollTopMax;
                } else if (offset < 0) {
                    offset = 0;
                }
                textP.scrollTop = offset;

                // span.focus();
                // span.scrollIntoView({
                //     // TypeScript lib.dom.d.ts difference in 3.2.1
                //     // ScrollBehavior = "auto" | "instant" | "smooth" VS ScrollBehavior = "auto" | "smooth"
                //     behavior: "auto",
                //     // ScrollLogicalPosition = "start" | "center" | "end" | "nearest"
                //     block: "center",
                //     // ScrollLogicalPosition = "start" | "center" | "end" | "nearest"
                //     inline: "nearest",
                // } as ScrollIntoViewOptions);
            }
        }, 100);
    };
    utterance.onend = (ev: SpeechSynthesisEvent) => {
        const dialogEl = win.document.getElementById(idTtsDialog) as HTMLDialogElement;
        if (dialogEl && (dialogEl as any).ttsUtterance === ev.utterance) {
            // if ((dialogEl as any).popDialog) {
            //     ((dialogEl as any).popDialog as PopupDialog).cancelRefocus();
            // }
            dialogEl.close();
        }
    };

    setTimeout(() => {
        win.speechSynthesis.speak(utterance);
    }, 0);
}

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

    const pinfo = (progressionData && progressionData.paginationInfo) ?
        progressionData.paginationInfo : undefined;

    win.READIUM2.locationHashOverrideInfo = {
        cfi,
        cssSelector,
        paginationInfo: pinfo,
        position: undefined, // calculated in host index.js renderer, where publication object is available
        progression,
    };
    const payload: IEventPayload_R2_EVENT_READING_LOCATION = win.READIUM2.locationHashOverrideInfo;
    ipcRenderer.sendToHost(R2_EVENT_READING_LOCATION, payload);

    if (win.READIUM2.DEBUG_VISUALS) {
        const existings = win.document.querySelectorAll(`*[${readPosCssStylesAttr4}]`);
        existings.forEach((existing) => {
            existing.removeAttribute(`${readPosCssStylesAttr4}`);
        });
        win.READIUM2.locationHashOverride.setAttribute(readPosCssStylesAttr4, "notifyReadingLocationRaw");
    }

    debug("|||||||||||||| notifyReadingLocation: ", JSON.stringify(payload));
};
const notifyReadingLocationDebounced = debounce(() => {
    notifyReadingLocationRaw();
}, 500);
