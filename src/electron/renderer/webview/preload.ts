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

import { debounce } from "debounce";
import * as debug_ from "debug";
import { ipcRenderer } from "electron";
import * as tabbable from "tabbable";

import { LocatorLocations } from "@r2-shared-js/models/locator";

import {
    IEventPayload_R2_EVENT_CLIPBOARD_COPY, IEventPayload_R2_EVENT_DEBUG_VISUALS,
    IEventPayload_R2_EVENT_HIGHLIGHT_CREATE, IEventPayload_R2_EVENT_HIGHLIGHT_REMOVE,
    IEventPayload_R2_EVENT_LINK, IEventPayload_R2_EVENT_LOCATOR_VISIBLE,
    IEventPayload_R2_EVENT_PAGE_TURN, IEventPayload_R2_EVENT_READING_LOCATION,
    IEventPayload_R2_EVENT_READIUMCSS, IEventPayload_R2_EVENT_SCROLLTO,
    IEventPayload_R2_EVENT_SHIFT_VIEW_X, IEventPayload_R2_EVENT_TTS_CLICK_ENABLE,
    IEventPayload_R2_EVENT_TTS_DO_PLAY, IEventPayload_R2_EVENT_WEBVIEW_KEYDOWN,
    R2_EVENT_AUDIO_DO_PAUSE, R2_EVENT_AUDIO_DO_PLAY, R2_EVENT_CLIPBOARD_COPY,
    R2_EVENT_DEBUG_VISUALS, R2_EVENT_HIGHLIGHT_CREATE, R2_EVENT_HIGHLIGHT_REMOVE,
    R2_EVENT_HIGHLIGHT_REMOVE_ALL, R2_EVENT_LINK, R2_EVENT_LOCATOR_VISIBLE, R2_EVENT_PAGE_TURN,
    R2_EVENT_PAGE_TURN_RES, R2_EVENT_READING_LOCATION, R2_EVENT_READIUMCSS, R2_EVENT_SCROLLTO,
    R2_EVENT_SHIFT_VIEW_X, R2_EVENT_TTS_CLICK_ENABLE, R2_EVENT_TTS_DO_NEXT, R2_EVENT_TTS_DO_PAUSE,
    R2_EVENT_TTS_DO_PLAY, R2_EVENT_TTS_DO_PREVIOUS, R2_EVENT_TTS_DO_RESUME, R2_EVENT_TTS_DO_STOP,
    R2_EVENT_WEBVIEW_KEYDOWN,
} from "../../common/events";
import { IHighlight, IHighlightDefinition } from "../../common/highlight";
import { IPaginationInfo } from "../../common/pagination";
import {
    CLASS_PAGINATED, appendCSSInline, configureFixedLayout, injectDefaultCSS, injectReadPosCSS,
    isPaginated,
} from "../../common/readium-css-inject";
import { sameSelections } from "../../common/selection";
import {
    POPUP_DIALOG_CLASS, ROOT_CLASS_INVISIBLE_MASK, ROOT_CLASS_KEYBOARD_INTERACT, ROOT_CLASS_MATHJAX,
    ROOT_CLASS_NO_FOOTNOTES, ROOT_CLASS_REDUCE_MOTION, TTS_CLASS_INJECTED_SPAN,
    TTS_CLASS_INJECTED_SUBSPAN, TTS_ID_INJECTED_PARENT, TTS_ID_SPEAKING_DOC_ELEMENT,
    readPosCssStylesAttr1, readPosCssStylesAttr2, readPosCssStylesAttr3, readPosCssStylesAttr4,
} from "../../common/styles";
import { IPropertyAnimationState, animateProperty } from "../common/animateProperty";
import { uniqueCssSelector } from "../common/cssselector2";
import { easings } from "../common/easings";
import { closePopupDialogs, isPopupDialogOpen } from "../common/popup-dialog";
import { getURLQueryParams } from "../common/querystring";
import { IRect, getClientRectsNoOverlap_ } from "../common/rect-utils";
import {
    URL_PARAM_CLIPBOARD_INTERCEPT, URL_PARAM_CSS, URL_PARAM_DEBUG_VISUALS,
    URL_PARAM_EPUBREADINGSYSTEM, URL_PARAM_GOTO, URL_PARAM_PREVIOUS,
} from "../common/url-params";
import { ENABLE_WEBVIEW_RESIZE } from "../common/webview-resize";
import { INameVersion, setWindowNavigatorEpubReadingSystem } from "./epubReadingSystem";
import {
    CLASS_HIGHLIGHT_AREA, CLASS_HIGHLIGHT_BOUNDING_AREA, CLASS_HIGHLIGHT_CONTAINER,
    ID_HIGHLIGHTS_CONTAINER, createHighlight, destroyAllhighlights, destroyHighlight,
    recreateAllHighlights,
} from "./highlight";
import { popupFootNote } from "./popupFootNotes";
import { ttsNext, ttsPause, ttsPlay, ttsPrevious, ttsResume, ttsStop } from "./readaloud";
import {
    calculateColumnDimension, calculateMaxScrollShift, calculateTotalColumns, checkHiddenFootNotes,
    computeVerticalRTL, getScrollingElement, isRTL, isTwoPageSpread, isVerticalWritingMode,
    readiumCSS,
} from "./readium-css";
import { clearCurrentSelection, getCurrentSelectionInfo } from "./selection";
import { IReadiumElectronWebviewWindow } from "./state";

// import { registerProtocol } from "@r2-navigator-js/electron/renderer/common/protocol";
// registerProtocol();

const debug = debug_("r2:navigator#electron/renderer/webview/preload");

