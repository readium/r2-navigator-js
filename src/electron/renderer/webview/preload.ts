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
    IEventPayload_R2_EVENT_SHIFT_VIEW_X,
    IEventPayload_R2_EVENT_TTS_CLICK_ENABLE,
    IEventPayload_R2_EVENT_TTS_DO_PLAY,
    R2_EVENT_DEBUG_VISUALS,
    R2_EVENT_LINK,
    R2_EVENT_LOCATOR_VISIBLE,
    R2_EVENT_PAGE_TURN,
    R2_EVENT_PAGE_TURN_RES,
    R2_EVENT_READING_LOCATION,
    R2_EVENT_READIUMCSS,
    R2_EVENT_SCROLLTO,
    R2_EVENT_SHIFT_VIEW_X,
    R2_EVENT_TTS_CLICK_ENABLE,
    R2_EVENT_TTS_DO_NEXT,
    R2_EVENT_TTS_DO_PAUSE,
    R2_EVENT_TTS_DO_PLAY,
    R2_EVENT_TTS_DO_PREVIOUS,
    R2_EVENT_TTS_DO_RESUME,
    R2_EVENT_TTS_DO_STOP,
} from "../../common/events";
import {
    CLASS_PAGINATED,
    configureFixedLayout,
    injectDefaultCSS,
    injectReadPosCSS,
    isPaginated,
} from "../../common/readium-css-inject";
import {
    POPUP_DIALOG_CLASS,
    ROOT_CLASS_INVISIBLE_MASK,
    ROOT_CLASS_KEYBOARD_INTERACT,
    ROOT_CLASS_NO_FOOTNOTES,
    ROOT_CLASS_REDUCE_MOTION,
    TTS_CLASS_INJECTED_SPAN,
    TTS_CLASS_INJECTED_SUBSPAN,
    TTS_ID_INJECTED_PARENT,
    TTS_ID_SPEAKING_DOC_ELEMENT,
    readPosCssStylesAttr1,
    readPosCssStylesAttr2,
    readPosCssStylesAttr3,
    readPosCssStylesAttr4,
} from "../../common/styles";
// import { READIUM2_ELECTRON_HTTP_PROTOCOL } from "../../common/sessions";
import { IPropertyAnimationState, animateProperty } from "../common/animateProperty";
import { uniqueCssSelector } from "../common/cssselector2";
import { easings } from "../common/easings";
import { closePopupDialogs, isPopupDialogOpen } from "../common/popup-dialog";
import { getURLQueryParams } from "../common/querystring";
import {
    URL_PARAM_CSS,
    URL_PARAM_DEBUG_VISUALS,
    URL_PARAM_EPUBREADINGSYSTEM,
    URL_PARAM_GOTO,
    URL_PARAM_PREVIOUS,
} from "../common/url-params";
import { INameVersion, setWindowNavigatorEpubReadingSystem } from "./epubReadingSystem";
import { popupFootNote } from "./popupFootNotes";
import { ttsNext, ttsPause, ttsPlay, ttsPrevious, ttsResume, ttsStop } from "./readaloud";
import {
    calculateColumnDimension,
    calculateMaxScrollShift,
    calculateTotalColumns,
    checkHiddenFootNotes,
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
        href: "",
        locations: {
            cfi: undefined,
            cssSelector: undefined,
            position: undefined,
            progression: undefined,
        },
        paginationInfo: undefined,
    },
    ttsClickEnabled: false,
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
        // debug(`computeVisibility_ FALSE: getBoundingClientRect() TOP: ${rect.top} -- win.document.documentElement.clientHeight: ${win.document.documentElement.clientHeight}`);
        return false;
    }

    // TODO: vertical writing mode
    if (isVerticalWritingMode()) {
        return false;
    }

    const scrollLeftPotentiallyExcessive = getScrollOffsetIntoView(element as HTMLElement);

    // const { maxScrollShift, maxScrollShiftAdjusted } = calculateMaxScrollShift();
    const extraShift = (win.document.body as any).scrollLeftExtra;
    // extraShift === maxScrollShiftAdjusted - maxScrollShift

    let currentOffset = win.document.body.scrollLeft;
    if (extraShift) {
        currentOffset += (((win.document.body.scrollLeft < 0) ? -1 : 1) * extraShift);
    }

    if (scrollLeftPotentiallyExcessive >= (currentOffset - 10) &&
        scrollLeftPotentiallyExcessive <= (currentOffset + 10)) {
        return true;
    }

    // // TODO: RTL
    // if (isRTL()) {
    //     return false;
    // }
    // const threshold = extraShift ? extraShift : 0;
    // if ((rect.left + rect.width) > threshold) {
    //     return true;
    // }
    // tslint:disable-next-line:max-line-length
    // debug(`computeVisibility_ FALSE: getScrollOffsetIntoView: ${scrollLeftPotentiallyExcessive} -- win.document.body.scrollLeft: ${currentOffset}`);
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
    showHideContentMask(false);

    closePopupDialogs(win.document);

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

    win.READIUM2.locationHashOverride = undefined;
    resetLocationHashOverrideInfo();

    if (delayScrollIntoView) {
        setTimeout(() => {
            scrollToHashRaw();
        }, 100);
    } else {
        scrollToHashRaw();
    }
});