const win = (global as any).window as IReadiumElectronWebviewWindow;
win.READIUM2 = {
    DEBUG_VISUALS: false,
    // dialogs = [],
    fxlViewportHeight: 0,
    fxlViewportScale: 1,
    fxlViewportWidth: 0,
    hashElement: null,
    isAudio: false,
    isClipboardIntercept: false,
    isFixedLayout: false,
    locationHashOverride: undefined,
    locationHashOverrideInfo: {
        docInfo: undefined,
        href: "",
        locations: {
            cfi: undefined,
            cssSelector: undefined,
            position: undefined,
            progression: undefined,
        },
        paginationInfo: undefined,
        selectionInfo: undefined,
        selectionIsNew: undefined,
        title: undefined,
    },
    ttsClickEnabled: false,
    urlQueryParams: win.location.search ? getURLQueryParams(win.location.search) : undefined,
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

// TODO this feels like a hack! :(
// (in Electron v1 the top-level app event listener catches the webview-originating events ... not anymore)
win.document.addEventListener("keydown", (ev: KeyboardEvent) => {

    const payload: IEventPayload_R2_EVENT_WEBVIEW_KEYDOWN = {
        altKey: ev.altKey,
        code: ev.code,
        ctrlKey: ev.ctrlKey,
        key: ev.key,
        metaKey: ev.metaKey,
        shiftKey: ev.shiftKey,
    };
    ipcRenderer.sendToHost(R2_EVENT_WEBVIEW_KEYDOWN, payload);
});

win.READIUM2.isAudio = win.location.protocol === "data:";

if (win.READIUM2.urlQueryParams) {
    let readiumEpubReadingSystemJson: INameVersion | undefined;

    // tslint:disable-next-line:no-string-literal
    const base64EpubReadingSystem = win.READIUM2.urlQueryParams[URL_PARAM_EPUBREADINGSYSTEM];
    if (base64EpubReadingSystem) {
        try {
            const str = Buffer.from(base64EpubReadingSystem, "base64").toString("utf8");
            readiumEpubReadingSystemJson = JSON.parse(str);
        } catch (err) {
            debug(err);
        }
    }

    if (readiumEpubReadingSystemJson) {
        setWindowNavigatorEpubReadingSystem(win, readiumEpubReadingSystemJson);
    }

    win.READIUM2.DEBUG_VISUALS = win.READIUM2.urlQueryParams[URL_PARAM_DEBUG_VISUALS] === "true";

    win.READIUM2.isClipboardIntercept = win.READIUM2.urlQueryParams[URL_PARAM_CLIPBOARD_INTERCEPT] === "true";
}

if (IS_DEV) {
    ipcRenderer.on(R2_EVENT_DEBUG_VISUALS, (_event: any, payload: IEventPayload_R2_EVENT_DEBUG_VISUALS) => {
        win.READIUM2.DEBUG_VISUALS = payload.debugVisuals;

        if (!payload.debugVisuals) {
            const existings = win.document.querySelectorAll(
                // tslint:disable-next-line:max-line-length
                `*[${readPosCssStylesAttr1}], *[${readPosCssStylesAttr2}], *[${readPosCssStylesAttr3}], *[${readPosCssStylesAttr4}]`);
            existings.forEach((existing) => {
                existing.removeAttribute(`${readPosCssStylesAttr1}`);
                existing.removeAttribute(`${readPosCssStylesAttr2}`);
                existing.removeAttribute(`${readPosCssStylesAttr3}`);
                existing.removeAttribute(`${readPosCssStylesAttr4}`);
            });
            // destroyAllhighlights(win.document);
        }
        if (payload.cssClass) {
            if (_blacklistIdClassForCssSelectors.indexOf(payload.cssClass) < 0) {
                _blacklistIdClassForCssSelectors.push(payload.cssClass.toLowerCase());
            }

            if (payload.debugVisuals && payload.cssStyles && payload.cssStyles.length) {
                const idSuffix = `debug_for_class_${payload.cssClass}`;
                appendCSSInline(win.document, idSuffix, payload.cssStyles);

                if (payload.cssSelector) {
                    const toHighlights = win.document.querySelectorAll(payload.cssSelector);
                    toHighlights.forEach((toHighlight) => {
                        const clazz = `${payload.cssClass}`;
                        if (!toHighlight.classList.contains(clazz)) {
                            toHighlight.classList.add(clazz);
                        }
                    });
                }
            } else {
                // const existings = win.document.querySelectorAll(payload.cssSelector);
                const existings = win.document.querySelectorAll(`.${payload.cssClass}`);
                existings.forEach((existing) => {
                    existing.classList.remove(`${payload.cssClass}`);
                });
            }
        }
    });
}

function computeVisibility_(element: Element): boolean {
    if (win.READIUM2.isFixedLayout) {
        return true;
    } else if (!win.document || !win.document.documentElement || !win.document.body) {
        return false;
    }
    if (element === win.document.body || element === win.document.documentElement) {
        return true;
    }

    const elStyle = win.getComputedStyle(element);
    if (elStyle) {
        const display = elStyle.getPropertyValue("display");
        if (display === "none") {
            if (IS_DEV) {
                console.log("element DISPLAY NONE");
            }
            // console.log(element.outerHTML);
            return false;
        }
        // Cannot be relied upon, because web browser engine reports
        // invisible when out of view in scrolled columns!!
        // const visibility = elStyle.getPropertyValue("visibility");
        // if (visibility === "hidden") {
        //     if (IS_DEV) {
        //         console.log("element VISIBILITY HIDDEN");
        //     }
        //     console.log(element.outerHTML);
        //     return false;
        // }
        const opacity = elStyle.getPropertyValue("opacity");
        if (opacity === "0") {
            if (IS_DEV) {
                console.log("element OPACITY ZERO");
            }
            // console.log(element.outerHTML);
            return false;
        }
    }

    const scrollElement = getScrollingElement(win.document);

    if (!isPaginated(win.document)) { // scroll

        const rect = element.getBoundingClientRect();
        // debug(rect.top);
        // debug(rect.left);
        // debug(rect.width);
        // debug(rect.height);

        // let offset = 0;
        // if (isVerticalWritingMode()) {
        //     offset = ((isRTL() ? -1 : 1) * scrollElement.scrollLeft) + rect.left + (isRTL() ? rect.width : 0);
        // } else {
        //     offset = scrollElement.scrollTop + rect.top;
        // }
        // const progressionRatio = offset /
        //     (isVerticalWritingMode() ? scrollElement.scrollWidth : scrollElement.scrollHeight);

        // TODO: vertical writing mode
        if (rect.top >= 0 &&
            // (rect.top + rect.height) >= 0 &&
            rect.top <= win.document.documentElement.clientHeight) {
            return true;
        }
        // tslint:disable-next-line:max-line-length
        // debug(`computeVisibility_ FALSE: clientRect TOP: ${rect.top} -- win.document.documentElement.clientHeight: ${win.document.documentElement.clientHeight}`);
        return false;
    }

    // TODO: vertical writing mode
    if (isVerticalWritingMode()) {
        return false;
    }

    const scrollLeftPotentiallyExcessive = getScrollOffsetIntoView(element as HTMLElement);

    // const { maxScrollShift, maxScrollShiftAdjusted } = calculateMaxScrollShift();
    const extraShift = (scrollElement as any).scrollLeftExtra;
    // extraShift === maxScrollShiftAdjusted - maxScrollShift

    let currentOffset = scrollElement.scrollLeft;
    if (extraShift) {
        currentOffset += (((currentOffset < 0) ? -1 : 1) * extraShift);
    }

    if (scrollLeftPotentiallyExcessive >= (currentOffset - 10) &&
        scrollLeftPotentiallyExcessive <= (currentOffset + 10)) {
        return true;
    }

    // tslint:disable-next-line:max-line-length
    // debug(`computeVisibility_ FALSE: getScrollOffsetIntoView: ${scrollLeftPotentiallyExcessive} -- scrollElement.scrollLeft: ${currentOffset}`);
    return false;
}
function computeVisibility(location: LocatorLocations): boolean {

    let visible = false;
    if (win.READIUM2.isAudio) {
        visible = true;
    } else if (win.READIUM2.isFixedLayout) {
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

    clearCurrentSelection(win);
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
            debug("++++ scrollToHashRaw FROM DELAYED SCROLL_TO");
            scrollToHashRaw();
        }, 100);
    } else {
        debug("++++ scrollToHashRaw FROM SCROLL_TO");
        scrollToHashRaw();
    }
});

function resetLocationHashOverrideInfo() {
    win.READIUM2.locationHashOverrideInfo = {
        docInfo: undefined,
        href: "",
        locations: {
            cfi: undefined,
            cssSelector: undefined,
            position: undefined,
            progression: undefined,
        },
        paginationInfo: undefined,
        selectionInfo: undefined,
        selectionIsNew: undefined,
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

        const arrayOfKeyboardCaptureElements = ["input", "textarea", "video", "audio", "select"];
        if (arrayOfKeyboardCaptureElements.indexOf((curElement as Element).tagName.toLowerCase()) >= 0) {
            return true;
        }

        curElement = curElement.parentNode;
    }

    return false;
}

function ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable(): number {

    const scrollElement = getScrollingElement(win.document);

    const val = (scrollElement as any).scrollLeftExtra;
    if (val === 0) {
        return 0;
    }
    (scrollElement as any).scrollLeftExtra = 0;
    ipcRenderer.sendToHost(R2_EVENT_SHIFT_VIEW_X,
        { offset: 0, backgroundColor: undefined } as IEventPayload_R2_EVENT_SHIFT_VIEW_X);
    return val;
}
function ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable(scrollLeftExtra: number) {

    const scrollElement = getScrollingElement(win.document);

    (scrollElement as any).scrollLeftExtra = scrollLeftExtra;
    const scrollLeftExtraBackgroundColor = (scrollElement as any).scrollLeftExtraBackgroundColor;

    ipcRenderer.sendToHost(R2_EVENT_SHIFT_VIEW_X,
        {
            backgroundColor: scrollLeftExtraBackgroundColor ? scrollLeftExtraBackgroundColor : undefined,
            offset: (isRTL() ? 1 : -1) * scrollLeftExtra,
        } as IEventPayload_R2_EVENT_SHIFT_VIEW_X);
}

function ensureTwoPageSpreadWithOddColumnsIsOffset(scrollOffset: number, maxScrollShift: number) {

    if (!win || !win.document || !win.document.body || !win.document.documentElement) {
        return;
    }

    const scrollElement = getScrollingElement(win.document);

    const noChange = isPopupDialogOpen(win.document) ||
        !isPaginated(win.document) ||
        !isTwoPageSpread() ||
        isVerticalWritingMode() || // TODO: VWM?
        maxScrollShift <= 0 ||
        Math.abs(scrollOffset) <= maxScrollShift;
    if (noChange) {
        (scrollElement as any).scrollLeftExtra = 0;

        // console.log(`"""""""""""""""""""""""""""""""" noChange: ${maxScrollShift}`);
        // win.document.documentElement.classList.remove("r2-spread-offset");
        ipcRenderer.sendToHost(R2_EVENT_SHIFT_VIEW_X,
            { offset: 0, backgroundColor: undefined } as IEventPayload_R2_EVENT_SHIFT_VIEW_X);
        return;
    }
    // scrollElement.scrollLeft is maxed-out, we need to simulate further scrolling
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

    (scrollElement as any).scrollLeftExtra = extraOffset;
    (scrollElement as any).scrollLeftExtraBackgroundColor = backgroundColor;

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

    clearCurrentSelection(win);
    closePopupDialogs(win.document);

    if (win.READIUM2.isFixedLayout || !win.document.body) {
        ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
        return;
    }

    if (!win.document || !win.document.documentElement) {
        return;
    }

    const scrollElement = getScrollingElement(win.document);

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
            if (isVerticalWritingMode() && (Math.abs(scrollElement.scrollTop) < maxScrollShift) ||
                !isVerticalWritingMode() && (Math.abs(scrollElement.scrollLeft) < maxScrollShift)) { // not at end

                const unit = isVerticalWritingMode() ?
                    win.document.documentElement.offsetHeight :
                    win.document.documentElement.offsetWidth;
                const scrollOffsetPotentiallyExcessive_ = isVerticalWritingMode() ?
                    (scrollElement.scrollTop + unit) :
                    (scrollElement.scrollLeft + (isRTL() ? -1 : 1) * unit);
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

                const targetObj = scrollElement;
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
            if (isVerticalWritingMode() && (Math.abs(scrollElement.scrollLeft) < maxScrollShift) ||
                !isVerticalWritingMode() && (Math.abs(scrollElement.scrollTop) < maxScrollShift)) {
                const newVal = isVerticalWritingMode() ?
                    (scrollElement.scrollLeft + (isRTL() ? -1 : 1) * win.document.documentElement.clientWidth) :
                    (scrollElement.scrollTop + win.document.documentElement.clientHeight);

                const targetObj = scrollElement;
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
            if (isVerticalWritingMode() && (Math.abs(scrollElement.scrollTop) > 0) ||
                !isVerticalWritingMode() && (Math.abs(scrollElement.scrollLeft) > 0)) { // not at begin

                const unit = isVerticalWritingMode() ?
                    win.document.documentElement.offsetHeight :
                    win.document.documentElement.offsetWidth;
                const scrollOffset_ = isVerticalWritingMode() ?
                    (scrollElement.scrollTop - unit) :
                    (scrollElement.scrollLeft - (isRTL() ? -1 : 1) * unit);
                // now snap (just in case):
                // retains +/- sign
                const nWholes = isRTL() ? Math.floor(scrollOffset_ / unit) : Math.ceil(scrollOffset_ / unit);
                const scrollOffset = nWholes * unit;
                // if (scrollOffset !== scrollOffset_) {
                //     // tslint:disable-next-line:max-line-length
                //     console.log(`}}}}}}}}}}}}}}}}2 offset!! ${scrollOffset} != ${scrollOffset_}`);
                // }

                // zero reset
                ensureTwoPageSpreadWithOddColumnsIsOffset(scrollOffset, 0);

                const targetObj = scrollElement;
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
            if (isVerticalWritingMode() && (Math.abs(scrollElement.scrollLeft) > 0) ||
                !isVerticalWritingMode() && (Math.abs(scrollElement.scrollTop) > 0)) {
                const newVal = isVerticalWritingMode() ?
                    (scrollElement.scrollLeft - (isRTL() ? -1 : 1) * win.document.documentElement.clientWidth) :
                    (scrollElement.scrollTop - win.document.documentElement.clientHeight);

                const targetObj = scrollElement;
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

        const scrollElement = getScrollingElement(win.document);

        const rect = element.getBoundingClientRect();
        // calculateMaxScrollShift()
        // TODO: vertical writing mode
        const scrollTopMax = scrollElement.scrollHeight - win.document.documentElement.clientHeight;
        let offset = scrollElement.scrollTop + (rect.top - (win.document.documentElement.clientHeight / 2));
        if (offset > scrollTopMax) {
            offset = scrollTopMax;
        } else if (offset < 0) {
            offset = 0;
        }
        scrollElement.scrollTop = offset;
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

    const scrollElement = getScrollingElement(win.document);

    const rect = element.getBoundingClientRect();

    const columnDimension = calculateColumnDimension();

    const isTwoPage = isTwoPageSpread();

    const fullOffset = (isRTL() ?
        ((columnDimension * (isTwoPage ? 2 : 1)) - (rect.left + rect.width)) :
        rect.left) +
        ((isRTL() ? -1 : 1) * scrollElement.scrollLeft);

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

    const scrollElement = getScrollingElement(win.document);

    // scrollLeft is capped at maxScrollShift by the browser engine
    const scrollOffset = (scrollLeftPotentiallyExcessive < 0 ? -1 : 1) *
        Math.min(Math.abs(scrollLeftPotentiallyExcessive), maxScrollShift);
    scrollElement.scrollLeft = scrollOffset;
}

const scrollToHashRaw = () => {
    if (!win.document || !win.document.body || !win.document.documentElement) {
        return;
    }

    debug("++++ scrollToHashRaw");

    recreateAllHighlights(win);

    const isPaged = isPaginated(win.document);

    if (win.READIUM2.locationHashOverride) {
        // if (win.READIUM2.locationHashOverride === win.document.body) {
        //     notifyReadingLocationDebounced();
        //     return;
        // }
        // _ignoreScrollEvent = true;
        scrollElementIntoView(win.READIUM2.locationHashOverride);

        notifyReadingLocationDebounced();
        return;
    } else if (win.READIUM2.hashElement) {
        win.READIUM2.locationHashOverride = win.READIUM2.hashElement;

        // _ignoreScrollEvent = true;
        scrollElementIntoView(win.READIUM2.hashElement);

        notifyReadingLocationDebounced();
        return;
    } else {
        const scrollElement = getScrollingElement(win.document);

        if (win.READIUM2.urlQueryParams) {
            // tslint:disable-next-line:no-string-literal
            const previous = win.READIUM2.urlQueryParams[URL_PARAM_PREVIOUS];
            const isPreviousNavDirection = previous === "true";
            if (isPreviousNavDirection) {
                const { maxScrollShift, maxScrollShiftAdjusted } = calculateMaxScrollShift();

                _ignoreScrollEvent = true;
                if (isPaged) {
                    if (isVerticalWritingMode()) {
                        scrollElement.scrollLeft = 0;
                        scrollElement.scrollTop = maxScrollShift;
                    } else {
                        const scrollLeftPotentiallyExcessive = (isRTL() ? -1 : 1) * maxScrollShiftAdjusted;
                        // tslint:disable-next-line:max-line-length
                        ensureTwoPageSpreadWithOddColumnsIsOffset(scrollLeftPotentiallyExcessive, maxScrollShift);
                        const scrollLeft = (isRTL() ? -1 : 1) * maxScrollShift;
                        scrollElement.scrollLeft = scrollLeft;
                        scrollElement.scrollTop = 0;
                    }
                } else {
                    if (isVerticalWritingMode()) {
                        scrollElement.scrollLeft = (isRTL() ? -1 : 1) * maxScrollShift;
                        scrollElement.scrollTop = 0;
                    } else {
                        scrollElement.scrollLeft = 0;
                        scrollElement.scrollTop = maxScrollShift;
                    }
                }

                win.READIUM2.locationHashOverride = undefined;
                resetLocationHashOverrideInfo();

                setTimeout(() => {
                    // relative to fixed window top-left corner
                    // const y = (isPaged ?
                    //     (isVerticalWritingMode() ?
                    //         win.document.documentElement.offsetWidth :
                    //         win.document.documentElement.offsetHeight) :
                    //     (isVerticalWritingMode() ?
                    //         win.document.documentElement.clientWidth :
                    //         win.document.documentElement.clientHeight))
                    // - 1;
                    // processXYRaw(0, y, true);
                    processXYRaw(0, 0, false);

                    showHideContentMask(false);

                    if (!win.READIUM2.locationHashOverride) { // already in processXYRaw()
                        notifyReadingLocationDebounced();
                    }

                    setTimeout(() => {
                        _ignoreScrollEvent = false;
                    }, 10);
                }, 60);
                return;
            }

            // tslint:disable-next-line:no-string-literal
            const gto = win.READIUM2.urlQueryParams[URL_PARAM_GOTO];
            let gotoCssSelector: string | undefined;
            let gotoProgression: number | undefined;
            if (gto) {
                // decodeURIComponent
                const s = Buffer.from(gto, "base64").toString("utf8");
                const js = JSON.parse(s);
                gotoCssSelector = (js as LocatorLocations).cssSelector;
                gotoProgression = (js as LocatorLocations).progression;
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
            } else if (gotoProgression) {
                const { maxScrollShift } = calculateMaxScrollShift();

                if (isPaged) {
                    const isTwoPage = isTwoPageSpread();
                    const nColumns = calculateTotalColumns();
                    const nUnits = isTwoPage ? Math.ceil(nColumns / 2) : nColumns;
                    const unitIndex = Math.floor(gotoProgression * nUnits);

                    const unit = isVerticalWritingMode() ?
                        win.document.documentElement.offsetHeight :
                        win.document.documentElement.offsetWidth;

                    const scrollOffsetPotentiallyExcessive = isVerticalWritingMode() ?
                        (unitIndex * unit) :
                        ((isRTL() ? -1 : 1) * unitIndex * unit);

                    // tslint:disable-next-line:max-line-length
                    ensureTwoPageSpreadWithOddColumnsIsOffset(scrollOffsetPotentiallyExcessive, maxScrollShift);

                    const scrollOffsetPaged = (scrollOffsetPotentiallyExcessive < 0 ? -1 : 1) *
                        Math.min(Math.abs(scrollOffsetPotentiallyExcessive), maxScrollShift);

                    _ignoreScrollEvent = true;
                    if (isVerticalWritingMode()) {
                        scrollElement.scrollTop = scrollOffsetPaged;
                    } else {
                        scrollElement.scrollLeft = scrollOffsetPaged;
                    }
                    setTimeout(() => {
                        _ignoreScrollEvent = false;
                    }, 10);

                    win.READIUM2.locationHashOverride = win.document.body;
                    resetLocationHashOverrideInfo();

                    processXYRaw(0, 0, false);

                    if (!win.READIUM2.locationHashOverride) { // already in processXYRaw()
                        notifyReadingLocationDebounced();
                    }
                    return;
                }
                // !isPaged
                const scrollOffset = gotoProgression * maxScrollShift;

                _ignoreScrollEvent = true;
                if (isVerticalWritingMode()) {
                    scrollElement.scrollLeft = scrollOffset;
                } else {
                    scrollElement.scrollTop = scrollOffset;
                }
                setTimeout(() => {
                    _ignoreScrollEvent = false;
                }, 10);

                win.READIUM2.locationHashOverride = win.document.body;
                resetLocationHashOverrideInfo();

                processXYRaw(0, 0, false);

                if (!win.READIUM2.locationHashOverride) { // already in processXYRaw()
                    notifyReadingLocationDebounced();
                }
                return;
            }
        }

        _ignoreScrollEvent = true;
        scrollElement.scrollLeft = 0;
        scrollElement.scrollTop = 0;
        setTimeout(() => {
            _ignoreScrollEvent = false;
        }, 10);

        win.READIUM2.locationHashOverride = win.document.body;
        resetLocationHashOverrideInfo();

        processXYRaw(0, 0, false);

        // if (!win.READIUM2.locationHashOverride) { // already in processXYRaw()
        //     notifyReadingLocationDebounced();
        //     return;
        // }
    }

    notifyReadingLocationDebounced();
};

const scrollToHashDebounced = debounce(() => {
    debug("++++ scrollToHashRaw FROM DEBOUNCED");
    scrollToHashRaw();
}, 100);

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
    // so right now, resize observer resets body.tabbables. Is that enough? (other edge cases?)
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

    recreateAllHighlights(win);
});

function throttle(fn: (...argz: any[]) => any, time: number) {
    let called = false;
    return (...args: any[]) => {
        if (!called) {
            fn(...args);
            called = true;
            setTimeout(() => {
                called = false;
            }, time);
        }
    };
}

let _docTitle: string | undefined;

win.addEventListener("DOMContentLoaded", () => {
    debug("############# DOMContentLoaded");

    if (win.READIUM2.isAudio) {
        const audioElement = win.document.getElementById("audio") as HTMLAudioElement;

        function notifyPlaybackLocation() {
            const percent = audioElement.currentTime / audioElement.duration;

            win.READIUM2.locationHashOverrideInfo = {
                docInfo: {
                    isFixedLayout: false,
                    isRightToLeft: false,
                    isVerticalWritingMode: false,
                },
                href: "", // filled-in from host index.js renderer
                locations: {
                    cfi: undefined,
                    cssSelector: undefined,
                        // calculated in host index.js renderer, where publication object is available
                    position: undefined,
                    progression: percent,
                },
                paginationInfo: undefined,
                selectionInfo: undefined,
                selectionIsNew: false,
                text: undefined,
                title: _docTitle,
            };
            const payload: IEventPayload_R2_EVENT_READING_LOCATION = win.READIUM2.locationHashOverrideInfo;
            ipcRenderer.sendToHost(R2_EVENT_READING_LOCATION, payload);
        }
        const notifyPlaybackLocationThrottled = throttle(() => {
            notifyPlaybackLocation();
        }, 1000);
        const notifyPlaybackLocationDebounced = debounce(() => {
            notifyPlaybackLocation();
        }, 200);

        audioElement.addEventListener("play", () => {
            notifyPlaybackLocation();
        });
        audioElement.addEventListener("pause", () => {
            notifyPlaybackLocation();
        });
        if (IS_DEV) {
            audioElement.addEventListener("seeked", () => {
                notifyPlaybackLocationDebounced();
            });
        }
        audioElement.addEventListener("ended", () => {
            notifyPlaybackLocation();
            const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
                direction: "LTR",
                go: "NEXT",
            };
            ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
        });

        audioElement.addEventListener("timeupdate", () => {
            notifyPlaybackLocationThrottled();
        });
    }

    const titleElement = win.document.documentElement.querySelector("head > title");
    if (titleElement && titleElement.textContent) {
        _docTitle = titleElement.textContent;
    }

    _cancelInitialScrollCheck = true;

    // const linkUri = new URI(win.location.href);

    if (!win.READIUM2.isAudio &&
        win.location.hash && win.location.hash.length > 1) {

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
                str = Buffer.from(base64ReadiumCSS, "base64").toString("utf8");
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

    // innerWidth/Height can be zero at this rendering stage! :(
    const w = (readiumcssJson && readiumcssJson.fixedLayoutWebViewWidth) || win.innerWidth;
    const h = (readiumcssJson && readiumcssJson.fixedLayoutWebViewHeight) || win.innerHeight;
    const wh = configureFixedLayout(win.document, win.READIUM2.isFixedLayout,
        win.READIUM2.fxlViewportWidth, win.READIUM2.fxlViewportHeight,
        w, h);
    if (wh) {
        win.READIUM2.fxlViewportWidth = wh.width;
        win.READIUM2.fxlViewportHeight = wh.height;
        win.READIUM2.fxlViewportScale = wh.scale;

        // TODO: is that more reliable than CSS transform on HTML root element?
        // webFrame.setZoomFactor(wh.scale);
    }

    const alreadedInjected = win.document.documentElement.hasAttribute("data-readiumcss-injected");
    if (alreadedInjected) {
        debug(">>>>> ReadiumCSS already injected by streamer");
        // console.log(">>>>>2 ReadiumCSS already injected by streamer");
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

    if (!win.READIUM2.isFixedLayout) {
        if (!alreadedInjected) {
            injectDefaultCSS(win.document);
            if (IS_DEV) { // win.READIUM2.DEBUG_VISUALS
                injectReadPosCSS(win.document);
            }
        }

        if (alreadedInjected) { // because querySelector[All]() is not polyfilled
            checkHiddenFootNotes(win.document);
        }
    }

    // sometimes the load event does not occur! (some weird FXL edge case?)
    setTimeout(() => {
        loaded(true);
    }, 500);
});

let _cancelInitialScrollCheck = false;

let _loaded = false;
function loaded(forced: boolean) {
    if (_loaded) {
        return;
    }
    _loaded = true;
    if (forced) {
        debug(">>> LOAD EVENT WAS FORCED!");
    } else {
        debug(">>> LOAD EVENT was not forced.");
    }

    if (win.READIUM2.isAudio) {
        debug("AUDIOBOOK RENDER ...");
        return;
    }

    if (!win.READIUM2.isFixedLayout) {
        debug("++++ scrollToHashDebounced FROM LOAD");
        scrollToHashDebounced();
        // setTimeout(() => {
        //     debug("++++ scrollToHashRaw FROM LOAD");
        //     scrollToHashRaw();
        // }, 100);
        _cancelInitialScrollCheck = false;
        setTimeout(() => {
            if (_cancelInitialScrollCheck) {
                return;
            }
            // if (!isPaginated(win.document)) {
            //     // scrollToHashRaw();
            //     return;
            // }
            // let visible = false;
            // if (win.READIUM2.locationHashOverride === win.document.body ||
            //     win.READIUM2.hashElement === win.document.body) {
            //     visible = true;
            // } else if (win.READIUM2.locationHashOverride) {
            //     visible = computeVisibility_(win.READIUM2.locationHashOverride);
            // } else if (win.READIUM2.hashElement) {
            //     visible = computeVisibility_(win.READIUM2.hashElement);
            // }
            // if (!visible) {
            //     debug("!visible (delayed layout pass?) => forcing second scrollToHashRaw()...");
            //     if (win.READIUM2.locationHashOverride) {
            //         debug(uniqueCssSelector(win.READIUM2.locationHashOverride, win.document, undefined));
            //     }
            //     scrollToHashRaw();
            // }
        }, 500);
    } else {
        // processXYDebounced(0, 0, false);

        win.READIUM2.locationHashOverride = win.document.body;
        notifyReadingLocationDebounced();
    }

    const useResizeObserver = !win.READIUM2.isFixedLayout;
    if (useResizeObserver && win.document.body) {

        setTimeout(() => {
            let _firstResizeObserver = true;
            const resizeObserver = new (window as any).ResizeObserver((_entries: any) => { // ResizeObserverEntries
                // for (const entry of entries) {
                //     const rect = entry.contentRect as DOMRect;
                //     const element = entry.target as HTMLElement;
                // }

                if (_firstResizeObserver) {
                    _firstResizeObserver = false;
                    debug("ResizeObserver SKIP FIRST");
                    return;
                }
                // debug("ResizeObserver");

                (win.document.body as any).tabbables = undefined;

                // debug("++++ scrollToHashDebounced from ResizeObserver");
                scrollToHashDebounced();
            });
            resizeObserver.observe(win.document.body);

            setTimeout(() => {
                if (_firstResizeObserver) {
                    _firstResizeObserver = false;
                    debug("ResizeObserver CANCEL SKIP FIRST");
                }
            }, 700);
            // Note that legacy ResizeSensor sets body position to "relative" (default static).
            // Also note that ReadiumCSS default to (via stylesheet :root):
            // document.documentElement.style.position = "relative";
        }, 1000);
        // win.requestAnimationFrame((_timestamp) => {
        // });
    }

    // // "selectionchange" event NOT SUITABLE
    // // IF selection.removeAllRanges() + selection.addRange(range) in selection.ts
    // // (normalization of selection to single range => infinite loop!!)
    // // PROBLEM: "selectionstart" DOES NOT ALWAYS TRIGGER :(
    // win.document.addEventListener("selectionstart", (_ev: any) => {
    //     // notifyReadingLocationDebounced();
    //     debug("############ selectionstart EVENT:");
    //     const selInfo = getCurrentSelectionInfo(win, getCssSelector, computeCFI);
    //     debug(selInfo);
    //     if (win.READIUM2.DEBUG_VISUALS) {
    //         if (selInfo) {
    //             createHighlight(win.document, selInfo);
    //         }
    //     }
    // });

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
        // DEPRECATED
        // if (ev.keyCode === 37 || ev.keyCode === 39) { // left / right
        // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode
        // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
        // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code/code_values
        if (ev.code === "ArrowLeft" || ev.code === "ArrowRight") {
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

    win.document.addEventListener("click", (ev: MouseEvent) => {

        let currentElement = ev.target as Element;
        let href: string | undefined;
        while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
            if (currentElement.tagName.toLowerCase() === "a") {
                href = (currentElement as HTMLAnchorElement).href;
                // const href = currentElement.getAttribute("href");
                break;
            }
            currentElement = currentElement.parentNode as Element;
        }

        if (!href) {
            return;
        }

        if (/^javascript:/.test(href)) {
            return;
        }

        ev.preventDefault();
        ev.stopPropagation();

        const done = popupFootNote(
            currentElement as HTMLElement,
            focusScrollRaw,
            href,
            ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable,
            ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable);
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

    const onResizeRaw = () => {
        const wh = configureFixedLayout(win.document, win.READIUM2.isFixedLayout,
            win.READIUM2.fxlViewportWidth, win.READIUM2.fxlViewportHeight,
            win.innerWidth, win.innerHeight);
        if (wh) {
            win.READIUM2.fxlViewportWidth = wh.width;
            win.READIUM2.fxlViewportHeight = wh.height;
            win.READIUM2.fxlViewportScale = wh.scale;
        }

        debug("++++ scrollToHashDebounced FROM RESIZE");
        scrollToHashDebounced();
    };
    const onResizeDebounced = debounce(() => {
        onResizeRaw();
    }, 200);
    let _firstWindowResize = true;
    win.addEventListener("resize", () => {
        if (_firstWindowResize) {
            debug("Window resize, SKIP FIRST");
            _firstWindowResize = false;
            return;
        }
        if (ENABLE_WEBVIEW_RESIZE) {
            onResizeRaw();
        } else {
            onResizeDebounced();
        }
    });

    setTimeout(() => {
        win.addEventListener("scroll", (_ev: Event) => {

            if (_ignoreScrollEvent) {
                _ignoreScrollEvent = false;
                return;
            }

            if (!win.document || !win.document.documentElement) {
                return;
            }

            const x = (isRTL() ? win.document.documentElement.offsetWidth - 1 : 0);
            processXYDebounced(x, 0, false);
        });
    }, 200);

    function handleMouseEvent(ev: MouseEvent) {

        if (isPopupDialogOpen(win.document)) {
            return;
        }

        // relative to fixed window top-left corner
        // (unlike pageX/Y which is relative to top-left rendered content area, subject to scrolling)
        const x = ev.clientX;
        const y = ev.clientY;

        processXYDebounced(x, y, false);

        if (win.READIUM2.ttsClickEnabled) {

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
                if (ev.altKey) {
                    ttsPlay(
                        focusScrollRaw,
                        element,
                        undefined,
                        ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable,
                        ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable);
                    return;
                }

                ttsPlay(
                    focusScrollRaw,
                    (element.ownerDocument as Document).body,
                    element,
                    ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable,
                    ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable);
            }
        }
    }

    // win.document.body.addEventListener("click", (ev: MouseEvent) => {
    //     handleMouseEvent(ev);
    // });
    win.document.documentElement.addEventListener("mouseup", (ev: MouseEvent) => {
        handleMouseEvent(ev);
    });

    win.document.body.addEventListener("copy", (evt: ClipboardEvent) => {
        if (win.READIUM2.isClipboardIntercept) {
            const selection = win.document.getSelection();
            if (selection) {
                const str = selection.toString();
                if (str) {
                    evt.preventDefault();

                    setTimeout(() => {
                        const payload: IEventPayload_R2_EVENT_CLIPBOARD_COPY = {
                            locator: win.READIUM2.locationHashOverrideInfo, // see notifyReadingLocationRaw()
                            txt: str,
                        };
                        ipcRenderer.sendToHost(R2_EVENT_CLIPBOARD_COPY, payload);
                        // if (evt.clipboardData) {
                        //     evt.clipboardData.setData("text/plain", str);
                        // }
                    }, 500); // see notifyReadingLocationDebounced()
                }
            }
        }
    });
}

// after DOMContentLoaded, but sometimes fail to occur (e.g. some fixed layout docs with single image in body!)
win.addEventListener("load", () => {
    debug("############# load");
    // console.log(win.location);
    loaded(false);
});

// // does not occur when re-using same webview (src="href")
// win.addEventListener("unload", () => {
// });

function checkBlacklisted(el: Element): boolean {

    const id = el.getAttribute("id");
    if (id && _blacklistIdClassForCFI.indexOf(id) >= 0) {
        console.log("checkBlacklisted ID: " + id);
        return true;
    }

    for (const item of _blacklistIdClassForCFI) {
        if (el.classList.contains(item)) {
            console.log("checkBlacklisted CLASS: " + item);
            return true;
        }
    }

    const mathJax = win.document.documentElement.classList.contains(ROOT_CLASS_MATHJAX);
    if (mathJax) {
        const low = el.tagName.toLowerCase();
        for (const item of _blacklistIdClassForCFIMathJax) {
            if (low.startsWith(item)) {
                console.log("checkBlacklisted MathJax ELEMENT NAME: " + el.tagName);
                return true;
            }
        }

        if (id) {
            const lowId = id.toLowerCase();
            for (const item of _blacklistIdClassForCFIMathJax) {
                if (lowId.startsWith(item)) {
                    console.log("checkBlacklisted MathJax ID: " + id);
                    return true;
                }
            }
        }

        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < el.classList.length; i++) {
            const cl = el.classList[i];
            const lowCl = cl.toLowerCase();
            for (const item of _blacklistIdClassForCFIMathJax) {
                if (lowCl.startsWith(item)) {
                    console.log("checkBlacklisted MathJax CLASS: " + cl);
                    return true;
                }
            }
        }
    }

    return false;
}

function findFirstVisibleElement(rootElement: Element): Element | undefined {

    const blacklisted = checkBlacklisted(rootElement);
    if (blacklisted) {
        return undefined;
    }

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < rootElement.children.length; i++) {
        const child = rootElement.children[i];
        if (child.nodeType !== Node.ELEMENT_NODE) {
            continue;
        }
        const visibleElement = findFirstVisibleElement(child);
        if (visibleElement) {
            return visibleElement;
        }
    }
    if (rootElement !== win.document.body &&
        rootElement !== win.document.documentElement) {

        const visible = computeVisibility_(rootElement);
        if (visible) {
            return rootElement;
        }
    }
    return undefined;
}

// relative to fixed window top-left corner
const processXYRaw = (x: number, y: number, reverse: boolean) => {

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

    if (!element || element === win.document.body || element === win.document.documentElement) {
        const root = win.document.body; // || win.document.documentElement;
        element = findFirstVisibleElement(root);
        if (!element) {
            debug("|||||||||||||| cannot find visible element inside BODY / HTML????");
            element = win.document.body;
        }
    } else if (!computeVisibility_(element)) { // isPaginated(win.document)
        let next: Element | undefined = element;
        let found: Element | undefined;
        while (next) {
            // const blacklisted = checkBlacklisted(next);
            // if (blacklisted) {
            //     break;
            // }

            const firstInside = findFirstVisibleElement(next);
            if (firstInside) {
                found = firstInside;
                break;
            }
            let sibling: Element | null = reverse ? next.previousElementSibling : next.nextElementSibling;
            let parent: Node | null = next;
            while (!sibling) {
                parent = parent.parentNode;
                if (!parent || parent.nodeType !== Node.ELEMENT_NODE) {
                    break;
                }
                sibling = reverse ?
                    (parent as Element).previousElementSibling :
                    (parent as Element).nextElementSibling;
            }
            next = sibling ? sibling : undefined;
        }
        if (found) {
            element = found;
        } else {
            debug("|||||||||||||| cannot find visible element after current????");
        }
    }
    // if (element) {
    //     debug("|||||||||||||| SELECTED ELEMENT");
    //     debug(element);
    //     if (element) {
    //         debug(uniqueCssSelector(element, win.document, undefined));
    //     }
    // }
    if (element === win.document.body || element === win.document.documentElement) {
        debug("|||||||||||||| BODY/HTML selected????");
    }
    if (element) {
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
const processXYDebounced = debounce((x: number, y: number, reverse: boolean) => {
    processXYRaw(x, y, reverse);
}, 300);

interface IProgressionData {
    percentRatio: number;
    paginationInfo: IPaginationInfo | undefined;
}
export const computeProgressionData = (): IProgressionData => {

    const isPaged = isPaginated(win.document);

    const isTwoPage = isTwoPageSpread();

    const { maxScrollShift, maxScrollShiftAdjusted } = calculateMaxScrollShift();

    const totalColumns = calculateTotalColumns();

    let progressionRatio = 0;

    // zero-based index: 0 <= currentColumn < totalColumns
    let currentColumn = 0;

    const scrollElement = getScrollingElement(win.document);

    let extraShift = 0;
    if (isPaged) {
        if (maxScrollShift > 0) {
            if (isVerticalWritingMode()) {
                progressionRatio = scrollElement.scrollTop / maxScrollShift;
            } else {
                extraShift = (scrollElement as any).scrollLeftExtra;
                // extraShift === maxScrollShiftAdjusted - maxScrollShift

                // console.log("&&&&& EXTRA");
                // console.log(extraShift);
                // console.log(maxScrollShiftAdjusted);
                // console.log(maxScrollShift);
                // console.log(maxScrollShiftAdjusted - maxScrollShift);

                if (extraShift) {
                    progressionRatio = (((isRTL() ? -1 : 1) * scrollElement.scrollLeft) + extraShift) /
                        maxScrollShiftAdjusted;
                } else {
                    progressionRatio = ((isRTL() ? -1 : 1) * scrollElement.scrollLeft) / maxScrollShift;
                }
            }
        }

        // console.log(")))))))) 0 progressionRatio");
        // console.log(progressionRatio);

        // because maxScrollShift excludes whole viewport width of content (0%-100% scroll but minus last page/spread)
        const adjustedTotalColumns = (extraShift ? (totalColumns + 1) : totalColumns) - (isTwoPage ? 2 : 1);
        // tslint:disable-next-line:max-line-length
        // const adjustedTotalColumns = totalColumns - (isTwoPage ? ((maxScrollShiftAdjusted > maxScrollShift) ? 1 : 2) : 1);

        currentColumn = adjustedTotalColumns * progressionRatio;
        // console.log("%%%%%%%% 0 currentColumn");
        // console.log(currentColumn);

        currentColumn = Math.round(currentColumn);
    } else {
        if (maxScrollShift > 0) {
            if (isVerticalWritingMode()) {
                progressionRatio = ((isRTL() ? -1 : 1) * scrollElement.scrollLeft) / maxScrollShift;
            } else {
                progressionRatio = scrollElement.scrollTop / maxScrollShift;
            }
        }
    }

    if (win.READIUM2.locationHashOverride) {
        const element = win.READIUM2.locationHashOverride as HTMLElement;

        // imprecise
        // const offsetTop = computeOffsetTop(element);

        let offset = 0;

        if (isPaged) {

            const visible = computeVisibility_(element);
            if (visible) {
                // because clientRect is based on visual rendering,
                // which does not account for extra shift (CSS transform X-translate of the webview)
                const curCol = extraShift ? (currentColumn - 1) : currentColumn;

                const columnDimension = calculateColumnDimension();
                // console.log("##### columnDimension");
                // console.log(columnDimension);

                if (isVerticalWritingMode()) {
                    const rect = element.getBoundingClientRect();
                    offset = (curCol * scrollElement.scrollWidth) + rect.left +
                        (rect.top >= columnDimension ? scrollElement.scrollWidth : 0);
                } else {
                    const boundingRect = element.getBoundingClientRect();
                    const clientRects = getClientRectsNoOverlap_(element.getClientRects(), false);
                    let rectangle: IRect | undefined;
                    for (const rect of clientRects) {
                        if (!rectangle) {
                            rectangle = rect;
                            continue;
                        }
                        if (isRTL()) {
                            if ((rect.left + rect.width) > (columnDimension * (isTwoPage ? 2 : 1))) {
                                continue;
                            }
                            if (isTwoPage) {
                                if ((boundingRect.left + boundingRect.width) >= columnDimension &&
                                    (rect.left + rect.width) < columnDimension) {
                                    continue;
                                }
                            }
                            if ((boundingRect.left + boundingRect.width) >= 0 &&
                                (rect.left + rect.width) < 0) {
                                continue;
                            }
                        } else {
                            if (rect.left < 0) {
                                continue;
                            }
                            if (boundingRect.left < columnDimension &&
                                rect.left >= columnDimension) {
                                continue;
                            }
                            if (isTwoPage) {
                                const boundary = 2 * columnDimension;
                                if (boundingRect.left < boundary &&
                                    rect.left >= boundary) {
                                    continue;
                                }
                            }
                        }
                        if (rect.top < rectangle.top) {
                            rectangle = rect;
                            continue;
                        }
                    }
                    if (!rectangle) {
                        rectangle = element.getBoundingClientRect();
                    }

                    // console.log("##### RECT TOP LEFT");
                    // console.log(rectangle.top);
                    // console.log(rectangle.left);

                    offset = (curCol * scrollElement.scrollHeight) + rectangle.top;
                    if (isTwoPage) {
                        if (isRTL()) {
                            if (rectangle.left < columnDimension) {
                                offset += scrollElement.scrollHeight;
                            }
                        } else {
                            if (rectangle.left >= columnDimension) {
                                offset += scrollElement.scrollHeight;
                            }
                        }
                    }
                }

                // console.log("##### offset");
                // console.log(offset);

                // includes whitespace beyond bottom/end of document, to fill the unnocupied remainder of the column
                const totalDocumentDimension = ((isVerticalWritingMode() ? scrollElement.scrollWidth :
                    scrollElement.scrollHeight) * totalColumns);
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
            const rect = element.getBoundingClientRect();

            if (isVerticalWritingMode()) {
                offset = ((isRTL() ? -1 : 1) * scrollElement.scrollLeft) + rect.left + (isRTL() ? rect.width : 0);
            } else {
                offset = scrollElement.scrollTop + rect.top;
            }

            progressionRatio = offset /
                (isVerticalWritingMode() ? scrollElement.scrollWidth : scrollElement.scrollHeight);
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
const _blacklistIdClassForCssSelectors = [POPUP_DIALOG_CLASS, TTS_CLASS_INJECTED_SPAN, TTS_CLASS_INJECTED_SUBSPAN, ID_HIGHLIGHTS_CONTAINER, CLASS_HIGHLIGHT_CONTAINER, CLASS_HIGHLIGHT_AREA, CLASS_HIGHLIGHT_BOUNDING_AREA, TTS_ID_INJECTED_PARENT, TTS_ID_SPEAKING_DOC_ELEMENT, ROOT_CLASS_KEYBOARD_INTERACT, ROOT_CLASS_INVISIBLE_MASK, CLASS_PAGINATED, ROOT_CLASS_NO_FOOTNOTES];
const _blacklistIdClassForCssSelectorsMathJax = ["mathjax", "ctxt", "mjx"];

// tslint:disable-next-line:max-line-length
const _blacklistIdClassForCFI = [POPUP_DIALOG_CLASS, TTS_CLASS_INJECTED_SPAN, TTS_CLASS_INJECTED_SUBSPAN, ID_HIGHLIGHTS_CONTAINER, CLASS_HIGHLIGHT_CONTAINER, CLASS_HIGHLIGHT_AREA, CLASS_HIGHLIGHT_BOUNDING_AREA];
// "CtxtMenu_MenuFrame", "CtxtMenu_Info", "CtxtMenu_MenuItem", "CtxtMenu_ContextMenu",
// "CtxtMenu_MenuArrow", "CtxtMenu_Attached_0", "mjx-container", "MathJax"
const _blacklistIdClassForCFIMathJax = ["mathjax", "ctxt", "mjx"];

export const computeCFI = (node: Node): string | undefined => {

    // TODO: handle character position inside text node
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return undefined;
    }

    let cfi = "";

    let currentElement = node as Element;
    while (currentElement.parentNode && currentElement.parentNode.nodeType === Node.ELEMENT_NODE) {
        const blacklisted = checkBlacklisted(currentElement);
        if (!blacklisted) {
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
        } else {
            cfi = "";
        }
        currentElement = currentElement.parentNode as Element;
    }

    return "/" + cfi;
};

const _getCssSelectorOptions = {
    className: (str: string) => {
        if (_blacklistIdClassForCssSelectors.indexOf(str) >= 0) {
            return false;
        }
        const mathJax = win.document.documentElement.classList.contains(ROOT_CLASS_MATHJAX);
        if (mathJax) {
            const low = str.toLowerCase();
            for (const item of _blacklistIdClassForCssSelectorsMathJax) {
                if (low.startsWith(item)) {
                    return false;
                }
            }
        }
        return true;
    },
    idName: (str: string) => {
        if (_blacklistIdClassForCssSelectors.indexOf(str) >= 0) {
            return false;
        }
        const mathJax = win.document.documentElement.classList.contains(ROOT_CLASS_MATHJAX);
        if (mathJax) {
            const low = str.toLowerCase();
            for (const item of _blacklistIdClassForCssSelectorsMathJax) {
                if (low.startsWith(item)) {
                    return false;
                }
            }
        }
        return true;
    },
    tagName: (str: string) => {
        // if (_blacklistIdClassForCssSelectors.indexOf(str) >= 0) {
        //     return false;
        // }
        const mathJax = win.document.documentElement.classList.contains(ROOT_CLASS_MATHJAX);
        if (mathJax) {
            for (const item of _blacklistIdClassForCssSelectorsMathJax) {
                if (str.startsWith(item)) {
                    return false;
                }
            }
        }
        return true;
    },
};
function getCssSelector(element: Element): string {
    try {
        return uniqueCssSelector(element, win.document, _getCssSelectorOptions);
    } catch (err) {
        debug("uniqueCssSelector:");
        debug(err);
        return "";
    }
}

const notifyReadingLocationRaw = () => {
    if (!win.READIUM2.locationHashOverride) {
        return;
    }

    // win.READIUM2.locationHashOverride.nodeType === ELEMENT_NODE

    let progressionData: IProgressionData | undefined;

    const cssSelector = getCssSelector(win.READIUM2.locationHashOverride);
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

    const selInfo = getCurrentSelectionInfo(win, getCssSelector, computeCFI);
    // if (IS_DEV) { // && win.READIUM2.DEBUG_VISUALS
    //     if (selInfo) {
    //         createHighlight(win,
    //             selInfo,
    //             undefined, // default background color
    //             true, // mouse / pointer interaction
    //         );
    //     }
    // }

    const text = selInfo ? {
        after: undefined, // TODO?
        before: undefined, // TODO?
        highlight: selInfo.cleanText,
    } : undefined;

    let selectionIsNew: boolean | undefined;
    if (selInfo) {
        selectionIsNew =
            !win.READIUM2.locationHashOverrideInfo ||
            !win.READIUM2.locationHashOverrideInfo.selectionInfo ||
            !sameSelections(win.READIUM2.locationHashOverrideInfo.selectionInfo, selInfo);
    }

    win.READIUM2.locationHashOverrideInfo = {
        docInfo: {
            isFixedLayout: win.READIUM2.isFixedLayout,
            isRightToLeft: isRTL(),
            isVerticalWritingMode: isVerticalWritingMode(),
        },
        href: "", // filled-in from host index.js renderer
        locations: {
            cfi,
            cssSelector,
            position: undefined, // calculated in host index.js renderer, where publication object is available
            progression,
        },
        paginationInfo: pinfo,
        selectionInfo: selInfo,
        selectionIsNew,
        text,
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
};
const notifyReadingLocationDebounced = debounce(() => {
    notifyReadingLocationRaw();
}, 250);

if (win.READIUM2.isAudio) {
    ipcRenderer.on(R2_EVENT_AUDIO_DO_PLAY, async (_event: any) => {
        const audioElement = win.document.getElementById("audio") as HTMLAudioElement;
        await audioElement.play();
    });
    ipcRenderer.on(R2_EVENT_AUDIO_DO_PAUSE, (_event: any) => {
        const audioElement = win.document.getElementById("audio") as HTMLAudioElement;
        audioElement.pause();
    });
} else {
    ipcRenderer.on(R2_EVENT_TTS_DO_PLAY, (_event: any, payload: IEventPayload_R2_EVENT_TTS_DO_PLAY) => {
        const rootElement = win.document.querySelector(payload.rootElement);
        const startElement = payload.startElement ? win.document.querySelector(payload.startElement) : null;
        ttsPlay(
            focusScrollRaw,
            rootElement ? rootElement : undefined,
            startElement ? startElement : undefined,
            ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable,
            ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable);
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

    ipcRenderer.on(R2_EVENT_HIGHLIGHT_CREATE, (_event: any, payloadPing: IEventPayload_R2_EVENT_HIGHLIGHT_CREATE) => {

        if (payloadPing.highlightDefinitions &&
            payloadPing.highlightDefinitions.length === 1 &&
            payloadPing.highlightDefinitions[0].selectionInfo) {
            const selection = win.getSelection();
            if (selection) {
                // selection.empty();
                selection.removeAllRanges();
                // selection.collapseToStart();
            }
        }

        const highlightDefinitions = !payloadPing.highlightDefinitions ?
            [ { color: undefined, selectionInfo: undefined } as IHighlightDefinition ] :
            payloadPing.highlightDefinitions;

        const highlights: Array<IHighlight | null> = [];

        highlightDefinitions.forEach((highlightDefinition) => {
            const selInfo = highlightDefinition.selectionInfo ? highlightDefinition.selectionInfo :
                getCurrentSelectionInfo(win, getCssSelector, computeCFI);
            if (selInfo) {
                const highlight = createHighlight(
                    win,
                    selInfo,
                    highlightDefinition.color,
                    true, // mouse / pointer interaction
                );
                highlights.push(highlight);
            } else {
                highlights.push(null);
            }
        });

        const payloadPong: IEventPayload_R2_EVENT_HIGHLIGHT_CREATE = {
            highlightDefinitions: payloadPing.highlightDefinitions,
            highlights: highlights.length ? highlights : undefined,
        };
        ipcRenderer.sendToHost(R2_EVENT_HIGHLIGHT_CREATE, payloadPong);
    });

    ipcRenderer.on(R2_EVENT_HIGHLIGHT_REMOVE, (_event: any, payload: IEventPayload_R2_EVENT_HIGHLIGHT_REMOVE) => {
        payload.highlightIDs.forEach((highlightID) => {
            destroyHighlight(win.document, highlightID);
        });
    });

    ipcRenderer.on(R2_EVENT_HIGHLIGHT_REMOVE_ALL, (_event: any) => {
        destroyAllhighlights(win.document);
    });
}