function resetLocationHashOverrideInfo() {
    win.READIUM2.locationHashOverrideInfo = {
        href: "",
        locations: {
            cfi: undefined,
            cssSelector: undefined,
            position: undefined,
            progression: undefined,
        },
        paginationInfo: undefined,
        title: undefined,
    };
}

let _lastAnimState: IPropertyAnimationState | undefined;

function elementCapturesKeyboardArrowKeys(target: Element): boolean {

    let curElement: Node | null = target;
    while (curElement && curElement.nodeType === Node.ELEMENT_NODE) {

        const editable = (curElement as Element).getAttribute("contenteditable");
        if (editable) {
            return true;
        }

        const arrayOfKeyboardCaptureElements = [ "input", "textarea", "video", "audio", "select" ];
        if (arrayOfKeyboardCaptureElements.indexOf((curElement as Element).tagName.toLowerCase()) >= 0) {
            return true;
        }

        curElement = curElement.parentNode;
    }

    return false;
}

function ensureTwoPageSpreadWithOddColumnsIsOffset(scrollOffset: number, maxScrollShift: number) {

    if (!win || !win.document || !win.document.body || !win.document.documentElement) {
        return;
    }

    const noChange = !isPaginated(win.document) || !isTwoPageSpread() ||
        isVerticalWritingMode() || // TODO: VWM?
        maxScrollShift <= 0 || Math.abs(scrollOffset) <= maxScrollShift;
    if (noChange) {
        (win.document.body as any).scrollLeftExtra = 0;

        // console.log(`"""""""""""""""""""""""""""""""" noChange: ${maxScrollShift}`);
        // win.document.documentElement.classList.remove("r2-spread-offset");
        ipcRenderer.sendToHost(R2_EVENT_SHIFT_VIEW_X,
            { offset: 0, backgroundColor: undefined } as IEventPayload_R2_EVENT_SHIFT_VIEW_X);
        return;
    }
    // win.document.body.scrollLeft is maxed-out, we need to simulate further scrolling
    // isRTL() == val < 0
    const extraOffset = Math.abs(scrollOffset) - maxScrollShift;
    // console.log(`"""""""""""""""""""""""""""""""" shiftOffset: ${extraOffset}`);
    // win.document.documentElement.style.setProperty("--r2-spread-offset", `-${shiftOffset}px`);
    // win.document.documentElement.classList.add("r2-spread-offset");
    // if (isRTL()) {
    //     win.document.documentElement.classList.add("r2-rtl");
    // } else {
    //     win.document.documentElement.classList.remove("r2-rtl");
    // }

    // const backgroundColor = win.document.documentElement.style.backgroundColor ?
    //     win.document.documentElement.style.backgroundColor : win.document.body.style.backgroundColor;

    let backgroundColor: string | undefined;
    const docStyle = win.getComputedStyle(win.document.documentElement);
    if (docStyle) {
        backgroundColor = docStyle.getPropertyValue("background-color");
    }
    if (!backgroundColor || backgroundColor === "transparent") {
        const bodyStyle = win.getComputedStyle(win.document.body);
        backgroundColor = bodyStyle.getPropertyValue("background-color");
        if (backgroundColor === "transparent") {
            backgroundColor = undefined;
        }
    }

    (win.document.body as any).scrollLeftExtra = extraOffset;

    ipcRenderer.sendToHost(R2_EVENT_SHIFT_VIEW_X,
        {
            backgroundColor: backgroundColor ? backgroundColor : undefined,
            offset: (isRTL() ? 1 : -1) * extraOffset,
        } as IEventPayload_R2_EVENT_SHIFT_VIEW_X);
}

function onEventPageTurn(payload: IEventPayload_R2_EVENT_PAGE_TURN) {

    let leftRightKeyWasUsedInsideKeyboardCapture = false;
    if (win.document.activeElement &&
        elementCapturesKeyboardArrowKeys(win.document.activeElement)) {

        if (win.document.hasFocus()) {
            leftRightKeyWasUsedInsideKeyboardCapture = true;
        } else {
            const oldDate = (win.document.activeElement as any).r2_leftrightKeyboardTimeStamp;
            if (oldDate) {
                const newDate = new Date();
                const msDiff = newDate.getTime() - oldDate.getTime();
                if (msDiff <= 300) {
                    leftRightKeyWasUsedInsideKeyboardCapture = true;
                }
            }
        }
    }
    if (leftRightKeyWasUsedInsideKeyboardCapture) {
        return;
    }

    closePopupDialogs(win.document);

    if (win.READIUM2.isFixedLayout || !win.document.body) {
        ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
        return;
    }

    if (!win.document || !win.document.documentElement) {
        return;
    }

    const reduceMotion = win.document.documentElement.classList.contains(ROOT_CLASS_REDUCE_MOTION);

    const isPaged = isPaginated(win.document);

    const goPREVIOUS = payload.go === "PREVIOUS"; // any other value is NEXT

    if (_lastAnimState && _lastAnimState.animating) {
        win.cancelAnimationFrame(_lastAnimState.id);
        _lastAnimState.object[_lastAnimState.property] = _lastAnimState.destVal;
    }
    if (!goPREVIOUS) { // goPREVIOUS && isRTL() || !goPREVIOUS && !isRTL()) { // right

        const maxScrollShift = calculateMaxScrollShift().maxScrollShift;

        if (isPaged) {
            if (isVerticalWritingMode() && (Math.abs(win.document.body.scrollTop) < maxScrollShift) ||
                !isVerticalWritingMode() && (Math.abs(win.document.body.scrollLeft) < maxScrollShift)) { // not at end

                const unit = isVerticalWritingMode() ?
                    win.document.documentElement.offsetHeight :
                    win.document.documentElement.offsetWidth;
                const scrollOffsetPotentiallyExcessive_ = isVerticalWritingMode() ?
                    (win.document.body.scrollTop + unit) :
                    (win.document.body.scrollLeft + (isRTL() ? -1 : 1) * unit);
                // now snap (just in case):
                const nWholes = Math.floor(scrollOffsetPotentiallyExcessive_ / unit); // retains +/- sign
                const scrollOffsetPotentiallyExcessive = nWholes * unit;
                // if (scrollOffsetPotentiallyExcessive !== scrollOffsetPotentiallyExcessive_) {
                // tslint:disable-next-line:max-line-length
                //     console.log(`}}}}}}}}}}}}}}}}1 offset!! ${scrollOffsetPotentiallyExcessive} != ${scrollOffsetPotentiallyExcessive_}`);
                // }

                // if (Math.abs(scrollOffsetPotentiallyExcessive) > maxScrollShift) {
                //     console.log("onEventPageTurn scrollOffset EXCESS");
                // }
                // tslint:disable-next-line:max-line-length
                ensureTwoPageSpreadWithOddColumnsIsOffset(scrollOffsetPotentiallyExcessive, maxScrollShift);

                const scrollOffset = (scrollOffsetPotentiallyExcessive < 0 ? -1 : 1) *
                    Math.min(Math.abs(scrollOffsetPotentiallyExcessive), maxScrollShift);

                const targetObj = win.document.body;
                const targetProp = isVerticalWritingMode() ? "scrollTop" : "scrollLeft";
                if (reduceMotion) {
                    _lastAnimState = undefined;
                    targetObj[targetProp] = scrollOffset;
                } else {
                    _lastAnimState = animateProperty(
                        win.cancelAnimationFrame,
                        undefined,
                        // (cancelled: boolean) => {
                        //     debug(cancelled);
                        // },
                        targetProp,
                        300,
                        targetObj,
                        scrollOffset,
                        win.requestAnimationFrame,
                        easings.easeInOutQuad,
                    );
                }
                return;
            }
        } else {
            if (isVerticalWritingMode() && (Math.abs(win.document.body.scrollLeft) < maxScrollShift) ||
                !isVerticalWritingMode() && (Math.abs(win.document.body.scrollTop) < maxScrollShift)) {
                const newVal = isVerticalWritingMode() ?
                    (win.document.body.scrollLeft + (isRTL() ? -1 : 1) * win.document.documentElement.clientWidth) :
                    (win.document.body.scrollTop + win.document.documentElement.clientHeight);

                const targetObj = win.document.body;
                const targetProp = isVerticalWritingMode() ? "scrollLeft" : "scrollTop";
                if (reduceMotion) {
                    _lastAnimState = undefined;
                    targetObj[targetProp] = newVal;
                } else {
                    _lastAnimState = animateProperty(
                        win.cancelAnimationFrame,
                        undefined,
                        // (cancelled: boolean) => {
                        //     debug(cancelled);
                        // },
                        targetProp,
                        300,
                        targetObj,
                        newVal,
                        win.requestAnimationFrame,
                        easings.easeInOutQuad,
                    );
                }
                return;
            }
        }
    } else if (goPREVIOUS) { //  && !isRTL() || !goPREVIOUS && isRTL()) { // left
        if (isPaged) {
            if (isVerticalWritingMode() && (Math.abs(win.document.body.scrollTop) > 0) ||
                !isVerticalWritingMode() && (Math.abs(win.document.body.scrollLeft) > 0)) { // not at begin

                const unit = isVerticalWritingMode() ?
                    win.document.documentElement.offsetHeight :
                    win.document.documentElement.offsetWidth;
                const scrollOffset_ = isVerticalWritingMode() ?
                    (win.document.body.scrollTop - unit) :
                    (win.document.body.scrollLeft - (isRTL() ? -1 : 1) * unit);
                // now snap (just in case):
                const nWholes = Math.ceil(scrollOffset_ / unit); // retains +/- sign
                const scrollOffset = nWholes * unit;
                // if (scrollOffset !== scrollOffset_) {
                //     // tslint:disable-next-line:max-line-length
                //     console.log(`}}}}}}}}}}}}}}}}2 offset!! ${scrollOffset} != ${scrollOffset_}`);
                // }

                // zero reset
                ensureTwoPageSpreadWithOddColumnsIsOffset(scrollOffset, 0);

                const targetObj = win.document.body;
                const targetProp = isVerticalWritingMode() ? "scrollTop" : "scrollLeft";
                if (reduceMotion) {
                    _lastAnimState = undefined;
                    targetObj[targetProp] = scrollOffset;
                } else {
                    _lastAnimState = animateProperty(
                        win.cancelAnimationFrame,
                        undefined,
                        // (cancelled: boolean) => {
                        //     debug(cancelled);
                        // },
                        targetProp,
                        300,
                        targetObj,
                        scrollOffset,
                        win.requestAnimationFrame,
                        easings.easeInOutQuad,
                    );
                }
                return;
            }
        } else {
            if (isVerticalWritingMode() && (Math.abs(win.document.body.scrollLeft) > 0) ||
                !isVerticalWritingMode() && (Math.abs(win.document.body.scrollTop) > 0)) {
                const newVal = isVerticalWritingMode() ?
                    (win.document.body.scrollLeft - (isRTL() ? -1 : 1) * win.document.documentElement.clientWidth) :
                    (win.document.body.scrollTop - win.document.documentElement.clientHeight);

                const targetObj = win.document.body;
                const targetProp = isVerticalWritingMode() ? "scrollLeft" : "scrollTop";
                if (reduceMotion) {
                    _lastAnimState = undefined;
                    targetObj[targetProp] = newVal;
                } else {
                    _lastAnimState = animateProperty(
                        win.cancelAnimationFrame,
                        undefined,
                        // (cancelled: boolean) => {
                        //     debug(cancelled);
                        // },
                        targetProp,
                        300,
                        targetObj,
                        newVal,
                        win.requestAnimationFrame,
                        easings.easeInOutQuad,
                    );
                }
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
function getScrollOffsetIntoView(element: HTMLElement): number {
    if (!win.document || !win.document.documentElement || !win.document.body ||
        !isPaginated(win.document) || isVerticalWritingMode()) {
        return 0;
    }

    const rect = element.getBoundingClientRect();

    const columnDimension = calculateColumnDimension();

    const isTwoPage = isTwoPageSpread();

    const fullOffset = (isRTL() ?
        ((columnDimension * (isTwoPage ? 2 : 1)) - rect.left) :
        rect.left) +
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
    const maxScrollShift = calculateMaxScrollShift().maxScrollShift;
    const scrollLeftPotentiallyExcessive = getScrollOffsetIntoView(element);
    // if (Math.abs(scrollLeftPotentiallyExcessive) > maxScrollShift) {
    //     console.log("getScrollOffsetIntoView scrollLeft EXCESS");
    // }
    ensureTwoPageSpreadWithOddColumnsIsOffset(scrollLeftPotentiallyExcessive, maxScrollShift);

    // scrollLeft is capped at maxScrollShift by the browser engine
    const scrollOffset = (scrollLeftPotentiallyExcessive < 0 ? -1 : 1) *
        Math.min(Math.abs(scrollLeftPotentiallyExcessive), maxScrollShift);
    win.document.body.scrollLeft = scrollOffset;
}

const scrollToHashRaw = () => {
    if (!win.document || !win.document.body || !win.document.documentElement) {
        return;
    }

    const isPaged = isPaginated(win.document);

    if (win.READIUM2.locationHashOverride) {
        if (win.READIUM2.locationHashOverride === win.document.body) {
            notifyReadingLocationDebounced();
            return;
        }

        // _ignoreScrollEvent = true;
        scrollElementIntoView(win.READIUM2.locationHashOverride);

        notifyReadingLocationDebounced();
        return;
    } else if (win.READIUM2.hashElement) {
        win.READIUM2.locationHashOverride = win.READIUM2.hashElement;

        // _ignoreScrollEvent = true;
        scrollElementIntoView(win.READIUM2.hashElement);

        // win.READIUM2.hashElement.classList.add("readium2-hash");
        // setTimeout(() => {
        //     if (win.READIUM2.hashElement) {
        //         win.READIUM2.hashElement.classList.remove("readium2-hash");
        //     }
        // }, 1000);

        notifyReadingLocationDebounced();
        return;
    } else {
        if (win.READIUM2.urlQueryParams) {
            // tslint:disable-next-line:no-string-literal
            const previous = win.READIUM2.urlQueryParams[URL_PARAM_PREVIOUS];
            const isPreviousNavDirection = previous === "true";
            if (isPreviousNavDirection) {
                const { maxScrollShift, maxScrollShiftAdjusted } = calculateMaxScrollShift();

                _ignoreScrollEvent = true;
                if (isPaged) {
                    if (isVerticalWritingMode()) {
                        win.document.body.scrollLeft = 0;
                        win.document.body.scrollTop = maxScrollShift;
                    } else {
                        const scrollLeftPotentiallyExcessive = (isRTL() ? -1 : 1) * maxScrollShiftAdjusted;
                        // tslint:disable-next-line:max-line-length
                        ensureTwoPageSpreadWithOddColumnsIsOffset(scrollLeftPotentiallyExcessive, maxScrollShift);
                        const scrollLeft = (isRTL() ? -1 : 1) * maxScrollShift;
                        win.document.body.scrollLeft = scrollLeft;
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
                resetLocationHashOverrideInfo();

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

                if (!win.READIUM2.locationHashOverride) { // already in processXYRaw()
                    notifyReadingLocationDebounced();
                }

                setTimeout(() => {
                    _ignoreScrollEvent = false;
                }, 10);
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

                    resetLocationHashOverrideInfo();
                    if (win.READIUM2.locationHashOverrideInfo) {
                        win.READIUM2.locationHashOverrideInfo.locations.cssSelector = gotoCssSelector;
                    }

                    // _ignoreScrollEvent = true;
                    scrollElementIntoView(selected);

                    notifyReadingLocationDebounced();
                    return;
                }
            }
        }

        win.READIUM2.locationHashOverride = win.document.body;
        resetLocationHashOverrideInfo();

        _ignoreScrollEvent = true;
        win.document.body.scrollLeft = 0;
        win.document.body.scrollTop = 0;
        setTimeout(() => {
            _ignoreScrollEvent = false;
        }, 10);
    }

    notifyReadingLocationDebounced();
};

const scrollToHashDebounced = debounce(() => {
    scrollToHashRaw();
}, 300);

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

ipcRenderer.on("R2_EVENT_HIDE", (_event: any) => {
    showHideContentMask(true);
});

function showHideContentMask(doHide: boolean) {
    if (doHide) {
        win.document.body.classList.add(ROOT_CLASS_INVISIBLE_MASK);
    } else {
        win.document.body.classList.remove(ROOT_CLASS_INVISIBLE_MASK);
    }
}

function focusScrollRaw(el: HTMLOrSVGElement, doFocus: boolean) {
    win.READIUM2.locationHashOverride = el as HTMLElement;
    scrollElementIntoView(win.READIUM2.locationHashOverride);
    if (doFocus) {
        setTimeout(() => {
            el.focus();
        }, 10);
    }
    notifyReadingLocationDebounced();
}
const focusScrollDebounced = debounce((el: HTMLOrSVGElement, doFocus: boolean) => {
    focusScrollRaw(el, doFocus);
}, 80);

let _ignoreFocusInEvent = false;

function handleTab(target: HTMLElement, tabKeyDownEvent: KeyboardEvent | undefined) {
    if (!target || !win.document.body) {
        return;
    }

    // target
    // tab-keydown => originating element (will leave focus)
    // focusin => destination element (focuses in)

    // evt
    // non-nil when tab-keydown
    // nil when focusin
    // const isTabKeyDownEvent = typeof evt !== "undefined";
    // const isFocusInEvent = !isTabKeyDownEvent;

    _ignoreFocusInEvent = false;

    // cache problem: temporary tabbables? (e.g. HTML5 details/summary element, expand/collapse)
    // so right now, resize sensor resets body.tabbables. Is that enough? (other edge cases?)
    const tabbables = (win.document.body as any).tabbables ?
        (win.document.body as any).tabbables :
        ((win.document.body as any).tabbables = tabbable(win.document.body));
    // const tabbables = tabbable(win.document.body);
    // debug(tabbables);

    const i = tabbables.indexOf(target);
    // debug("TABBABLE: " + i);

    if (i === 0) {
        // debug("FIRST TABBABLE");
        // prevent the webview from cycling scroll (does its own unwanted focus)
        if (!tabKeyDownEvent || tabKeyDownEvent.shiftKey) {
            // debug("FIRST TABBABLE focusin or shift-tab");
            _ignoreFocusInEvent = true;
            focusScrollDebounced(target as HTMLElement, true);
            return;
        }
        if (i < (tabbables.length - 1)) {
            // debug("TABBABLE FORWARD >>");
            tabKeyDownEvent.preventDefault();
            const nextTabbable = tabbables[i + 1];
            focusScrollDebounced(nextTabbable as HTMLElement, true);
            return;
        }
        // debug("FIRST TABBABLE ??");
    } else if (i === (tabbables.length - 1)) {
        // debug("LAST TABBABLE");
        // prevent the webview from cycling scroll (does its own unwanted focus)
        if (!tabKeyDownEvent || !tabKeyDownEvent.shiftKey) {
            // debug("LAST TABBABLE focusin or no-shift-tab");
            _ignoreFocusInEvent = true;
            focusScrollDebounced(target as HTMLElement, true);
            return;
        }
        if (i > 0) {
            // debug("TABBABLE BACKWARD <<");
            tabKeyDownEvent.preventDefault();
            const previousTabbable = tabbables[i - 1];
            focusScrollDebounced(previousTabbable as HTMLElement, true);
            return;
        }
        // debug("LAST TABBABLE??");
    } else if (i > 0) {
        if (tabKeyDownEvent) {
            if (tabKeyDownEvent.shiftKey) {
                // debug("TABBABLE BACKWARD <<");
                tabKeyDownEvent.preventDefault();
                const previousTabbable = tabbables[i - 1];
                focusScrollDebounced(previousTabbable as HTMLElement, true);
                return;
            } else {
                // debug("TABBABLE FORWARD >>");
                tabKeyDownEvent.preventDefault();
                const nextTabbable = tabbables[i + 1];
                focusScrollDebounced(nextTabbable as HTMLElement, true);
                return;
            }
        }
    }
    if (!tabKeyDownEvent) {
        // debug("FOCUSIN force");
        focusScrollDebounced(target as HTMLElement, true);
    }
}

ipcRenderer.on(R2_EVENT_READIUMCSS, (_event: any, payload: IEventPayload_R2_EVENT_READIUMCSS) => {
    showHideContentMask(false);
    readiumCSS(win.document, payload);
});

let _docTitle: string | undefined;

win.addEventListener("DOMContentLoaded", () => {
    // console.log("############# DOMContentLoaded");
    // console.log(win.location);

    const titleElement = win.document.documentElement.querySelector("head > title");
    if (titleElement && titleElement.textContent) {
        _docTitle = titleElement.textContent;
    }

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
    win.READIUM2.ttsClickEnabled = false;

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

    let didHide = false;
    if (!win.READIUM2.isFixedLayout) {
        // only applies to previous nav spine item reading order
        if (win.READIUM2.urlQueryParams) {
            // tslint:disable-next-line:no-string-literal
            const previous = win.READIUM2.urlQueryParams[URL_PARAM_PREVIOUS];
            const isPreviousNavDirection = previous === "true";
            if (isPreviousNavDirection) {
                didHide = true;
                showHideContentMask(true);
            }
        }
    }
    // ensure visible (can be triggered from host)
    if (!didHide) {
        showHideContentMask(false);
    }

    // testReadiumCSS(readiumcssJson);

    const wh = configureFixedLayout(win.document, win.READIUM2.isFixedLayout,
        win.READIUM2.fxlViewportWidth, win.READIUM2.fxlViewportHeight,
        win.innerWidth, win.innerHeight);
    if (wh) {
        win.READIUM2.fxlViewportWidth = wh.width;
        win.READIUM2.fxlViewportHeight = wh.height;
    }

    const alreadedInjected = win.document.documentElement.hasAttribute("data-readiumcss-injected");
    if (alreadedInjected) {
        debug(">>>>> ReadiumCSS already injected by streamer");
        // console.log(">>>>>2 ReadiumCSS already injected by streamer");
    }

    if (!alreadedInjected) {
        injectDefaultCSS(win.document);
        if (IS_DEV) { // win.READIUM2.DEBUG_VISUALS
            injectReadPosCSS(win.document);
        }
    }

    computeVerticalRTL();
    if (readiumcssJson) {
        // ReadiumCSS already injected at the streamer level?
        if (isVerticalWritingMode() || // force update, because needs getComputedStyle()
            !alreadedInjected) {

            debug(">>>>>> ReadiumCSS inject again");
            readiumCSS(win.document, readiumcssJson);
        }
    }
    if (alreadedInjected) { // because querySelector[All]() is not polyfilled
        checkHiddenFootNotes(win.document);
    }
});

let _cancelInitialScrollCheck = false;
// after DOMContentLoaded
win.addEventListener("load", () => {
    // console.log("############# load");
    // console.log(win.location);

    if (!win.READIUM2.isFixedLayout) {
        setTimeout(() => {
            scrollToHashRaw();
        }, 100);
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
    }

    const useResizeSensor = !win.READIUM2.isFixedLayout;
    if (useResizeSensor && win.document.body) {

        // setTimeout(() => {
        // }, 1000);
        window.requestAnimationFrame((_timestamp) => {
            // tslint:disable-next-line:no-unused-expression
            new ResizeSensor(win.document.body, () => {

                // debug("ResizeSensor");

                (win.document.body as any).tabbables = undefined;
                scrollToHashDebounced();
            });
        });
    }

    win.document.body.addEventListener("focusin", (ev: any) => {

        if (_ignoreFocusInEvent) {
            // debug("focusin --- IGNORE");
            _ignoreFocusInEvent = false;
            return;
        }

        if (isPopupDialogOpen(win.document)) {
            return;
        }

        if (ev.target) {
            let mouseClickOnLink = false;
            if (win.document && win.document.documentElement) {
                if (!win.document.documentElement.classList.contains(ROOT_CLASS_KEYBOARD_INTERACT)) {
                    if ((ev.target as HTMLElement).tagName.toLowerCase() === "a" && (ev.target as any).href) {
                        // link mouse click, leave it alone!
                        mouseClickOnLink = true;
                    }
                }
            }
            if (!mouseClickOnLink) {
                handleTab(ev.target as HTMLElement, undefined);
            }
        }
        // if (!win.document) {
        //     return;
        // }
        // const isPaged = isPaginated(win.document);
        // if (isPaged) {
        // }
    });

    win.document.body.addEventListener("keydown", (ev: KeyboardEvent) => {
        if (isPopupDialogOpen(win.document)) {
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
        const href = (e.target as HTMLAnchorElement).href;
        // const href = (e.target as Element).getAttribute("href");
        if (!href) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const done = popupFootNote(e.target as HTMLElement, focusScrollRaw, href);
        if (!done) {
            focusScrollDebounced.clear();
            processXYDebounced.clear();
            notifyReadingLocationDebounced.clear();
            scrollToHashDebounced.clear();

            const payload: IEventPayload_R2_EVENT_LINK = {
                url: href,
            };
            ipcRenderer.sendToHost(R2_EVENT_LINK, payload);
        }

        return false;
    }, true);

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

    setTimeout(() => {
        win.addEventListener("scroll", (_ev: UIEvent) => {

            if (_ignoreScrollEvent) {
                _ignoreScrollEvent = false;
                return;
            }

            if (!win.document || !win.document.documentElement) {
                return;
            }

            const x = (isRTL() ? win.document.documentElement.offsetWidth - 1 : 0);
            processXYDebounced(x, 0);
        });
    }, 800);

    win.document.body.addEventListener("click", (ev: MouseEvent) => {

        if (isPopupDialogOpen(win.document)) {
            return;
        }

        // relative to fixed window top-left corner
        // (unlike pageX/Y which is relative to top-left rendered content area, subject to scrolling)
        const x = ev.clientX;
        const y = ev.clientY;

        processXYDebounced(x, y);
    });

    win.document.body.addEventListener("click", (ev: MouseEvent) => {

        if (isPopupDialogOpen(win.document)) {
            return;
        }

        // relative to fixed window top-left corner
        // (unlike pageX/Y which is relative to top-left rendered content area, subject to scrolling)
        const x = ev.clientX;
        const y = ev.clientY;

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

        if (win.READIUM2.ttsClickEnabled && element) {
            if (ev.altKey) {
                ttsPlay(focusScrollRaw, element, undefined);
                return;
            }

            ttsPlay(focusScrollRaw, (element.ownerDocument as Document).body, element);
        }
    });
});

// // does not occur when re-using same webview (src="href")
// win.addEventListener("unload", () => {
// });

// relative to fixed window top-left corner
const processXYRaw = (x: number, y: number) => {

    if (isPopupDialogOpen(win.document)) {
        return;
    }

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
        win.READIUM2.locationHashOverride = element;
        if (isPaginated(win.document) && !computeVisibility_(element)) {
            win.READIUM2.locationHashOverride = win.document.body;
        }
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

    const { maxScrollShift, maxScrollShiftAdjusted } = calculateMaxScrollShift();

    const totalColumns = calculateTotalColumns();

    let progressionRatio = 0;

    // zero-based index: 0 <= currentColumn < totalColumns
    let currentColumn = 0;

    let extraShift = 0;
    if (isPaged) {
        if (maxScrollShift > 0) {
            if (isVerticalWritingMode()) {
                progressionRatio = win.document.body.scrollTop / maxScrollShift;
            } else {
                extraShift = (win.document.body as any).scrollLeftExtra;
                // extraShift === maxScrollShiftAdjusted - maxScrollShift
                if (extraShift) {
                    progressionRatio = (((isRTL() ? -1 : 1) * win.document.body.scrollLeft) + extraShift) /
                        maxScrollShiftAdjusted;
                } else {
                    progressionRatio = ((isRTL() ? -1 : 1) * win.document.body.scrollLeft) / maxScrollShift;
                }
            }
        }

        // console.log(")))))))) 0 progressionRatio");
        // console.log(progressionRatio);

        // console.log("&&&&& EXTRA");
        // console.log(extraShift);

        // because maxScrollShift excludes whole viewport width of content (0%-100% scroll but minus last page/spread)
        const adjustedTotalColumns = (extraShift ? (totalColumns + 1) : totalColumns) - (isTwoPage ? 2 : 1);
        // tslint:disable-next-line:max-line-length
        // const adjustedTotalColumns = totalColumns - (isTwoPage ? ((maxScrollShiftAdjusted > maxScrollShift) ? 1 : 2) : 1);

        currentColumn = adjustedTotalColumns * progressionRatio;
        // console.log("%%%%%%%% 0 currentColumn");
        // console.log(currentColumn);

        currentColumn = Math.floor(currentColumn);
    } else {
        if (maxScrollShift > 0) {
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
        // console.log("##### RECT TOP LEFT");
        // console.log(rect.top);
        // console.log(rect.left);

        if (isPaged) {

            const visible = computeVisibility_(element);
            if (visible) {
                // because getBoundingClientRect() based on visual rendering,
                // which does not account for extra shift (CSS transform X-translate of the webview)
                const curCol = extraShift ? (currentColumn - 1) : currentColumn;

                const columnDimension = calculateColumnDimension();
                // console.log("##### columnDimension");
                // console.log(columnDimension);

                if (isVerticalWritingMode()) {
                    offset = (curCol * win.document.body.scrollWidth) + rect.left +
                        (rect.top >= columnDimension ? win.document.body.scrollWidth : 0);
                } else {
                    offset = (curCol * win.document.body.scrollHeight) + rect.top +
                        (((isRTL() ?
                            (win.document.documentElement.clientWidth - (rect.left + rect.width)) :
                            rect.left) >= columnDimension) ? win.document.body.scrollHeight : 0);
                }

                // console.log("##### offset");
                // console.log(offset);

                // includes whitespace beyond bottom/end of document, to fill the unnocupied remainder of the column
                const totalDocumentDimension = ((isVerticalWritingMode() ? win.document.body.scrollWidth :
                    win.document.body.scrollHeight) * totalColumns);
                // console.log("##### totalDocumentDimension");
                // console.log(totalDocumentDimension);
                progressionRatio = offset / totalDocumentDimension;

                // console.log(")))))))) 1 progressionRatio");
                // console.log(progressionRatio);

                currentColumn = totalColumns * progressionRatio;

                // console.log("%%%%%%%% 1 currentColumn");
                // console.log(currentColumn);

                currentColumn = Math.floor(currentColumn);
            }
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

    let spreadIndex = 0;
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

// tslint:disable-next-line:max-line-length
const _blacklistIdClassForCssSelectors = [TTS_ID_INJECTED_PARENT, TTS_ID_SPEAKING_DOC_ELEMENT, POPUP_DIALOG_CLASS, TTS_CLASS_INJECTED_SPAN, TTS_CLASS_INJECTED_SUBSPAN, ROOT_CLASS_KEYBOARD_INTERACT, ROOT_CLASS_INVISIBLE_MASK, CLASS_PAGINATED, ROOT_CLASS_NO_FOOTNOTES];

// tslint:disable-next-line:max-line-length
const _blacklistIdClassForCFI = [POPUP_DIALOG_CLASS, TTS_CLASS_INJECTED_SPAN, TTS_CLASS_INJECTED_SUBSPAN];

export const computeCFI = (node: Node): string | undefined => {

    // TODO: handle character position inside text node
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return undefined;
    }

    let cfi = "";

    let currentElement = node as Element;
    while (currentElement.parentNode && currentElement.parentNode.nodeType === Node.ELEMENT_NODE) {
        let blacklistedId: string | undefined;
        const id = currentElement.getAttribute("id");
        if (id && _blacklistIdClassForCFI.indexOf(id) >= 0) {
            console.log("CFI BLACKLIST ID: " + id);
            blacklistedId = id;
        }

        let blacklistedClass: string | undefined;
        for (const item of _blacklistIdClassForCFI) {
            if (currentElement.classList.contains(item)) {
                console.log("CFI BLACKLIST CLASS: " + item);
                blacklistedClass = item;
                break;
            }
        }
        if (!blacklistedId && !blacklistedClass) {
            const currentElementParentChildren = (currentElement.parentNode as Element).children;
            let currentElementIndex = -1;
            for (let i = 0; i < currentElementParentChildren.length; i++) {
                if (currentElement === currentElementParentChildren[i]) {
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

    const options = {
        className: (str: string) => {
            return _blacklistIdClassForCssSelectors.indexOf(str) < 0;
        },
        idName: (str: string) => {
            return _blacklistIdClassForCssSelectors.indexOf(str) < 0;
        },
    };
    const cssSelector = uniqueCssSelector(win.READIUM2.locationHashOverride, win.document, options);
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
        href: "",
        locations: {
            cfi,
            cssSelector,
            position: undefined, // calculated in host index.js renderer, where publication object is available
            progression,
        },
        paginationInfo: pinfo,
        title: _docTitle,
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
}, 250);

ipcRenderer.on(R2_EVENT_TTS_DO_PLAY, (_event: any, payload: IEventPayload_R2_EVENT_TTS_DO_PLAY) => {
    const rootElement = win.document.querySelector(payload.rootElement);
    const startElement = payload.startElement ? win.document.querySelector(payload.startElement) : null;
    ttsPlay(focusScrollRaw, rootElement ? rootElement : undefined, startElement ? startElement : undefined);
});

ipcRenderer.on(R2_EVENT_TTS_DO_STOP, (_event: any) => {
    ttsStop();
});

ipcRenderer.on(R2_EVENT_TTS_DO_PAUSE, (_event: any) => {
    ttsPause();
});

ipcRenderer.on(R2_EVENT_TTS_DO_RESUME, (_event: any) => {
    ttsResume();
});

ipcRenderer.on(R2_EVENT_TTS_DO_NEXT, (_event: any) => {
    ttsNext();
});

ipcRenderer.on(R2_EVENT_TTS_DO_PREVIOUS, (_event: any) => {
    ttsPrevious();
});

ipcRenderer.on(R2_EVENT_TTS_CLICK_ENABLE, (_event: any, payload: IEventPayload_R2_EVENT_TTS_CLICK_ENABLE) => {
    win.READIUM2.ttsClickEnabled = payload.doEnable;
});
