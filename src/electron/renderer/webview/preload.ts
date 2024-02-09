// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debounce from "debounce";
import * as debug_ from "debug";
import { ipcRenderer } from "electron";
import { isFocusable } from "tabbable";

import { LocatorLocations, LocatorText } from "@r2-shared-js/models/locator";

import { encodeURIComponent_RFC3986 } from "@r2-utils-js/_utils/http/UrlUtils";

import { READIUM2_ELECTRON_HTTP_PROTOCOL } from "../../common/sessions";

import {
    IEventPayload_R2_EVENT_AUDIO_SOUNDTRACK, IEventPayload_R2_EVENT_CAPTIONS,
    IEventPayload_R2_EVENT_CLIPBOARD_COPY, IEventPayload_R2_EVENT_DEBUG_VISUALS,
    IEventPayload_R2_EVENT_FXL_CONFIGURE, IEventPayload_R2_EVENT_HIGHLIGHT_CREATE,
    IEventPayload_R2_EVENT_HIGHLIGHT_REMOVE, IEventPayload_R2_EVENT_LINK,
    IEventPayload_R2_EVENT_LOCATOR_VISIBLE, IEventPayload_R2_EVENT_MEDIA_OVERLAY_CLICK,
    IEventPayload_R2_EVENT_MEDIA_OVERLAY_HIGHLIGHT, IEventPayload_R2_EVENT_MEDIA_OVERLAY_STARTSTOP,
    IEventPayload_R2_EVENT_MEDIA_OVERLAY_STATE,
    IEventPayload_R2_EVENT_PAGE_TURN, IEventPayload_R2_EVENT_READING_LOCATION,
    IEventPayload_R2_EVENT_READIUMCSS, IEventPayload_R2_EVENT_SCROLLTO,
    IEventPayload_R2_EVENT_SHIFT_VIEW_X, IEventPayload_R2_EVENT_TTS_CLICK_ENABLE,
    IEventPayload_R2_EVENT_TTS_DO_NEXT_OR_PREVIOUS, IEventPayload_R2_EVENT_TTS_DO_PLAY,
    IEventPayload_R2_EVENT_TTS_OVERLAY_ENABLE, IEventPayload_R2_EVENT_TTS_PLAYBACK_RATE,
    IEventPayload_R2_EVENT_TTS_SENTENCE_DETECT_ENABLE, IEventPayload_R2_EVENT_TTS_VOICE,
    IEventPayload_R2_EVENT_TTS_SKIP_ENABLE, R2_EVENT_TTS_SKIP_ENABLE,
    IEventPayload_R2_EVENT_WEBVIEW_KEYDOWN, MediaOverlaysStateEnum, R2_EVENT_AUDIO_SOUNDTRACK, R2_EVENT_CAPTIONS,
    R2_EVENT_CLIPBOARD_COPY, R2_EVENT_DEBUG_VISUALS, R2_EVENT_FXL_CONFIGURE,
    R2_EVENT_HIGHLIGHT_CREATE, R2_EVENT_HIGHLIGHT_REMOVE, R2_EVENT_HIGHLIGHT_REMOVE_ALL,
    R2_EVENT_KEYBOARD_FOCUS_REQUEST, R2_EVENT_LINK, R2_EVENT_LOCATOR_VISIBLE,
    R2_EVENT_MEDIA_OVERLAY_CLICK, R2_EVENT_MEDIA_OVERLAY_HIGHLIGHT,
    R2_EVENT_MEDIA_OVERLAY_STARTSTOP, R2_EVENT_MEDIA_OVERLAY_STATE, R2_EVENT_PAGE_TURN, R2_EVENT_PAGE_TURN_RES,
    R2_EVENT_READING_LOCATION, R2_EVENT_READIUMCSS, R2_EVENT_SCROLLTO, R2_EVENT_SHIFT_VIEW_X,
    R2_EVENT_SHOW, R2_EVENT_TTS_CLICK_ENABLE, R2_EVENT_TTS_DO_NEXT, R2_EVENT_TTS_DO_PAUSE,
    R2_EVENT_TTS_DO_PLAY, R2_EVENT_TTS_DO_PREVIOUS, R2_EVENT_TTS_DO_RESUME, R2_EVENT_TTS_DO_STOP,
    R2_EVENT_TTS_OVERLAY_ENABLE, R2_EVENT_TTS_PLAYBACK_RATE, R2_EVENT_TTS_SENTENCE_DETECT_ENABLE,
    R2_EVENT_TTS_VOICE, R2_EVENT_WEBVIEW_KEYDOWN, R2_EVENT_WEBVIEW_KEYUP,
} from "../../common/events";
import { IHighlightDefinition } from "../../common/highlight";
import { IPaginationInfo } from "../../common/pagination";
import {
    appendCSSInline, configureFixedLayout, injectDefaultCSS, injectReadPosCSS, isPaginated,
} from "../../common/readium-css-inject";
import { sameSelections } from "../../common/selection";
import {
    CLASS_PAGINATED, CSS_CLASS_NO_FOCUS_OUTLINE, HIDE_CURSOR_CLASS, LINK_TARGET_CLASS, LINK_TARGET_ALT_CLASS,
    POPOUTIMAGE_CONTAINER_ID, POPUP_DIALOG_CLASS, POPUP_DIALOG_CLASS_COLLAPSE,
    R2_MO_CLASS_ACTIVE, R2_MO_CLASS_ACTIVE_PLAYBACK, R2_MO_CLASS_PAUSED, R2_MO_CLASS_PLAYING, R2_MO_CLASS_STOPPED, ROOT_CLASS_INVISIBLE_MASK,
    ROOT_CLASS_INVISIBLE_MASK_REMOVED, ROOT_CLASS_KEYBOARD_INTERACT, ROOT_CLASS_MATHJAX,
    ROOT_CLASS_NO_FOOTNOTES, ROOT_CLASS_REDUCE_MOTION, SKIP_LINK_ID, TTS_CLASS_PAUSED, TTS_CLASS_PLAYING, TTS_ID_SPEAKING_DOC_ELEMENT,
    WebViewSlotEnum, ZERO_TRANSFORM_CLASS, readPosCssStylesAttr1, readPosCssStylesAttr2,
    readPosCssStylesAttr3, readPosCssStylesAttr4,
    ID_HIGHLIGHTS_CONTAINER,
} from "../../common/styles";
import { IPropertyAnimationState, animateProperty } from "../common/animateProperty";
import { uniqueCssSelector, FRAG_ID_CSS_SELECTOR } from "../common/cssselector2-3";
import { normalizeText } from "../common/dom-text-utils";
import { easings } from "../common/easings";
import { closePopupDialogs, isPopupDialogOpen } from "../common/popup-dialog";
import { getURLQueryParams } from "../common/querystring";
import { IRect, getClientRectsNoOverlap_ } from "../common/rect-utils";
import {
    URL_PARAM_CLIPBOARD_INTERCEPT, URL_PARAM_CSS, URL_PARAM_DEBUG_VISUALS,
    URL_PARAM_EPUBREADINGSYSTEM, URL_PARAM_GOTO, URL_PARAM_GOTO_DOM_RANGE, URL_PARAM_PREVIOUS,
    URL_PARAM_SECOND_WEBVIEW, URL_PARAM_WEBVIEW_SLOT,
} from "../common/url-params";
import { setupAudioBook } from "./audiobook";
import { INameVersion, setWindowNavigatorEpubReadingSystem } from "./epubReadingSystem";
import {
    CLASS_HIGHLIGHT_AREA, CLASS_HIGHLIGHT_BOUNDING_AREA, CLASS_HIGHLIGHT_BOUNDING_AREA_MARGIN, CLASS_HIGHLIGHT_CONTAINER,
    createHighlights, destroyAllhighlights, destroyHighlight,
    recreateAllHighlights, recreateAllHighlightsRaw,
} from "./highlight";
import { popoutImage } from "./popoutImages";
import { popupFootNote } from "./popupFootNotes";
import {
    ttsNext, ttsPause, ttsPlay, ttsPlaybackRate, ttsPrevious, ttsResume, ttsStop, ttsVoice,
} from "./readaloud";
import {
    calculateColumnDimension, calculateMaxScrollShift, calculateTotalColumns, checkHiddenFootNotes,
    computeVerticalRTL, getScrollingElement, isRTL, isTwoPageSpread, isVerticalWritingMode,
    readiumCSS, clearImageZoomOutlineDebounced, clearImageZoomOutline,
} from "./readium-css";
import { clearCurrentSelection, convertRangeInfo, getCurrentSelectionInfo } from "./selection";
import { ReadiumElectronWebviewWindow } from "./state";

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

// import { consoleRedirect } from "../common/console-redirect";
if (IS_DEV) {
    // tslint:disable-next-line:no-var-requires
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cr = require("../common/console-redirect");
    // const releaseConsoleRedirect =
    cr.consoleRedirect("r2:navigator#electron/renderer/webview/preload", process.stdout, process.stderr, true);
}

// import { ENABLE_WEBVIEW_RESIZE } from "../common/webview-resize";

// import { registerProtocol } from "@r2-navigator-js/electron/renderer/common/protocol";
// registerProtocol();

const debug = debug_("r2:navigator#electron/renderer/webview/preload");

const INJECTED_LINK_TXT = "__";

const win = global.window as ReadiumElectronWebviewWindow;

win.READIUM2 = {
    DEBUG_VISUALS: false,
    // dialogs = [],
    fxlViewportHeight: 0,
    fxlViewportScale: 1,
    fxlViewportWidth: 0,
    fxlZoomPercent: 0,
    hashElement: null,
    isAudio: false,
    ignorekeyDownUpEvents: false,
    isClipboardIntercept: false,
    isFixedLayout: false,
    locationHashOverride: undefined,
    locationHashOverrideInfo: {
        audioPlaybackInfo: undefined,
        docInfo: undefined,
        epubPage: undefined,
        epubPageID: undefined,
        headings: undefined,
        href: "",
        locations: {
            cfi: undefined,
            cssSelector: undefined,
            position: undefined,
            progression: undefined,
        },
        paginationInfo: undefined,
        secondWebViewHref: undefined,
        selectionInfo: undefined,
        selectionIsNew: undefined,
        title: undefined,
        userInteract: false,
    },
    ttsClickEnabled: false,
    ttsOverlayEnabled: false,
    ttsPlaybackRate: 1,
    ttsSkippabilityEnabled: false,
    ttsSentenceDetectionEnabled: true,
    ttsVoice: null,
    urlQueryParams: win.location.search ? getURLQueryParams(win.location.search) : undefined,
    webViewSlot: WebViewSlotEnum.center,
};

// const _winAlert = win.alert;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
win.alert = (...args: any[]) => {
    console.log.apply(win, args);
};
// const _winConfirm = win.confirm;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
win.confirm = (...args: any[]): boolean => {
    console.log.apply(win, args);
    return false;
};
// const _winPrompt = win.prompt;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
win.prompt = (...args: any[]): string => {
    console.log.apply(win, args);
    return "";
};

// CSS pixel tolerance margin to detect "end of document reached" (during "next" page turn / scroll)
// This CSS bug is hard to reproduce consistently, only in Windows it seems, maybe due to display DPI?
// (I observed different outcomes with Virtual Machines in various resolutions, versus hardware laptop/tablet)
const CSS_PIXEL_TOLERANCE = 5;

// setTimeout(() => {
//     if (win.alert) {
//         win.alert("win.alert!");
//     }
//     if (win.confirm) {
//         const ok = win.confirm("win.confirm?");
//         console.log(ok);
//     }
//     // NOT SUPPORTED: fatal error in console.
//     if (win.prompt) {
//         const str = win.prompt("win.prompt:");
//         console.log(str);
//     }
// }, 2000);

const TOUCH_SWIPE_DELTA_MIN = 80;
const TOUCH_SWIPE_LONG_PRESS_MAX_TIME = 500;
const TOUCH_SWIPE_MAX_TIME = 500;
let touchstartEvent: TouchEvent | undefined;
let touchEventEnd: TouchEvent | undefined;
win.document.addEventListener(
    "touchstart",
    (event: TouchEvent) => {
        if (isPopupDialogOpen(win.document)) {
            touchstartEvent = undefined;
            touchEventEnd = undefined;
            return;
        }
        if (event.changedTouches.length !== 1) {
            return;
        }
        touchstartEvent = event;
    },
    true,
);
win.document.addEventListener(
    "touchend",
    (event: TouchEvent) => {
        if (isPopupDialogOpen(win.document)) {
            touchstartEvent = undefined;
            touchEventEnd = undefined;
            return;
        }
        if (event.changedTouches.length !== 1) {
            return;
        }
        if (!touchstartEvent) {
            return;
        }

        const startTouch = touchstartEvent.changedTouches[0];
        const endTouch = event.changedTouches[0];

        if (!startTouch || !endTouch) {
            return;
        }

        const deltaX =
            (startTouch.clientX - endTouch.clientX) / win.devicePixelRatio;
        const deltaY =
            (startTouch.clientY - endTouch.clientY) / win.devicePixelRatio;

        if (
            Math.abs(deltaX) < TOUCH_SWIPE_DELTA_MIN &&
            Math.abs(deltaY) < TOUCH_SWIPE_DELTA_MIN
        ) {
            if (touchEventEnd) {
                touchstartEvent = undefined;
                touchEventEnd = undefined;
                return;
            }

            if (
                event.timeStamp - touchstartEvent.timeStamp >
                TOUCH_SWIPE_LONG_PRESS_MAX_TIME
            ) {
                touchstartEvent = undefined;
                touchEventEnd = undefined;
                return;
            }

            touchstartEvent = undefined;
            touchEventEnd = event;
            return;
        }

        touchEventEnd = undefined;

        if (
            event.timeStamp - touchstartEvent.timeStamp >
            TOUCH_SWIPE_MAX_TIME
        ) {
            touchstartEvent = undefined;
            return;
        }

        const slope =
            (startTouch.clientY - endTouch.clientY) /
            (startTouch.clientX - endTouch.clientX);
        if (Math.abs(slope) > 0.5) {
            touchstartEvent = undefined;
            return;
        }

        const rtl = isRTL();
        if (deltaX < 0) {
            // navLeftOrRight(!rtl);
            // navPreviousOrNext(rtl)
            const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
                // direction: rtl ? "RTL" : "LTR",
                go: rtl ? "PREVIOUS" : "NEXT",
                nav: true,
            };
            ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
        } else {
            // navLeftOrRight(rtl);
            // navPreviousOrNext(!rtl)
            const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
                // direction: rtl ? "RTL" : "LTR",
                go: rtl ? "NEXT" : "PREVIOUS",
                nav: true,
            };
            ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
        }

        touchstartEvent = undefined;
    },
    true,
);

function keyDownUpEventHandler(ev: KeyboardEvent, keyDown: boolean) {
    if (win.READIUM2.ignorekeyDownUpEvents) {
        return;
    }
    const elementName = (ev.target && (ev.target as Element).nodeName) ?
        (ev.target as Element).nodeName : "";
    const elementAttributes: { [name: string]: string } = {};
    if (ev.target && (ev.target as Element).attributes) {
        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < (ev.target as Element).attributes.length; i++) {
            const attr = (ev.target as Element).attributes[i];
            elementAttributes[attr.name] = attr.value;
        }
    }
    const payload: IEventPayload_R2_EVENT_WEBVIEW_KEYDOWN = { // same as IEventPayload_R2_EVENT_WEBVIEW_KEYUP
        altKey: ev.altKey,
        code: ev.code,
        ctrlKey: ev.ctrlKey,
        elementAttributes,
        elementName,
        key: ev.key,
        metaKey: ev.metaKey,
        shiftKey: ev.shiftKey,
    };
    ipcRenderer.sendToHost(keyDown ? R2_EVENT_WEBVIEW_KEYDOWN : R2_EVENT_WEBVIEW_KEYUP, payload);
}
win.document.addEventListener("keydown", (ev: KeyboardEvent) => {
    keyDownUpEventHandler(ev, true);
}, {
    capture: true,
    once: false,
    passive: false,
});
win.document.addEventListener("keyup", (ev: KeyboardEvent) => {
    keyDownUpEventHandler(ev, false);
}, {
    capture: true,
    once: false,
    passive: false,
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

    win.READIUM2.webViewSlot =
        win.READIUM2.urlQueryParams[URL_PARAM_WEBVIEW_SLOT] === "left" ? WebViewSlotEnum.left :
            (win.READIUM2.urlQueryParams[URL_PARAM_WEBVIEW_SLOT] === "right" ? WebViewSlotEnum.right :
                WebViewSlotEnum.center);
}

if (IS_DEV) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

function isVisible(element: Element, domRect: DOMRect | undefined): boolean {
    if (win.READIUM2.isFixedLayout) {
        return true;
    } else if (!win.document || !win.document.documentElement || !win.document.body) {
        return false;
    }
    if (element === win.document.body || element === win.document.documentElement) {
        return true;
    }

    const blacklisted = checkBlacklisted(element);
    if (blacklisted) {
        return false;
    }

    const elStyle = win.getComputedStyle(element);
    if (elStyle) {
        const display = elStyle.getPropertyValue("display");
        if (display === "none") {
            if (IS_DEV) {
                debug("element DISPLAY NONE");
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
                debug("element OPACITY ZERO");
            }
            // console.log(element.outerHTML);
            return false;
        }
    }

    const scrollElement = getScrollingElement(win.document);

    const vwm = isVerticalWritingMode();

    if (!isPaginated(win.document)) { // scroll

        const rect = domRect || element.getBoundingClientRect();
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

        if (vwm) {
            if (
                rect.left >= 0 &&
                // (rect.left + rect.width) >= 0 &&
                (rect.left + rect.width) <= win.document.documentElement.clientWidth
                // rect.left <= win.document.documentElement.clientWidth
            ) {
                return true;
            }
        } else {
            if (rect.top >= 0 &&
                // (rect.top + rect.height) >= 0 &&
                (rect.top + rect.height) <= win.document.documentElement.clientHeight
                // rect.top <= win.document.documentElement.clientHeight
            ) {
                return true;
            }
        }

        // tslint:disable-next-line:max-line-length
        // debug(`isVisible FALSE: clientRect TOP: ${rect.top} -- win.document.documentElement.clientHeight: ${win.document.documentElement.clientHeight}`);
        return false;
    }

    // TODO: vertical writing mode
    if (vwm) {
        return false;
    }

    const scrollLeftPotentiallyExcessive = getScrollOffsetIntoView(element as HTMLElement, domRect);

    // const { maxScrollShift, maxScrollShiftAdjusted } = calculateMaxScrollShift();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // debug(`isVisible FALSE: getScrollOffsetIntoView: ${scrollLeftPotentiallyExcessive} -- scrollElement.scrollLeft: ${currentOffset}`);
    return false;
}
function isVisible_(location: LocatorLocations): boolean {

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
            visible = isVisible(selected, undefined); // TODO: domRect of DOM Range in LocatorExtended?
        }
    }
    return visible;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
ipcRenderer.on(R2_EVENT_LOCATOR_VISIBLE, (_event: any, payload: IEventPayload_R2_EVENT_LOCATOR_VISIBLE) => {

    payload.visible = isVisible_(payload.location);
    ipcRenderer.sendToHost(R2_EVENT_LOCATOR_VISIBLE, payload);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
ipcRenderer.on(R2_EVENT_SCROLLTO, (_event: any, payload: IEventPayload_R2_EVENT_SCROLLTO) => {

    if (win.READIUM2.isAudio) {
        return;
    }

    showHideContentMask(false, win.READIUM2.isFixedLayout);

    clearCurrentSelection(win);
    closePopupDialogs(win.document);

    // _cancelInitialScrollCheck = true;

    if (!win.READIUM2.urlQueryParams) {
        win.READIUM2.urlQueryParams = {};
    }
    if (payload.isSecondWebView) {
        win.READIUM2.urlQueryParams[URL_PARAM_SECOND_WEBVIEW] = "1";
    } else {
        win.READIUM2.urlQueryParams[URL_PARAM_SECOND_WEBVIEW] = "0";
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
    if (payload.gotoDomRange) {
        // tslint:disable-next-line:no-string-literal
        win.READIUM2.urlQueryParams[URL_PARAM_GOTO_DOM_RANGE] = payload.gotoDomRange; // decodeURIComponent
    } else {
        // tslint:disable-next-line:no-string-literal
        if (typeof win.READIUM2.urlQueryParams[URL_PARAM_GOTO_DOM_RANGE] !== "undefined") {
            // tslint:disable-next-line:no-string-literal
            delete win.READIUM2.urlQueryParams[URL_PARAM_GOTO_DOM_RANGE];
        }
    }

    if (win.READIUM2.isFixedLayout) {
        win.READIUM2.locationHashOverride = win.document.body;
        resetLocationHashOverrideInfo();

        debug("processXYRaw BODY");
        const x = (isRTL() ? win.document.documentElement.offsetWidth - 1 : 0);
        processXYRaw(x, 0, false);

        notifyReadingLocationDebounced();
        return;
    }

    let delayScrollIntoView = false;
    if (payload.hash) {
        debug(".hashElement = 1");
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
        const scrollElement = getScrollingElement(win.document);
        const scrollTop = scrollElement.scrollTop;
        const scrollLeft = scrollElement.scrollLeft;
        win.location.href = "#";
        setTimeout(() => {
            scrollElement.scrollTop = scrollTop;
            scrollElement.scrollLeft = scrollLeft;
        }, 0);
        win.READIUM2.hashElement = null;
    }

    win.READIUM2.locationHashOverride = undefined;
    resetLocationHashOverrideInfo();

    if (delayScrollIntoView) {
        setTimeout(() => {
            debug("++++ scrollToHashRaw FROM DELAYED SCROLL_TO");
            scrollToHashRaw(false);
        }, 100);
    } else {
        debug("++++ scrollToHashRaw FROM SCROLL_TO");
        scrollToHashRaw(false);
    }
});

function resetLocationHashOverrideInfo() {
    win.READIUM2.locationHashOverrideInfo = {
        audioPlaybackInfo: undefined,
        docInfo: undefined,
        epubPage: undefined,
        epubPageID: undefined,
        headings: undefined,
        href: "",
        locations: {
            cfi: undefined,
            cssSelector: undefined,
            position: undefined,
            progression: undefined,
        },
        paginationInfo: undefined,
        secondWebViewHref: undefined,
        selectionInfo: undefined,
        selectionIsNew: undefined,
        title: undefined,
        userInteract: false,
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (scrollElement as any).scrollLeftExtra;
    if (val === 0) {
        return 0;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (scrollElement as any).scrollLeftExtra = 0;
    ipcRenderer.sendToHost(R2_EVENT_SHIFT_VIEW_X,
        { offset: 0, backgroundColor: undefined } as IEventPayload_R2_EVENT_SHIFT_VIEW_X);
    return val;
}
function ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable(scrollLeftExtra: number) {

    const scrollElement = getScrollingElement(win.document);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (scrollElement as any).scrollLeftExtra = scrollLeftExtra;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    let dialogPopup = isPopupDialogOpen(win.document);
    if (dialogPopup) {
        const diagEl = win.document.getElementById(POPUP_DIALOG_CLASS);
        if (diagEl) {
            const isCollapsed = diagEl.classList.contains(POPUP_DIALOG_CLASS_COLLAPSE);
            if (isCollapsed) {
                dialogPopup = false; // override
            }
        }
    }

    const noChange = dialogPopup ||
        !isPaginated(win.document) ||
        !isTwoPageSpread() ||
        isVerticalWritingMode() || // TODO: VWM?
        maxScrollShift <= 0 ||
        Math.abs(scrollOffset) <= maxScrollShift;
    if (noChange) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (scrollElement as any).scrollLeftExtra = extraOffset;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    if (win.READIUM2.isAudio || win.READIUM2.isFixedLayout || !win.document.body) {
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

    const animationTime = 300;

    if (_lastAnimState && _lastAnimState.animating) {
        win.cancelAnimationFrame(_lastAnimState.id);
        _lastAnimState.object[_lastAnimState.property] = _lastAnimState.destVal;
    }

    const vwm = isVerticalWritingMode();

    if (!goPREVIOUS) { // goPREVIOUS && isRTL() || !goPREVIOUS && !isRTL()) { // right

        const maxScrollShift = calculateMaxScrollShift().maxScrollShift;
        const maxScrollShiftTolerated = maxScrollShift - CSS_PIXEL_TOLERANCE;

        if (isPaged) {
            const unit = vwm ?
                win.document.documentElement.offsetHeight :
                win.document.documentElement.offsetWidth;
            let scrollElementOffset = Math.round(vwm ?
                scrollElement.scrollTop :
                scrollElement.scrollLeft);
            const isNegative = scrollElementOffset < 0;
            const scrollElementOffsetAbs = Math.abs(scrollElementOffset);
            const fractional = scrollElementOffsetAbs / unit;
            const integral = Math.floor(fractional);
            const decimal = fractional - integral;
            const partial = decimal * unit;
            if (partial <= CSS_PIXEL_TOLERANCE) {
                scrollElementOffset = (isNegative ? -1 : 1) * integral * unit;
            } else if (partial >= (unit - CSS_PIXEL_TOLERANCE)) {
                scrollElementOffset = (isNegative ? -1 : 1) * (integral + 1) * unit;
            }
            if (vwm && (scrollElementOffsetAbs < maxScrollShiftTolerated) ||
                !vwm && (scrollElementOffsetAbs < maxScrollShiftTolerated)) {

                const scrollOffsetPotentiallyExcessive_ = vwm ?
                    (scrollElementOffset + unit) :
                    (scrollElementOffset + (isRTL() ? -1 : 1) * unit);
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
                const targetProp = vwm ? "scrollTop" : "scrollLeft";
                if (reduceMotion) {
                    _lastAnimState = undefined;
                    targetObj[targetProp] = scrollOffset;
                } else {
                    _ignoreScrollEvent = true;
                    // _lastAnimState = undefined;
                    // (targetObj as HTMLElement).style.transition = "";
                    // (targetObj as HTMLElement).style.transform = "none";
                    // (targetObj as HTMLElement).style.transition =
                    //     `transform ${animationTime}ms ease-in-out 0s`;
                    // (targetObj as HTMLElement).style.transform =
                    //     vwm ?
                    //     `translateY(${unit}px)` :
                    //     `translateX(${(isRTL() ? -1 : 1) * unit}px)`;
                    // setTimeout(() => {
                    //     (targetObj as HTMLElement).style.transition = "";
                    //     (targetObj as HTMLElement).style.transform = "none";
                    //     targetObj[targetProp] = scrollOffset;
                    // }, animationTime);
                    _lastAnimState = animateProperty(
                        win.cancelAnimationFrame,
                        // undefined,
                        (_cancelled: boolean) => {
                            // debug(cancelled);
                            _ignoreScrollEvent = false;
                            onScrollDebounced();
                        },
                        targetProp,
                        animationTime,
                        targetObj,
                        scrollOffset,
                        win.requestAnimationFrame,
                        easings.easeInOutQuad,
                    );
                }
                payload.go = "";
                // payload.direction = "";
                ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
                return;
            }
        } else {
            if (vwm && (Math.abs(scrollElement.scrollLeft) < (maxScrollShiftTolerated - CSS_PIXEL_TOLERANCE)) ||
                !vwm && (Math.abs(scrollElement.scrollTop) < (maxScrollShiftTolerated - CSS_PIXEL_TOLERANCE))) {
                const newVal = vwm ?
                    (scrollElement.scrollLeft + (isRTL() ? -1 : 1) * win.document.documentElement.clientWidth) :
                    (scrollElement.scrollTop + win.document.documentElement.clientHeight);

                const targetObj = scrollElement;
                const targetProp = vwm ? "scrollLeft" : "scrollTop";
                if (reduceMotion) {
                    _lastAnimState = undefined;
                    targetObj[targetProp] = newVal;
                } else {
                    _ignoreScrollEvent = true;
                    _lastAnimState = animateProperty(
                        win.cancelAnimationFrame,
                        // undefined,
                        (_cancelled: boolean) => {
                            // debug(cancelled);
                            _ignoreScrollEvent = false;
                            onScrollDebounced();
                        },
                        targetProp,
                        animationTime,
                        targetObj,
                        newVal,
                        win.requestAnimationFrame,
                        easings.easeInOutQuad,
                    );
                }
                payload.go = "";
                // payload.direction = "";
                ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
                return;
            }
        }
    } else if (goPREVIOUS) { //  && !isRTL() || !goPREVIOUS && isRTL()) { // left
        if (isPaged) {
            const unit = vwm ?
                win.document.documentElement.offsetHeight :
                win.document.documentElement.offsetWidth;
            let scrollElementOffset = Math.round(vwm ?
                scrollElement.scrollTop :
                scrollElement.scrollLeft);
            const isNegative = scrollElementOffset < 0;
            const scrollElementOffsetAbs = Math.abs(scrollElementOffset);
            const fractional = scrollElementOffsetAbs / unit;
            const integral = Math.floor(fractional);
            const decimal = fractional - integral;
            const partial = decimal * unit;
            if (partial <= CSS_PIXEL_TOLERANCE) {
                scrollElementOffset = (isNegative ? -1 : 1) * integral * unit;
            } else if (partial >= (unit - CSS_PIXEL_TOLERANCE)) {
                scrollElementOffset = (isNegative ? -1 : 1) * (integral + 1) * unit;
            }
            if (vwm && (scrollElementOffsetAbs > 0) ||
                !vwm && (scrollElementOffsetAbs > 0)) {

                const scrollOffset_ = vwm ?
                    (scrollElementOffset - unit) :
                    (scrollElementOffset - (isRTL() ? -1 : 1) * unit);
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
                const targetProp = vwm ? "scrollTop" : "scrollLeft";
                if (reduceMotion) {
                    _lastAnimState = undefined;
                    targetObj[targetProp] = scrollOffset;
                } else {
                    _ignoreScrollEvent = true;
                    _lastAnimState = animateProperty(
                        win.cancelAnimationFrame,
                        // undefined,
                        (_cancelled: boolean) => {
                            // debug(cancelled);
                            _ignoreScrollEvent = false;
                            onScrollDebounced();
                        },
                        targetProp,
                        animationTime,
                        targetObj,
                        scrollOffset,
                        win.requestAnimationFrame,
                        easings.easeInOutQuad,
                    );
                }
                payload.go = "";
                // payload.direction = "";
                ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
                return;
            }
        } else {
            if (vwm && (Math.abs(scrollElement.scrollLeft) > CSS_PIXEL_TOLERANCE) ||
                !vwm && (Math.abs(scrollElement.scrollTop) > CSS_PIXEL_TOLERANCE)) {
                const newVal = vwm ?
                    (scrollElement.scrollLeft - (isRTL() ? -1 : 1) * win.document.documentElement.clientWidth) :
                    (scrollElement.scrollTop - win.document.documentElement.clientHeight);

                const targetObj = scrollElement;
                const targetProp = vwm ? "scrollLeft" : "scrollTop";
                if (reduceMotion) {
                    _lastAnimState = undefined;
                    targetObj[targetProp] = newVal;
                } else {
                    _ignoreScrollEvent = true;
                    _lastAnimState = animateProperty(
                        win.cancelAnimationFrame,
                        // undefined,
                        (_cancelled: boolean) => {
                            // debug(cancelled);
                            _ignoreScrollEvent = false;
                            onScrollDebounced();
                        },
                        targetProp,
                        animationTime,
                        targetObj,
                        newVal,
                        win.requestAnimationFrame,
                        easings.easeInOutQuad,
                    );
                }
                payload.go = "";
                // payload.direction = "";
                ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
                return;
            }
        }
    }

    ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
ipcRenderer.on(R2_EVENT_PAGE_TURN, (_event: any, payload: IEventPayload_R2_EVENT_PAGE_TURN) => {
    // Because 'r2_leftrightKeyboardTimeStamp' is set AFTER the main window left/right keyboard handler!
    setTimeout(() => { // we could debounce too?
        onEventPageTurn(payload);
    }, 100);
});

function focusElement(element: Element) {

    if (element === win.document.body) {
        const attr = (element as HTMLElement).getAttribute("tabindex");
        if (!attr) {
            (element as HTMLElement).setAttribute("tabindex", "-1");
            (element as HTMLElement).classList.add(CSS_CLASS_NO_FOCUS_OUTLINE);
            if (IS_DEV) {
                debug("tabindex -1 set BODY (focusable):");
                debug(getCssSelector(element));
            }
        }
        (element as HTMLElement).focus({preventScroll: true});
    } else {
        (element as HTMLElement).focus();
    }

    // win.blur();
    // win.focus();
    // const payload: IEventPayload_R2_EVENT_KEYBOARD_FOCUS_REQUEST = {
    // };
    ipcRenderer.sendToHost(R2_EVENT_KEYBOARD_FOCUS_REQUEST, null);
    if (IS_DEV) {
        debug("KEYBOARD FOCUS REQUEST (1) ", getCssSelector(element));
    }
}

const tempLinkTargetOutline = (element: Element, time: number, alt: boolean) => {
    let skip = false;
    const targets = win.document.querySelectorAll(`.${LINK_TARGET_CLASS}`);
    targets.forEach((t) => {
        if (alt && !t.classList.contains(LINK_TARGET_ALT_CLASS)) {
            skip = true;
            return;
        }
        // (t as HTMLElement).style.animationPlayState = "paused";
        t.classList.remove(LINK_TARGET_CLASS);
        t.classList.remove(LINK_TARGET_ALT_CLASS);
    });
    if (skip) {
        return;
    }

    (element as HTMLElement).style.animation = "none";
    // trigger layout to restart animation
    // tslint:disable-next-line: no-unused-expression
    void (element as HTMLElement).offsetWidth;
    (element as HTMLElement).style.animation = "";

    element.classList.add(LINK_TARGET_CLASS);
    if (alt) {
        element.classList.add(LINK_TARGET_ALT_CLASS);
    }

    // (element as HTMLElement).style.animationPlayState = "running";

    // if (!(element as any)._TargetAnimationEnd) {
    //     (element as any)._TargetAnimationEnd = (ev: Event) => {
    //         debug("ANIMATION END");
    //         (ev.target as HTMLElement).style.animationPlayState = "paused";
    //     };
    //     element.addEventListener("animationEnd", (element as any)._TargetAnimationEnd);
    // }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((element as any)._timeoutTargetClass) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clearTimeout((element as any)._timeoutTargetClass);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (element as any)._timeoutTargetClass = undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (element as any)._timeoutTargetClass = setTimeout(() => {
        debug("ANIMATION TIMEOUT REMOVE");
        // (element as HTMLElement).style.animationPlayState = "paused";
        element.classList.remove(LINK_TARGET_CLASS);
        element.classList.remove(LINK_TARGET_ALT_CLASS);
    }, time);
};

let _lastAnimState2: IPropertyAnimationState | undefined;
const animationTime2 = 400;

function scrollElementIntoView(element: Element, doFocus: boolean, animate: boolean, domRect: DOMRect | undefined) {

    if (win.READIUM2.DEBUG_VISUALS) {
        const existings = win.document.querySelectorAll(`*[${readPosCssStylesAttr3}]`);
        existings.forEach((existing) => {
            existing.removeAttribute(`${readPosCssStylesAttr3}`);
        });
        element.setAttribute(readPosCssStylesAttr3, "scrollElementIntoView");
    }
    if (win.READIUM2.isFixedLayout) {
        debug("scrollElementIntoView_ SKIP FXL");
        return;
    }

    if (doFocus) {
        // const tabbables = lazyTabbables();
        if (!domRect && !isFocusable(element as HTMLElement)) {
            const attr = (element as HTMLElement).getAttribute("tabindex");
            if (!attr) {
                (element as HTMLElement).setAttribute("tabindex", "-1");
                (element as HTMLElement).classList.add(CSS_CLASS_NO_FOCUS_OUTLINE);
                if (IS_DEV) {
                    debug("tabindex -1 set (focusable):");
                    debug(getCssSelector(element));
                }
            }
        }

        tempLinkTargetOutline(element, 2000, false);

        if (!domRect) {
            focusElement(element);
        }
    }

    setTimeout(() => {
        const isPaged = isPaginated(win.document);
        if (isPaged) {
            scrollIntoView(element as HTMLElement, domRect);
        } else {
            const scrollElement = getScrollingElement(win.document);
            const rect = domRect || element.getBoundingClientRect();
            // calculateMaxScrollShift()

            if (isVisible(element, domRect)) {
                console.log("scrollElementIntoView already visible");
            } else {
                const vwm = isVerticalWritingMode();
                const scrollTopMax = vwm ?
                    (isRTL() ? -1 : 1) * (scrollElement.scrollWidth - win.document.documentElement.clientWidth) :
                    scrollElement.scrollHeight - win.document.documentElement.clientHeight;

                let offset = vwm ?
                    scrollElement.scrollLeft + (rect.left - (win.document.documentElement.clientWidth / 2)) :
                    scrollElement.scrollTop + (rect.top - (win.document.documentElement.clientHeight / 2));

                if (vwm && isRTL()) {
                    if (offset < scrollTopMax) {
                        offset = scrollTopMax;
                    } else if (offset > 0) {
                        offset = 0;
                    }
                } else {
                    if (offset > scrollTopMax) {
                        offset = scrollTopMax;
                    } else if (offset < 0) {
                        offset = 0;
                    }
                }

                const diff = Math.abs((vwm ? scrollElement.scrollLeft : scrollElement.scrollTop) - offset);
                if (diff < 10) {
                    return; // prevents jittering
                }

                const targetProp = vwm ? "scrollLeft" : "scrollTop";
                if (animate) {
                    const reduceMotion = win.document.documentElement.classList.contains(ROOT_CLASS_REDUCE_MOTION);

                    if (_lastAnimState2 && _lastAnimState2.animating) {
                        win.cancelAnimationFrame(_lastAnimState2.id);
                        _lastAnimState2.object[_lastAnimState2.property] = _lastAnimState2.destVal;
                    }

                    // scrollElement.scrollTop = offset;
                    const targetObj = scrollElement;
                    if (reduceMotion) {
                        _lastAnimState2 = undefined;
                        targetObj[targetProp] = offset;
                    } else {
                        _ignoreScrollEvent = true;
                        // _lastAnimState = undefined;
                        // (targetObj as HTMLElement).style.transition = "";
                        // (targetObj as HTMLElement).style.transform = "none";
                        // (targetObj as HTMLElement).style.transition =
                        //     `transform ${animationTime}ms ease-in-out 0s`;
                        // (targetObj as HTMLElement).style.transform =
                        //     isVerticalWritingMode() ?
                        //     `translateY(${unit}px)` :
                        //     `translateX(${(isRTL() ? -1 : 1) * unit}px)`;
                        // setTimeout(() => {
                        //     (targetObj as HTMLElement).style.transition = "";
                        //     (targetObj as HTMLElement).style.transform = "none";
                        //     targetObj[targetProp] = offset;
                        // }, animationTime);
                        _lastAnimState2 = animateProperty(
                            win.cancelAnimationFrame,
                            // undefined,
                            (_cancelled: boolean) => {
                                // debug(cancelled);
                                _ignoreScrollEvent = false;
                                onScrollDebounced();
                            },
                            targetProp,
                            animationTime2,
                            targetObj,
                            offset,
                            win.requestAnimationFrame,
                            easings.easeInOutQuad,
                        );
                    }
                } else {
                    scrollElement[targetProp] = offset;
                }

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
    }, doFocus ? 100 : 0);
}

// TODO: vertical writing mode
function getScrollOffsetIntoView(element: HTMLElement, domRect: DOMRect | undefined): number {
    if (!win.document || !win.document.documentElement || !win.document.body ||
        !isPaginated(win.document) || isVerticalWritingMode()) {
        return 0;
    }

    const scrollElement = getScrollingElement(win.document);

    const rect = domRect || element.getBoundingClientRect();

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
function scrollIntoView(element: HTMLElement, domRect: DOMRect | undefined) {
    if (!win.document || !win.document.documentElement || !win.document.body || !isPaginated(win.document)) {
        return;
    }
    const maxScrollShift = calculateMaxScrollShift().maxScrollShift;
    const scrollLeftPotentiallyExcessive = getScrollOffsetIntoView(element, domRect);
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

const scrollToHashRaw = (animate: boolean) => {
    if (!win.document || !win.document.body || !win.document.documentElement) {
        return;
    }

    recreateAllHighlightsRaw(win);

    // if (win.READIUM2.isFixedLayout) {
    //     debug("scrollToHashRaw skipped, FXL");
    //     return;
    // }

    debug("++++ scrollToHashRaw");

    const isPaged = isPaginated(win.document);

    const vwm = isVerticalWritingMode();

    if (win.READIUM2.locationHashOverride) {
        // if (win.READIUM2.locationHashOverride === win.document.body) {
        //     notifyReadingLocationDebounced();
        //     return;
        // }
        // _ignoreScrollEvent = true;
        scrollElementIntoView(win.READIUM2.locationHashOverride, true, animate, undefined);

        notifyReadingLocationDebounced();
        return;
    } else if (win.READIUM2.hashElement) {
        win.READIUM2.locationHashOverride = win.READIUM2.hashElement;

        // _ignoreScrollEvent = true;
        scrollElementIntoView(win.READIUM2.hashElement, true, animate, undefined);

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
                    if (vwm) {
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
                    if (vwm) {
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
                    //     (vwm ?
                    //         win.document.documentElement.offsetWidth :
                    //         win.document.documentElement.offsetHeight) :
                    //     (vwm ?
                    //         win.document.documentElement.clientWidth :
                    //         win.document.documentElement.clientHeight))
                    // - 1;
                    // processXYRaw(0, y, true);
                    const x = (isRTL() ? win.document.documentElement.offsetWidth - 1 : 0);
                    processXYRaw(x, 0, false);

                    showHideContentMask(false, win.READIUM2.isFixedLayout);

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
                const locStr = Buffer.from(gto, "base64").toString("utf8");
                const locObj = JSON.parse(locStr) as LocatorLocations;
                gotoCssSelector = locObj.cssSelector;
                gotoProgression = locObj.progression;
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
                    debug(".hashElement = 2");
                    win.READIUM2.hashElement = selected;

                    resetLocationHashOverrideInfo();
                    if (win.READIUM2.locationHashOverrideInfo) {
                        win.READIUM2.locationHashOverrideInfo.locations.cssSelector = gotoCssSelector;
                    }

                    let domRect: DOMRect | undefined;
                    // tslint:disable-next-line:no-string-literal
                    const gtoDomRange = win.READIUM2.urlQueryParams[URL_PARAM_GOTO_DOM_RANGE];
                    if (gtoDomRange) {
                        try {
                            // decodeURIComponent
                            const rangeInfoStr = Buffer.from(gtoDomRange, "base64").toString("utf8");
                            const rangeInfo = JSON.parse(rangeInfoStr);
                            debug("rangeInfo", rangeInfo);
                            const domRange = convertRangeInfo(win.document, rangeInfo);
                            if (domRange) {
                                domRect = domRange.getBoundingClientRect();
                            }
                        } catch (err) {
                            debug("gtoDomRange", err);
                        }
                    }

                    // _ignoreScrollEvent = true;
                    scrollElementIntoView(selected, true, animate, domRect);

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

                    const unit = vwm ?
                        win.document.documentElement.offsetHeight :
                        win.document.documentElement.offsetWidth;

                    const scrollOffsetPotentiallyExcessive = vwm ?
                        (unitIndex * unit) :
                        ((isRTL() ? -1 : 1) * unitIndex * unit);

                    // tslint:disable-next-line:max-line-length
                    ensureTwoPageSpreadWithOddColumnsIsOffset(scrollOffsetPotentiallyExcessive, maxScrollShift);

                    const scrollOffsetPaged = (scrollOffsetPotentiallyExcessive < 0 ? -1 : 1) *
                        Math.min(Math.abs(scrollOffsetPotentiallyExcessive), maxScrollShift);

                    _ignoreScrollEvent = true;
                    if (vwm) {
                        scrollElement.scrollTop = scrollOffsetPaged;
                    } else {
                        scrollElement.scrollLeft = scrollOffsetPaged;
                    }
                    setTimeout(() => {
                        _ignoreScrollEvent = false;
                    }, 10);

                    win.READIUM2.locationHashOverride = win.document.body;
                    resetLocationHashOverrideInfo();
                    focusElement(win.READIUM2.locationHashOverride);

                    const x = (isRTL() ? win.document.documentElement.offsetWidth - 1 : 0);
                    processXYRaw(x, 0, false);

                    if (!win.READIUM2.locationHashOverride) { // already in processXYRaw()
                        notifyReadingLocationDebounced();
                    }
                    return;
                }
                // !isPaged
                const scrollOffset = gotoProgression * maxScrollShift;

                // console.log(`DEBUGxx maxScrollShift: ${maxScrollShift}`);
                // console.log(`DEBUGxx gotoProgression: ${gotoProgression}`);
                // console.log(`DEBUGxx scrollOffset: ${scrollOffset}`);

                _ignoreScrollEvent = true;
                if (vwm) {
                    scrollElement.scrollLeft = (isRTL() ? -1 : 1) * scrollOffset;
                } else {
                    scrollElement.scrollTop = scrollOffset;
                }
                setTimeout(() => {
                    _ignoreScrollEvent = false;
                }, 10);

                win.READIUM2.locationHashOverride = win.document.body;
                resetLocationHashOverrideInfo();
                focusElement(win.READIUM2.locationHashOverride);

                // maxScrollShift === scrollElement.scrollWidth - win.document.documentElement.clientWidth
                // * gotoProgression ?
                const x = (isRTL() ? win.document.documentElement.offsetWidth - 1 : 0);
                processXYRaw(x, 0, false);

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
        focusElement(win.READIUM2.locationHashOverride);

        debug("processXYRaw BODY");
        const x = (isRTL() ? win.document.documentElement.offsetWidth - 1 : 0);
        processXYRaw(x, 0, false);

        // if (!win.READIUM2.locationHashOverride) { // already in processXYRaw()
        //     notifyReadingLocationDebounced();
        //     return;
        // }
    }

    notifyReadingLocationDebounced();
};

const scrollToHashDebounced = debounce((animate: boolean) => {
    debug("++++ scrollToHashRaw FROM DEBOUNCED");
    scrollToHashRaw(animate);
}, 100);

let _ignoreScrollEvent = false;

// function testReadiumCSS(readiumcssJson: IEventPayload_R2_EVENT_READIUMCSS | undefined) {
//     const oldHTML = win.document.documentElement.outerHTML;
//     const iBody = oldHTML.indexOf("<body");
//     debug(oldHTML.substr(0, iBody + 100));

//     let newHTML: string | undefined;
//     try {
//         newHTML = readiumCssTransformHtml(oldHTML, readiumcssJson, "application/xhtml+xml");
//     } catch (err) {
//         debug(err);
//         return;
//     }

//     const iBody_ = newHTML.indexOf("<body");
//     debug(newHTML.substr(0, iBody_ + 100));
// }

// ipcRenderer.on("R2_EVENT_HIDE", (_event: any, payload: boolean | null) => {
//     showHideContentMask(true, payload);
// });

function showHideContentMask(doHide: boolean, isFixedLayout: boolean | null) {
    if (doHide) {
        win.document.documentElement.classList.add(ROOT_CLASS_INVISIBLE_MASK);
        win.document.documentElement.classList.remove(ROOT_CLASS_INVISIBLE_MASK_REMOVED);
    } else {
        ipcRenderer.sendToHost(R2_EVENT_SHOW, null);

        if (isFixedLayout) {
            win.document.documentElement.classList.add(ROOT_CLASS_INVISIBLE_MASK_REMOVED);
        }
        win.document.documentElement.classList.remove(ROOT_CLASS_INVISIBLE_MASK);
    }
}

function focusScrollRaw(el: HTMLOrSVGElement, doFocus: boolean, animate: boolean, domRect: DOMRect | undefined) {

    if (
        // !isPaginated(win.document) &&
        !isVisible(el as HTMLElement, domRect)) {

        scrollElementIntoView(el as HTMLElement, doFocus, animate, domRect);
    }

    if (win.READIUM2.locationHashOverride === (el as HTMLElement)) {
        return;
    }

    const blacklisted = checkBlacklisted(el as HTMLElement);
    if (blacklisted) {
        return;
    }

    debug(".hashElement = 3");
    // underscore special link will prioritise hashElement!
    win.READIUM2.hashElement = doFocus ? el as HTMLElement : win.READIUM2.hashElement;
    win.READIUM2.locationHashOverride = el as HTMLElement;
    notifyReadingLocationDebounced();
}
const focusScrollDebounced =
    debounce((el: HTMLOrSVGElement, doFocus: boolean, animate: boolean, domRect: DOMRect | undefined) => {

        focusScrollRaw(el, doFocus, animate, domRect);
    }, 100);

// let _ignoreFocusInEvent = false;

// function lazyTabbables(): HTMLElement[] {
//     // cache problem: temporary tabbables? (e.g. HTML5 details/summary element, expand/collapse)
//     // so right now, resize observer resets body.tabbables. Is that enough? (other edge cases?)
//     const alreadySet: HTMLElement[] = (win.document.body as any).tabbables;
//     return alreadySet ? alreadySet :
//         ((win.document.body as any).tabbables = tabbable(win.document.body) as HTMLElement[]);
// }
const handleFocusInDebounced = debounce((target: HTMLElement, tabKeyDownEvent: KeyboardEvent | undefined) => {
    handleFocusInRaw(target, tabKeyDownEvent);
}, 100);
function handleFocusInRaw(target: HTMLElement, _tabKeyDownEvent: KeyboardEvent | undefined) {
    if (!target || !win.document.body) {
        return;
    }
    // _ignoreFocusInEvent = true;

    // doFocus is false (important, as otherwise
    // underscore special link will prioritise hashElement)
    focusScrollRaw(target, false, false, undefined);
}
// function handleTabRaw(target: HTMLElement, tabKeyDownEvent: KeyboardEvent | undefined) {
//     if (!target || !win.document.body) {
//         return;
//     }

//     // target
//     // tab-keydown => originating element (will leave focus)
//     // focusin => destination element (focuses in)

//     // evt
//     // non-nil when tab-keydown
//     // nil when focusin
//     // const isTabKeyDownEvent = typeof evt !== "undefined";
//     // const isFocusInEvent = !isTabKeyDownEvent;

//     _ignoreFocusInEvent = false;

//     const tabbables = lazyTabbables();

//     // freshly-created, let's insert the first tab stop (SKIP_LINK_ID = readium2_skip_link)
//     // if (!alreadySet && tabbables) {
//     //     let skipLinkIndex = -1;
//     //     const skipLink = tabbables.find((t, arrayIndex) => {
//     //         skipLinkIndex = arrayIndex;
//     //         return t.getAttribute && t.getAttribute("id") === SKIP_LINK_ID;
//     //     });
//     //     if (skipLink && skipLinkIndex >= 0) {
//     //         (win.document.body as any).tabbables.splice(skipLinkIndex, 1);
//     //         (win.document.body as any).tabbables.unshift(skipLink);
//     //         tabbables = (win.document.body as any).tabbables;
//     //     }
//     // }

//     const i = tabbables ? tabbables.indexOf(target) : -1;
//     // debug("TABBABLE: " + i);

//     if (i === 0) {
//         // debug("FIRST TABBABLE");
//         // prevent the webview from cycling scroll (does its own unwanted focus)
//         if (!tabKeyDownEvent || tabKeyDownEvent.shiftKey) {
//             // debug("FIRST TABBABLE focusin or shift-tab");
//             _ignoreFocusInEvent = true;
//             focusScrollDebounced(target, true);
//             return;
//         }
//         if (i < (tabbables.length - 1)) {
//             // debug("TABBABLE FORWARD >>");
//             tabKeyDownEvent.preventDefault();
//             const nextTabbable = tabbables[i + 1];
//             focusScrollDebounced(nextTabbable, true);
//             return;
//         }
//         // debug("FIRST TABBABLE ??");
//     } else if (i === (tabbables.length - 1)) {
//         // debug("LAST TABBABLE");
//         // prevent the webview from cycling scroll (does its own unwanted focus)
//         if (!tabKeyDownEvent || !tabKeyDownEvent.shiftKey) {
//             // debug("LAST TABBABLE focusin or no-shift-tab");
//             _ignoreFocusInEvent = true;
//             focusScrollDebounced(target, true);
//             return;
//         }
//         if (i > 0) {
//             // debug("TABBABLE BACKWARD <<");
//             tabKeyDownEvent.preventDefault();
//             const previousTabbable = tabbables[i - 1];
//             focusScrollDebounced(previousTabbable, true);
//             return;
//         }
//         // debug("LAST TABBABLE??");
//     } else if (i > 0) {
//         if (tabKeyDownEvent) {
//             if (tabKeyDownEvent.shiftKey) {
//                 // debug("TABBABLE BACKWARD <<");
//                 tabKeyDownEvent.preventDefault();
//                 const previousTabbable = tabbables[i - 1];
//                 focusScrollDebounced(previousTabbable, true);
//                 return;
//             } else {
//                 // debug("TABBABLE FORWARD >>");
//                 tabKeyDownEvent.preventDefault();
//                 const nextTabbable = tabbables[i + 1];
//                 focusScrollDebounced(nextTabbable, true);
//                 return;
//             }
//         }
//     }
//     if (!tabKeyDownEvent) {
//         // debug("FOCUSIN force");
//         focusScrollDebounced(target, true);
//     }
// }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
ipcRenderer.on(R2_EVENT_READIUMCSS, (_event: any, payload: IEventPayload_R2_EVENT_READIUMCSS) => {
    showHideContentMask(true, payload.isFixedLayout || win.READIUM2.isFixedLayout);
    readiumCSS(win.document, payload);
    recreateAllHighlights(win);
    showHideContentMask(false, payload.isFixedLayout || win.READIUM2.isFixedLayout);
});

let _docTitle: string | undefined;

win.addEventListener("DOMContentLoaded", () => {
    debug("############# DOMContentLoaded");

    const titleElement = win.document.documentElement.querySelector("head > title");
    if (titleElement && titleElement.textContent) {
        _docTitle = titleElement.textContent;
    }

    // _cancelInitialScrollCheck = true;

    // const linkUri = new URI(win.location.href);

    if (!win.READIUM2.isAudio &&
        win.location.hash && win.location.hash.length > 1) {

        debug(".hashElement = 4");
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
    win.READIUM2.ttsSkippabilityEnabled = false;
    win.READIUM2.ttsSentenceDetectionEnabled = true;
    win.READIUM2.ttsOverlayEnabled = false;

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

    if (win.READIUM2.isAudio) {
        // let audioPlaybackRate = 1;
        // if (readiumcssJson?.setCSS?.audioPlaybackRate) {
        //     audioPlaybackRate = readiumcssJson.setCSS.audioPlaybackRate;
        // }
        setupAudioBook(_docTitle, undefined);
    }

    if (readiumcssJson) {
        win.READIUM2.isFixedLayout = (typeof readiumcssJson.isFixedLayout !== "undefined") ?
            readiumcssJson.isFixedLayout : false;
    }

    // let didHide = false;
    // if (!win.READIUM2.isFixedLayout) {
    //     // only applies to previous nav spine item reading order
    //     if (win.READIUM2.urlQueryParams) {
    //         // tslint:disable-next-line:no-string-literal
    //         const previous = win.READIUM2.urlQueryParams[URL_PARAM_PREVIOUS];
    //         const isPreviousNavDirection = previous === "true";
    //         if (isPreviousNavDirection) {
    //             didHide = true;
    //             showHideContentMask(true, win.READIUM2.isFixedLayout);
    //         }
    //     }
    //     // ensure visible (can be triggered from host)
    //     if (!didHide) {
    //         showHideContentMask(false, win.READIUM2.isFixedLayout);
    //     }
    // }

    if (!win.READIUM2.isFixedLayout && !win.READIUM2.isAudio) {
        const scrollElement = getScrollingElement(win.document);

        // without this CSS hack, the paginated scrolling is SUPER janky!
        if (!(scrollElement as HTMLElement).classList.contains(ZERO_TRANSFORM_CLASS)) {
            (scrollElement as HTMLElement).classList.add(ZERO_TRANSFORM_CLASS);
        }
    }

    // testReadiumCSS(readiumcssJson);

    // innerWidth/Height can be zero at this rendering stage! :(
    const w = (readiumcssJson && readiumcssJson.fixedLayoutWebViewWidth) || win.innerWidth;
    const h = (readiumcssJson && readiumcssJson.fixedLayoutWebViewHeight) || win.innerHeight;
    win.READIUM2.fxlZoomPercent = (readiumcssJson && readiumcssJson.fixedLayoutZoomPercent) || 0;
    const wh = configureFixedLayout(win.document, win.READIUM2.isFixedLayout,
        win.READIUM2.fxlViewportWidth, win.READIUM2.fxlViewportHeight,
        w, h, win.READIUM2.webViewSlot, win.READIUM2.fxlZoomPercent);
    if (wh) {
        win.READIUM2.fxlViewportWidth = wh.width;
        win.READIUM2.fxlViewportHeight = wh.height;
        win.READIUM2.fxlViewportScale = wh.scale;

        const payload: IEventPayload_R2_EVENT_FXL_CONFIGURE = {
            fxl: wh,
        };
        ipcRenderer.sendToHost(R2_EVENT_FXL_CONFIGURE, payload);
    } else {
        const payload: IEventPayload_R2_EVENT_FXL_CONFIGURE = {
            fxl: null,
        };
        ipcRenderer.sendToHost(R2_EVENT_FXL_CONFIGURE, payload);
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

// let _cancelInitialScrollCheck = false;

function checkSoundtrack(documant: Document) {

    const audioNodeList = documant.querySelectorAll("audio");
    if (!audioNodeList || !audioNodeList.length) {
        return;
    }
    const audio = audioNodeList[0] as HTMLAudioElement;

    let epubType = audio.getAttribute("epub:type");
    if (!epubType) {
        epubType = audio.getAttributeNS("http://www.idpf.org/2007/ops", "type");
        if (!epubType) {
            epubType = audio.getAttribute("role");
        }
    }
    if (!epubType) {
        return;
    }
    epubType = epubType.trim().replace(/\s\s+/g, " "); // whitespace collapse

    if (epubType.indexOf("ibooks:soundtrack") < 0) {
        return;
    }

    let src = audio.getAttribute("src");
    if (!src) {
        if (!audio.childNodes) {
            return;
        }
        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < audio.childNodes.length; i++) {
            const childNode = audio.childNodes[i];
            if (childNode.nodeType === 1) { // Node.ELEMENT_NODE
                const el = childNode as Element;
                const elName = el.nodeName.toLowerCase();
                if (elName === "source") {
                    src = el.getAttribute("src");
                    if (src) {
                        break; // preserve first found (does not mean will be selected by playback engine!)
                    }
                }
            }
        }
    }
    if (!src) {
        return;
    }
    debug(`AUDIO SOUNDTRACK: ${src} ---> ${audio.src}`);
    if (!audio.src) { // should be absolute URL, even if attribute is relative
        return;
    }

    // Basic technique:
    // (works-ish, because broken playback flow when "turning pages" in the book,
    // and possibility of concurrent multiple playback streams with two-page spreads)
    // audio.setAttribute("loop", "loop");
    // setTimeout(async () => {
    //     await audio.play();
    // }, 500);

    // Advanced technique: let the webview manager/host handle playback:
    const payload: IEventPayload_R2_EVENT_AUDIO_SOUNDTRACK = {
        url: audio.src,
    };
    ipcRenderer.sendToHost(R2_EVENT_AUDIO_SOUNDTRACK, payload);
}

function mediaOverlaysClickRaw(element: Element | undefined, userInteract: boolean) {
    const textFragmentIDChain: Array<string | null> = [];
    if (element) { // !userInteract || win.READIUM2.mediaOverlaysClickEnabled
        let curEl = element;
        do {
            const id = curEl.getAttribute("id");
            textFragmentIDChain.push(id ? id : null);
            curEl = curEl.parentNode as Element;
        } while (curEl && curEl.nodeType === Node.ELEMENT_NODE);
    }
    const payload: IEventPayload_R2_EVENT_MEDIA_OVERLAY_CLICK = {
        locationHashOverrideInfo: win.READIUM2.locationHashOverrideInfo,
        textFragmentIDChain,
        userInteract,
    };
    ipcRenderer.sendToHost(R2_EVENT_MEDIA_OVERLAY_CLICK, payload);
}
// const mediaOverlaysClickDebounced = debounce((element: Element | undefined, userInteract: boolean) => {
//     mediaOverlaysClickRaw(element, userInteract);
// }, 100);

const onScrollRaw = () => {
    debug("onScrollRaw");

    if (!win.document || !win.document.documentElement) {
        return;
    }

    // win.document.documentElement.classList.contains(R2_MO_CLASS_PAUSED)
    if (win.document.documentElement.classList.contains(R2_MO_CLASS_PLAYING)) {
        debug("onScrollRaw Media OVerlays PLAYING/PAUSED ... skip"); // also note that display:none pagebreaks may have sync MO!
        return;
    }

    if (!win.READIUM2.ttsClickEnabled &&
        !win.document.documentElement.classList.contains(TTS_CLASS_PLAYING) &&
        !win.document.documentElement.classList.contains(TTS_CLASS_PAUSED)) {

        const el = win.READIUM2.locationHashOverride; // || win.READIUM2.hashElement
        if (el && isVisible(el, undefined)) {
            debug("onScrollRaw VISIBLE SKIP");
            return;
        }
    }

    const x = (isRTL() ? win.document.documentElement.offsetWidth - 1 : 0);
    processXYRaw(x, 0, false);
};
const onScrollDebounced = debounce(() => {
    onScrollRaw();
}, 300);

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
        showHideContentMask(false, win.READIUM2.isFixedLayout);
    } else {
        if (!win.READIUM2.isFixedLayout) {
            showHideContentMask(false, win.READIUM2.isFixedLayout);

            debug("++++ scrollToHashDebounced FROM LOAD");
            scrollToHashDebounced(false);

            if (win.document.body) {
                /*
                if (isPaginated(win.document)) {
                    win.document.body.addEventListener("scroll", (ev) => {
                        if (isPaginated(win.document)) {
                            console.log("BODY SCROLL PREVENT");
                            ev.preventDefault();
                        }
                    });
                }
                */

                const focusLink = win.document.createElement("a");
                focusLink.setAttribute("id", SKIP_LINK_ID);
                // focusLink.appendChild(win.document.createTextNode(INJECTED_LINK_TXT));
                focusLink.appendChild(win.document.createTextNode(" "));
                focusLink.setAttribute("title", INJECTED_LINK_TXT);
                focusLink.setAttribute("aria-label", INJECTED_LINK_TXT);
                focusLink.setAttribute("href", "javascript:;");
                focusLink.setAttribute("tabindex", "0");
                win.document.body.insertAdjacentElement("afterbegin", focusLink);
                setTimeout(() => {
                    focusLink.addEventListener("click", (ev) => {
                        ev.preventDefault();

                        if (IS_DEV) {
                            debug(">>>> focus link click: ");
                            debug(win.READIUM2.hashElement ?
                                getCssSelector(win.READIUM2.hashElement) : "!hashElement");
                            debug(win.READIUM2.locationHashOverride ?
                                getCssSelector(win.READIUM2.locationHashOverride) : "!locationHashOverride");
                        }

                        const el = win.READIUM2.hashElement || win.READIUM2.locationHashOverride;
                        if (el) {
                            focusScrollDebounced(el as HTMLElement, true, false, undefined);
                        }
                    });
                }, 200);
                // Does not work! :(
                // setTimeout(() => {
                //     console.log("TEST AUTOFOCUS");
                //     focusLink.focus();
                // }, 2000);
            }

            // setTimeout(() => {
            //     debug("++++ scrollToHashRaw FROM LOAD");
            //     scrollToHashRaw();
            // }, 100);
            // _cancelInitialScrollCheck = false;
            // setTimeout(() => {
            //     if (_cancelInitialScrollCheck) {
            //         return;
            //     }
            //     // if (!isPaginated(win.document)) {
            //     //     // scrollToHashRaw();
            //     //     return;
            //     // }
            //     // let visible = false;
            //     // if (win.READIUM2.locationHashOverride === win.document.body ||
            //     //     win.READIUM2.hashElement === win.document.body) {
            //     //     visible = true;
            //     // } else if (win.READIUM2.locationHashOverride) {
            //     //     visible = isVisible(win.READIUM2.locationHashOverride);
            //     // } else if (win.READIUM2.hashElement) {
            //     //     visible = isVisible(win.READIUM2.hashElement);
            //     // }
            //     // if (!visible) {
            //     //     debug("!visible (delayed layout pass?) => forcing second scrollToHashRaw()...");
            //     //     if (win.READIUM2.locationHashOverride) {
            //     //         debug(uniqueCssSelector(win.READIUM2.locationHashOverride, win.document, undefined));
            //     //     }
            //     //     scrollToHashRaw();
            //     // }
            // }, 500);
        } else {
            // processXYDebounced(0, 0, false);

            showHideContentMask(false, win.READIUM2.isFixedLayout);

            win.READIUM2.locationHashOverride = win.document.body;
            notifyReadingLocationDebounced();
        }

        checkSoundtrack(win.document);

        // if (win.READIUM2.isFixedLayout) {
        //     mediaOverlaysClickRaw(undefined, false);
        // } else {
        //     setTimeout(() => {
        //         const element = findFirstVisibleElement(win.document.body);
        //         mediaOverlaysClickDebounced(element, false);
        //     }, 200);
        // }
    }

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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ev.target as any).r2_leftrightKeyboardTimeStamp = new Date();
            }
            // allow event up to win.document.addEventListener("keydown")
            else {
                ev.preventDefault();
                // ev.stopPropagation();
            }
        }
    }, true);

    win.document.documentElement.addEventListener("mousedown", (_ev: MouseEvent) => {

        if (win.document && win.document.documentElement) {
            win.document.documentElement.classList.remove(ROOT_CLASS_KEYBOARD_INTERACT);
        }
    }, true);

    if (win.READIUM2.isAudio) {
        debug("AUDIOBOOK RENDER ...");
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    win.document.body.addEventListener("focusin", (ev: any) => {

        // if (_ignoreFocusInEvent) {
        //     debug("focusin --- IGNORE");
        //     _ignoreFocusInEvent = false;
        //     return;
        // }

        if (isPopupDialogOpen(win.document)) {
            return;
        }

        if (ev.target) {
            let ignoreIncomingMouseClickOnFocusable = false;
            if (win.document && win.document.documentElement) {
                const low = (ev.target as HTMLElement).tagName.toLowerCase();
                if (low === "body") {
                    ignoreIncomingMouseClickOnFocusable = true;
                } else if (!win.document.documentElement.classList.contains(ROOT_CLASS_KEYBOARD_INTERACT)) {
                    if (low === "a" &&
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (ev.target as any).href
                        ||
                        ev.target.getAttribute("tabindex") === "-1" &&
                        (ev.target as HTMLElement).classList.contains(CSS_CLASS_NO_FOCUS_OUTLINE)
                    ) {
                        ignoreIncomingMouseClickOnFocusable = true;
                    }
                }
            }
            if (!ignoreIncomingMouseClickOnFocusable) {
                handleFocusInDebounced(ev.target as HTMLElement, undefined);
            } else {
                debug("focusin mouse click --- IGNORE");
            }
        }
        // if (!win.document) {
        //     return;
        // }
        // const isPaged = isPaginated(win.document);
        // if (isPaged) {
        // }
    });

    // win.document.body.addEventListener("keydown", (ev: KeyboardEvent) => {
    //     if (isPopupDialogOpen(win.document)) {
    //         return;
    //     }

    //     const TAB_KEY = 9;
    //     if (ev.which === TAB_KEY) {
    //         if (ev.target) {
    //             handleTabDebounced(ev.target as HTMLElement, ev);
    //         }
    //     }
    //     // if (!win.document) {
    //     //     return;
    //     // }
    //     // const isPaged = isPaginated(win.document);
    //     // if (isPaged) {
    //     // }
    // }, true);

    const useResizeObserver = !win.READIUM2.isFixedLayout;
    if (useResizeObserver && win.document.body) {

        setTimeout(() => {
            let _firstResizeObserver = true;
            const resizeObserver = new win.ResizeObserver((_entries: ResizeObserverEntry[]) => {
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

                // invalidateBoundingClientRectOfDocumentBody(win);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (win.document.body as any).tabbables = undefined;

                // debug("++++ scrollToHashDebounced from ResizeObserver");
                scrollToHashDebounced(false);
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

    let _mouseMoveTimeout: number | undefined;
    win.document.documentElement.addEventListener("mousemove", (_ev: MouseEvent) => {
        if (_mouseMoveTimeout) {
            win.clearTimeout(_mouseMoveTimeout);
            _mouseMoveTimeout = undefined;
        }
        win.document.documentElement.classList.remove(HIDE_CURSOR_CLASS);
        _mouseMoveTimeout = win.setTimeout(() => {
            win.document.documentElement.classList.add(HIDE_CURSOR_CLASS);
        }, 1000);
    });

    win.document.addEventListener("auxclick", async (ev: MouseEvent) => {
        debug(`AUX __CLICK: ${ev.button} (SKIP middle)`);
        if (ev.button === 1) {
            ev.preventDefault();
            ev.stopPropagation();
        }
    }, true);
    win.document.addEventListener("click", async (ev: MouseEvent) => {
        debug(`!AUX __CLICK: ${ev.button} ...`);
        if (win.document.documentElement.classList.contains(R2_MO_CLASS_PAUSED) || win.document.documentElement.classList.contains(R2_MO_CLASS_PLAYING)) {
            debug("!AUX __CLICK skip because MO playing/paused");

            ev.preventDefault();
            ev.stopPropagation();

            return;
        }

        if (!isPopupDialogOpen(win.document)) {
            // relative to fixed window top-left corner
            // (unlike pageX/Y which is relative to top-left rendered content area, subject to scrolling)
            const x = ev.clientX;
            const y = ev.clientY;

            const domPointData = domDataFromPoint(x, y);

            if (domPointData.element && win.READIUM2.ttsClickEnabled) {
                debug("!AUX __CLICK domPointData.element && win.READIUM2.ttsClickEnabled");

                ev.preventDefault();
                ev.stopPropagation();

                if (ev.altKey) {
                    ttsPlay(
                        win.READIUM2.ttsPlaybackRate,
                        win.READIUM2.ttsVoice,
                        focusScrollRaw,
                        domPointData.element,
                        undefined,
                        undefined,
                        -1,
                        ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable,
                        ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable);
                    return;
                }

                ttsPlay(
                    win.READIUM2.ttsPlaybackRate,
                    win.READIUM2.ttsVoice,
                    focusScrollRaw,
                    (domPointData.element.ownerDocument as Document).body,
                    domPointData.element,
                    domPointData.textNode,
                    domPointData.textNodeOffset,
                    ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable,
                    ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable);

                return;
            }
        }

        if (win.READIUM2.ttsClickEnabled || win.document.documentElement.classList.contains(TTS_CLASS_PAUSED) || win.document.documentElement.classList.contains(TTS_CLASS_PLAYING)) {
            debug("!AUX __CLICK skip because TTS playing/paused");

            ev.preventDefault();
            // ev.stopPropagation();

            return;
        }

        // win.document.documentElement.classList.forEach((c) => {
        //     debug(c);
        // });

        let linkElement: Element | undefined;
        let imageElement: Element | undefined;

        let href_src: string | SVGAnimatedString | undefined;
        let href_src_image_nested_in_link: string | SVGAnimatedString | undefined;
        let isSVG = false;
        let globalSVGDefs: NodeListOf<Element> | undefined;
        let currentElement: Element | undefined = ev.target as Element;
        while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
            const tagName = currentElement.tagName.toLowerCase();
            if ((tagName === "img" || tagName === "image" || tagName === "svg")
                && !currentElement.classList.contains(POPOUTIMAGE_CONTAINER_ID)) {

                isSVG = false;
                if (tagName === "svg") {
                    if (imageElement) {
                        // image inside SVG
                        currentElement = currentElement.parentNode as Element;
                        continue;
                    }

                    isSVG = true;
                    href_src = currentElement.outerHTML;

                    const defs = currentElement.querySelectorAll("defs > *[id]");
                    debug("SVG INNER defs: ", defs.length);
                    const uses = currentElement.querySelectorAll("use");
                    debug("SVG INNER uses: ", uses.length);
                    const useIDs: string[] = [];
                    uses.forEach((useElem) => {
                        const href = useElem.getAttribute("href") || useElem.getAttributeNS("http://www.w3.org/1999/xlink", "href");
                        if (href?.startsWith("#")) {
                            const id = href.substring(1);
                            let found = false;
                            for (let i = 0; i < defs.length; i++) {
                                const defElem = defs[i];
                                if (defElem.getAttribute("id") === id) {
                                    found = true;
                                    break;
                                }
                            }
                            if (!found) {
                                debug("SVG INNER use (need inject def): ", id);
                                useIDs.push(id);
                            } else {
                                debug("SVG INNER use (already has def): ", id);
                            }
                        }
                    });
                    let defsToInject = "";
                    for (const useID of useIDs) {
                        if (!globalSVGDefs) {
                            globalSVGDefs = win.document.querySelectorAll("defs > *[id]");
                        }
                        debug("SVG GLOBAL defs: ", globalSVGDefs.length);
                        let found = false;
                        globalSVGDefs.forEach((globalSVGDef) => {
                            if (globalSVGDef.getAttribute("id") === useID) {
                                found = true;
                                const outer = globalSVGDef.outerHTML;
                                if (outer.includes("<use")) {
                                    debug("!!!!!! SVG WARNING use inside def: " + outer);
                                }
                                defsToInject += outer;
                            }
                        });
                        if (found) {
                            debug("SVG GLOBAL def for INNER use id: ", useID);
                        } else {
                            debug("no SVG GLOBAL def for INNER use id!! ", useID);
                        }
                    }
                    if (href_src.indexOf("<defs") >= 0) {
                        href_src = href_src.replace(/<\/defs>/, `${defsToInject} </defs>`);
                    } else {
                        href_src = href_src.replace(/>/, `> <defs> ${defsToInject} </defs>`);
                    }

                    // href_src = href_src.replace(/<svg/g, `<svg xml:base="${win.location.origin}${win.location.pathname}" `);
                    href_src = href_src.replace(/:href[\s]*=(["|'])(.+?)(["|'])/g, (match, ...args: string[]) => {
                        const l = args[1].trim();
                        const ret = l.startsWith("#") || l.startsWith("/") || l.startsWith("data:") || /https?:/.test(l) ? match :
                            `:href=${args[0]}${new URL(l, win.location.origin + win.location.pathname)}${args[2]}`;
                        debug("SVG URL REPLACE: ", match, ret);
                        return ret;
                    });
                    href_src = href_src.replace(/url[\s]*\((.+?)\)/g, (match, ...args: string[]) => {
                        const l = args[0].trim();
                        const ret = l.startsWith("#") || l.startsWith("/") || l.startsWith("data:") || /https?:/.test(l) ? match :
                            `url(${new URL(l, win.location.origin + win.location.pathname)})`;
                        debug("SVG URL REPLACE: ", match, ret);
                        return ret;
                    });

                    href_src = href_src.replace(/[\r\n]/g, " ").replace(/\s\s+/g, " ").trim();
                    href_src = href_src.replace(/<desc[^<]+<\/desc>/g, "");
                    debug(`SVG CLICK: ${href_src}`);
                } else {
                    // absolute (already resolved against base)
                    href_src = (currentElement as HTMLImageElement).src;
                    // possibly relative
                    let href_src_ = currentElement.getAttribute("src");
                    if (!href_src) {
                        // SVGAnimatedString (animVal possibly relative)
                        href_src = (currentElement as SVGImageElement).href;

                        // possibly relative
                        href_src_ = currentElement.getAttribute("href") || currentElement.getAttributeNS("http://www.w3.org/1999/xlink", "href");
                    }
                    debug(`IMG CLICK: ${href_src} (${href_src_})`);
                }
                imageElement = currentElement;

                // DOM parent / ancestor could be link a@href, so let's continue walking up the tree
                // break;
            } else if (tagName === "a") {

                if (href_src) {
                    href_src_image_nested_in_link = href_src;
                }

                // absolute (already resolved against base),
                // or SVGAnimatedString (animVal possibly relative)
                href_src = (currentElement as HTMLAnchorElement | SVGAElement).href;

                // possibly relative
                const href_ = currentElement.getAttribute("href") || currentElement.getAttributeNS("http://www.w3.org/1999/xlink", "href");

                linkElement = currentElement;
                debug(`A LINK CLICK: ${href_src} (${href_})`);

                // DOM child / descendant could be img/image/svg (see if condition above)
                break;
            }
            currentElement = currentElement.parentNode as Element;
        }
        currentElement = undefined;

        // at that point, can be both an image and a link! ("img" element descendant of "a" ... clickable image link)

        if (!href_src || (!imageElement && !linkElement)) {
            clearImageZoomOutline();
            return;
        }

        if (href_src_image_nested_in_link && (href_src_image_nested_in_link as SVGAnimatedString).animVal) {
            href_src_image_nested_in_link = (href_src_image_nested_in_link as SVGAnimatedString).animVal;

            if (!href_src_image_nested_in_link) {
                clearImageZoomOutline();
                return;
            }
        }

        if ((href_src as SVGAnimatedString).animVal) {
            href_src = (href_src as SVGAnimatedString).animVal;

            if (!href_src) {
                clearImageZoomOutline();
                return;
            }
        }

        if (typeof href_src !== "string") {

            clearImageZoomOutline();
            return;
        }
        if (href_src_image_nested_in_link && typeof href_src_image_nested_in_link !== "string") {

            clearImageZoomOutline();
            return;
        }

        debug(`HREF SRC: ${href_src} ${href_src_image_nested_in_link} (${win.location.href})`);

        const has = imageElement?.hasAttribute(`data-${POPOUTIMAGE_CONTAINER_ID}`);
        if (imageElement && href_src && (has ||
            ((!linkElement && !win.READIUM2.isFixedLayout && !isSVG) || ev.shiftKey)
        )) {
            if (linkElement && href_src_image_nested_in_link) {
                href_src = href_src_image_nested_in_link;
            }

            clearImageZoomOutline();

            ev.preventDefault();
            ev.stopPropagation();

            if (has) {
                if (!isSVG &&
                    !/^(https?|thoriumhttps):\/\//.test(href_src) &&
                    !href_src.startsWith((READIUM2_ELECTRON_HTTP_PROTOCOL + "://"))) {

                    const destUrl = new URL(href_src, win.location.origin + win.location.pathname);
                    href_src = destUrl.toString();
                    debug(`IMG CLICK ABSOLUTE-ized: ${href_src}`);
                }

                popoutImage(
                    win,
                    imageElement as HTMLImageElement | SVGElement,
                    href_src,
                    focusScrollRaw,
                    ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable,
                    ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable);
            } else {
                imageElement.setAttribute(`data-${POPOUTIMAGE_CONTAINER_ID}`, "1");
            }

            return;
        }

        if (!linkElement || !href_src) {
            clearImageZoomOutline();
            return;
        }

        const hrefStr = href_src as string;
        if (/^javascript:/.test(hrefStr)) {
            clearImageZoomOutline();
            return;
        }

        clearImageZoomOutline();

        ev.preventDefault();
        ev.stopPropagation();

        const payload: IEventPayload_R2_EVENT_LINK = {
            url: "#" + FRAG_ID_CSS_SELECTOR + encodeURIComponent_RFC3986(getCssSelector(linkElement)), // see location.ts locationHandleIpcMessage() eventChannel === R2_EVENT_LINK (URL is made absolute if necessary)
        };
        ipcRenderer.sendToHost(R2_EVENT_LINK, payload); // this will result in the app registering the element in the navigation history, but is skipped in location.ts ipcRenderer.on(R2_EVENT_LINK)

        const done = await popupFootNote(
            linkElement as HTMLElement,
            focusScrollRaw,
            hrefStr,
            ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable,
            ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable);
        if (!done) {
            focusScrollDebounced.clear();
            // processXYDebounced.clear();
            processXYDebouncedImmediate.clear();
            notifyReadingLocationDebounced.clear();
            notifyReadingLocationDebouncedImmediate.clear();
            scrollToHashDebounced.clear();
            onScrollDebounced.clear();
            onResizeDebounced.clear();
            handleFocusInDebounced.clear();
            // mediaOverlaysClickDebounced.clear();

            const payload: IEventPayload_R2_EVENT_LINK = {
                url: hrefStr,
            };
            ipcRenderer.sendToHost(R2_EVENT_LINK, payload);
        }
    }, true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcRenderer.on("R2_EVENT_WINDOW_RESIZE", (_event: any, zoomPercent: number) => {
        debug("R2_EVENT_WINDOW_RESIZE zoomPercent " + zoomPercent);

        // if (zoomPercent !== win.READIUM2.fxlZoomPercent) {
        // tslint:disable-next-line:max-line-length
        //     debug("R2_EVENT_WINDOW_RESIZE zoomPercent !== win.READIUM2.fxlZoomPercent ??! " + zoomPercent + " -- " + win.READIUM2.fxlZoomPercent);
        // }
        win.READIUM2.fxlZoomPercent = zoomPercent;

        if (!win.READIUM2.isFixedLayout) {
            debug("R2_EVENT_WINDOW_RESIZE skipped, !FXL");
            return;
        }

        const wh = configureFixedLayout(win.document, win.READIUM2.isFixedLayout,
            win.READIUM2.fxlViewportWidth, win.READIUM2.fxlViewportHeight,
            win.innerWidth, win.innerHeight, win.READIUM2.webViewSlot,
            win.READIUM2.fxlZoomPercent);

        if (wh) {
            win.READIUM2.fxlViewportWidth = wh.width;
            win.READIUM2.fxlViewportHeight = wh.height;
            win.READIUM2.fxlViewportScale = wh.scale;

            const payload: IEventPayload_R2_EVENT_FXL_CONFIGURE = {
                fxl: wh,
            };
            ipcRenderer.sendToHost(R2_EVENT_FXL_CONFIGURE, payload);
        } else {
            const payload: IEventPayload_R2_EVENT_FXL_CONFIGURE = {
                fxl: null,
            };
            ipcRenderer.sendToHost(R2_EVENT_FXL_CONFIGURE, payload);
        }
    });

    const onResizeRaw = () => {

        if (win.READIUM2.isFixedLayout) {
            debug("scrollToHashRaw skipped, FXL");
            return;
        }
        debug("++++ scrollToHashDebounced FROM RESIZE");
        scrollToHashDebounced(false);
    };
    const onResizeDebounced = debounce(() => {
        onResizeRaw();
    }, 200);
    let _firstWindowResize = true;
    win.addEventListener("resize", () => {
        if (_firstWindowResize) {
            debug("Window resize (WEBVIEW), SKIP FIRST");
            _firstWindowResize = false;
            return;
        }

        // if (ENABLE_WEBVIEW_RESIZE) {
        //     onResizeRaw();
        // } else {
        //     onResizeDebounced();
        // }
        onResizeDebounced();
    });

    let _wheelTimeStamp = -1;
    let _wheelSpin = 0;
    const wheelDebounced = // debounce(
        (ev: WheelEvent) => {
        // console.log("wheel", ev);

        const now = (new Date()).getTime();
        if (_wheelTimeStamp === -1) {
            _wheelTimeStamp = now;
        } else {
            const msDiff = now - _wheelTimeStamp;
            if (msDiff < 500) {
                // console.log("wheel skip time", msDiff);
                return;
            }
        }

        if (win.READIUM2.isAudio || win.READIUM2.isFixedLayout || !win.document.body) {
            return;
        }

        if (!win.document || !win.document.documentElement) {
            return;
        }

        const documant = win.document;

        const isPaged = isPaginated(documant);
        if (isPaged) {
            return;
        }

        const delta = Math.abs(ev.deltaY);
        // MacOS touchpad kinetic scroll generates 1px delta post- flick gesture
        // if (delta < 2) {
        //     console.log("wheel skip (small delta)", ev.deltaY, _wheelSpin);
        //     return;
        // }
        _wheelSpin += delta;
        if (_wheelSpin < 300) {
            // console.log("wheel skip (spin more...)", ev.deltaY, _wheelSpin);
            return;
        }

        // console.log("wheel turn page", ev.deltaY, _wheelSpin);
        _wheelSpin = 0;
        _wheelTimeStamp = -1;

        const scrollElement = getScrollingElement(documant);

        const vwm = isVerticalWritingMode();

        const goPREVIOUS = ev.deltaY < 0;
        if (!goPREVIOUS) { // goPREVIOUS && isRTL() || !goPREVIOUS && !isRTL()) { // right

            const maxScrollShift = calculateMaxScrollShift().maxScrollShift;
            const maxScrollShiftTolerated = maxScrollShift - CSS_PIXEL_TOLERANCE;

            if (isPaged) {
                const unit = vwm ?
                    win.document.documentElement.offsetHeight :
                    win.document.documentElement.offsetWidth;
                let scrollElementOffset = Math.round(vwm ?
                    scrollElement.scrollTop :
                    scrollElement.scrollLeft);
                const isNegative = scrollElementOffset < 0;
                const scrollElementOffsetAbs = Math.abs(scrollElementOffset);
                const fractional = scrollElementOffsetAbs / unit;
                const integral = Math.floor(fractional);
                const decimal = fractional - integral;
                const partial = decimal * unit;
                if (partial <= CSS_PIXEL_TOLERANCE) {
                    scrollElementOffset = (isNegative ? -1 : 1) * integral * unit;
                } else if (partial >= (unit - CSS_PIXEL_TOLERANCE)) {
                    scrollElementOffset = (isNegative ? -1 : 1) * (integral + 1) * unit;
                }
                if (vwm && (scrollElementOffsetAbs >= maxScrollShiftTolerated) ||
                    !vwm && (scrollElementOffsetAbs >= maxScrollShiftTolerated)) {

                    const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
                        // direction: "LTR",
                        go: "NEXT",
                    };
                    ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
                    return;
                }
            } else {
                if (vwm && (Math.abs(scrollElement.scrollLeft) >= maxScrollShiftTolerated) ||
                    !vwm && (Math.abs(scrollElement.scrollTop) >= maxScrollShiftTolerated)) {

                    const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
                        // direction: "LTR",
                        go: "NEXT",
                    };
                    ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
                    return;
                }
            }
        } else if (goPREVIOUS) { //  && !isRTL() || !goPREVIOUS && isRTL()) { // left
            if (isPaged) {
                const unit = vwm ?
                    win.document.documentElement.offsetHeight :
                    win.document.documentElement.offsetWidth;
                let scrollElementOffset = Math.round(vwm ?
                    scrollElement.scrollTop :
                    scrollElement.scrollLeft);
                const isNegative = scrollElementOffset < 0;
                const scrollElementOffsetAbs = Math.abs(scrollElementOffset);
                const fractional = scrollElementOffsetAbs / unit;
                const integral = Math.floor(fractional);
                const decimal = fractional - integral;
                const partial = decimal * unit;
                if (partial <= CSS_PIXEL_TOLERANCE) {
                    scrollElementOffset = (isNegative ? -1 : 1) * integral * unit;
                } else if (partial >= (unit - CSS_PIXEL_TOLERANCE)) {
                    scrollElementOffset = (isNegative ? -1 : 1) * (integral + 1) * unit;
                }
                if (vwm && (scrollElementOffsetAbs <= 0) ||
                    !vwm && (scrollElementOffsetAbs <= 0)) {

                    const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
                        // direction: "LTR",
                        go: "PREVIOUS",
                    };
                    ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
                    return;
                }
            } else {
                if (vwm && (Math.abs(scrollElement.scrollLeft) <= 0) ||
                    !vwm && (Math.abs(scrollElement.scrollTop) <= 0)) {

                    const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
                        // direction: "LTR",
                        go: "PREVIOUS",
                    };
                    ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
                    return;
                }
            }
        }

    }
    // , 100)
    ;
    win.document.addEventListener("wheel", wheelDebounced);
    win.document.addEventListener("scroll", (_ev: Event) => {
        // console.log("scroll reset _wheelSpin");
        _wheelSpin = 0;
        _wheelTimeStamp = -1;
    });

    setTimeout(() => {
        win.addEventListener("scroll", (_ev: Event) => {

            if (_ignoreScrollEvent) {
                // _ignoreScrollEvent = false;
                return;
            }

            if (_lastAnimState && _lastAnimState.animating) {
                debug("_lastAnimState"); // should never happen, as _ignoreScrollEvent
                return;
            }

            if (_lastAnimState2 && _lastAnimState2.animating) {
                debug("_lastAnimState2"); // should never happen, as _ignoreScrollEvent
                return;
            }

            if (!win.document || !win.document.documentElement) {
                return;
            }

            onScrollDebounced();
        });
    }, 200);

    function handleMouseEvent(ev: MouseEvent) {

        if (isPopupDialogOpen(win.document)) {
            return;
        }

        // debug(".hashElement = 5 DEBUUUUUG");
        // if (win.document.activeElement) {
        //     debug("win.document.activeElement:");
        //     debug(getCssSelector(win.document.activeElement));
        // }
        // const elSkip = win.document.getElementById(SKIP_LINK_ID);
        // if (elSkip) {
        //     debug("elSkip:");
        //     debug(getCssSelector(elSkip));
        // }
        // debug("ROOT_CLASS_KEYBOARD_INTERACT: ", win.document.documentElement.classList.contains(ROOT_CLASS_KEYBOARD_INTERACT));

        // screen reader a@href click event without ENTER key generates touch/user interaction!
        if (win.document.activeElement &&
            win.document.activeElement === win.document.getElementById(SKIP_LINK_ID)

            // can't filter with this, because screen reader emulates mouse click!
            // && win.document.documentElement.classList.contains(ROOT_CLASS_KEYBOARD_INTERACT)
            ) {
            debug(".hashElement = 5 => SKIP_LINK_ID mouse click event - screen reader VoiceOver generates mouse click / non-keyboard event");
            return;
        }

        // relative to fixed window top-left corner
        // (unlike pageX/Y which is relative to top-left rendered content area, subject to scrolling)
        const x = ev.clientX;
        const y = ev.clientY;

        processXYDebouncedImmediate(x, y, false, true);

        // const domPointData = domDataFromPoint(x, y);

        // if (domPointData.element && win.READIUM2.ttsClickEnabled) {
        //     if (ev.altKey) {
        //         ttsPlay(
        //             win.READIUM2.ttsPlaybackRate,
        //             win.READIUM2.ttsVoice,
        //             focusScrollRaw,
        //             domPointData.element,
        //             undefined,
        //             undefined,
        //             -1,
        //             ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable,
        //             ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable);
        //         return;
        //     }

        //     ttsPlay(
        //         win.READIUM2.ttsPlaybackRate,
        //         win.READIUM2.ttsVoice,
        //         focusScrollRaw,
        //         (domPointData.element.ownerDocument as Document).body,
        //         domPointData.element,
        //         domPointData.textNode,
        //         domPointData.textNodeOffset,
        //         ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable,
        //         ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable);
        // }
    }

    // win.document.body.addEventListener("click", (ev: MouseEvent) => {
    //     handleMouseEvent(ev);
    // });
    win.document.documentElement.addEventListener("mouseup", (ev: MouseEvent) => {
        handleMouseEvent(ev);
    });

    win.document.addEventListener("mouseup", (ev: MouseEvent) => {

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (ev.target && (ev.target as any).getAttribute) {

            const iBooksMO = (ev.target as HTMLElement).getAttribute("ibooks:readaloud") ||
                (ev.target as HTMLElement).getAttribute("readaloud");

            if (iBooksMO) {
                const payload: IEventPayload_R2_EVENT_MEDIA_OVERLAY_STARTSTOP = {
                    start: iBooksMO === "start" ? true : undefined,
                    startstop: iBooksMO === "startstop" ? true : undefined,
                    stop: iBooksMO === "stop" ? true : undefined,
                };

                ipcRenderer.sendToHost(R2_EVENT_MEDIA_OVERLAY_STARTSTOP, payload);
            }
        }
    }, true);

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
        if (IS_DEV && id !== SKIP_LINK_ID) {
            debug("checkBlacklisted ID: " + id);
        }
        return true;
    }

    for (const item of _blacklistIdClassForCFI) {
        if (el.classList.contains(item)) {
            if (IS_DEV) {
                debug("checkBlacklisted CLASS: " + item);
            }
            return true;
        }
    }

    const mathJax = win.document.documentElement.classList.contains(ROOT_CLASS_MATHJAX);
    if (mathJax) {
        const low = el.tagName.toLowerCase();
        for (const item of _blacklistIdClassForCFIMathJax) {
            if (low.startsWith(item)) {
                if (IS_DEV) {
                    debug("checkBlacklisted MathJax ELEMENT NAME: " + el.tagName);
                }
                return true;
            }
        }

        if (id) {
            const lowId = id.toLowerCase();
            for (const item of _blacklistIdClassForCFIMathJax) {
                if (lowId.startsWith(item)) {
                    if (IS_DEV) {
                        debug("checkBlacklisted MathJax ID: " + id);
                    }
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
                    if (IS_DEV) {
                        debug("checkBlacklisted MathJax CLASS: " + cl);
                    }
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

        if (isVisible(rootElement, undefined)) {
            return rootElement;
        }
    }
    return undefined;
}

type TDOMPointData = {
    textNode: Node | undefined;
    textNodeOffset: number;
    element: Element | undefined;
};
const domDataFromPoint = (x: number, y: number): TDOMPointData => {

    // const elems = win.document.elementsFromPoint(x, y);
    // let element: Element | undefined = elems && elems.length ? elems[0] : undefined;
    // if ((win.document as any).caretPositionFromPoint) {
    //     const range = (win.document as any).caretPositionFromPoint(x, y);
    //     const node = range.offsetNode;
    //     const offset = range.offset;
    // } else if (win.document.caretRangeFromPoint) {
    // }

    const domPointData: TDOMPointData = {
        textNode: undefined,
        textNodeOffset: -1,
        element: undefined,
    };
    const range = win.document.caretRangeFromPoint(x, y);
    if (range) {
        const node = range.startContainer;

        if (node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                domPointData.element = node as Element;
                const childrenCount = domPointData.element.childNodes?.length; // childElementCount
                if (childrenCount > 0 &&
                    range.startOffset > 0 &&
                    range.startOffset === range.endOffset &&
                    range.startOffset < childrenCount) {
                    let c = domPointData.element.childNodes[range.startOffset]; // .children
                    if (c.nodeType === Node.ELEMENT_NODE) {
                        domPointData.element = c as Element;
                    } else if (c.nodeType === Node.TEXT_NODE && range.startOffset > 0) { // hack (weird image click bug)
                        c = domPointData.element.childNodes[range.startOffset - 1];
                        if (c.nodeType === Node.ELEMENT_NODE) {
                            domPointData.element = c as Element;
                        }
                    }
                }
            } else if (node.nodeType === Node.TEXT_NODE) {
                domPointData.textNode = node;
                domPointData.textNodeOffset = range.startOffset;
                if (node.parentNode && node.parentNode.nodeType === Node.ELEMENT_NODE) {
                    domPointData.element = node.parentNode as Element;
                }
            }
        }
    }

    return domPointData;
};

// relative to fixed window top-left corner
const processXYRaw = (x: number, y: number, reverse: boolean, userInteract?: boolean) => {

    debug("processXYRaw ENTRY");

    // includes TTS!
    if (isPopupDialogOpen(win.document)) {
        debug("processXYRaw isPopupDialogOpen SKIP");
        return;
    }

    const domPointData = domDataFromPoint(x, y);

    if (!domPointData.element ||
        domPointData.element === win.document.body ||
        domPointData.element === win.document.documentElement) {

        const root = win.document.body; // || win.document.documentElement;
        domPointData.element = findFirstVisibleElement(root);
        if (!domPointData.element) {
            debug("|||||||||||||| cannot find visible element inside BODY / HTML????");
            domPointData.element = win.document.body;
        }
    } else if (!userInteract &&
        domPointData.element && !isVisible(domPointData.element, undefined)) { // isPaginated(win.document)

        let next: Element | undefined = domPointData.element;
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
            domPointData.element = found;
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
    if (domPointData.element === win.document.body ||
        domPointData.element === win.document.documentElement) {

        debug("|||||||||||||| BODY/HTML selected????");
    }
    if (domPointData.element) {
        if (userInteract ||
            !win.READIUM2.locationHashOverride ||
            win.READIUM2.locationHashOverride === win.document.body ||
            win.READIUM2.locationHashOverride === win.document.documentElement) {

            debug(".hashElement = 5 ", userInteract);
            // underscore special link will prioritise hashElement!
            win.READIUM2.hashElement = userInteract ? domPointData.element : win.READIUM2.hashElement;
            win.READIUM2.locationHashOverride = domPointData.element;
        } else {
            // this logic exists because of TOC linking,
            // to avoid reseting to first visible item ... but for page turns we need this!
            if (!isVisible(win.READIUM2.locationHashOverride, undefined)) {
                debug(".hashElement = 6");
                // underscore special link will prioritise hashElement!
                win.READIUM2.hashElement = userInteract ? domPointData.element : win.READIUM2.hashElement;
                win.READIUM2.locationHashOverride = domPointData.element;
            } else if (
                win.READIUM2.hashElement !== win.READIUM2.locationHashOverride &&
                (
                win.READIUM2.ttsClickEnabled ||
                win.document.documentElement.classList.contains(TTS_CLASS_PLAYING) ||
                win.document.documentElement.classList.contains(TTS_CLASS_PAUSED)
                )
            ) {
                debug(".hashElement = 8");
                // underscore special link will prioritise hashElement!
                win.READIUM2.hashElement = userInteract ? domPointData.element : win.READIUM2.hashElement;
                win.READIUM2.locationHashOverride = domPointData.element;
            }
        }

        // TODO: 250ms debounce on the leading edge (immediate) doesn't allow double-click to capture win.getSelection() for bookmark titles and annotations, because the notifyReadingLocation occurs before the DOM selection is ready. Instead of reverting to the debounce trailing edge (which causes a 200ms+ delay), could we detect double-click? Any other unintended side-effects / possible regression bugs from this change??
        if (userInteract && win.READIUM2.DEBUG_VISUALS) {
            notifyReadingLocationDebouncedImmediate(userInteract);
        } else {
            notifyReadingLocationDebounced(userInteract);
        }

        if (win.READIUM2.DEBUG_VISUALS) {
            const el = win.READIUM2.locationHashOverride ? win.READIUM2.locationHashOverride : domPointData.element;
            const existings = win.document.querySelectorAll(`*[${readPosCssStylesAttr2}]`);
            existings.forEach((existing) => {
                existing.removeAttribute(`${readPosCssStylesAttr2}`);
            });
            el.setAttribute(readPosCssStylesAttr2, "processXYRaw");
        }
    }

    debug("processXYRaw EXIT");
};
// const processXYDebounced = debounce((x: number, y: number, reverse: boolean, userInteract?: boolean) => {
//     processXYRaw(x, y, reverse, userInteract);
// }, 300);
const processXYDebouncedImmediate = debounce((x: number, y: number, reverse: boolean, userInteract?: boolean) => {
    processXYRaw(x, y, reverse, userInteract);
}, 300, { immediate: true });

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

    const vwm = isVerticalWritingMode();

    let extraShift = 0;
    if (isPaged) {
        if (maxScrollShift > 0) {
            if (vwm) {
                progressionRatio = scrollElement.scrollTop / maxScrollShift;
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            if (vwm) {
                // (isRTL() ? -1 : 1) * scrollElement.scrollLeft
                // CSS quirk? scrollLeft should always be negative?!
                // ... using abs() instead
                progressionRatio = Math.abs(scrollElement.scrollLeft) / maxScrollShift;
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

            if (isVisible(element, undefined)) {
                // because clientRect is based on visual rendering,
                // which does not account for extra shift (CSS transform X-translate of the webview)
                const curCol = extraShift ? (currentColumn - 1) : currentColumn;

                const columnDimension = calculateColumnDimension();
                // console.log("##### columnDimension");
                // console.log(columnDimension);

                if (vwm) {
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
                const totalDocumentDimension = ((vwm ? scrollElement.scrollWidth :
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
            if (vwm) {
                offset = scrollElement.scrollLeft + rect.left;
            } else {
                offset = scrollElement.scrollTop + rect.top;
            }

            // (isRTL() ? -1 : 1) * offset (derived from scrollElement.scrollLeft)
            // CSS quirk? scrollLeft should always be negative?!
            // ... using abs() instead
            progressionRatio =
                (vwm ? Math.abs(offset - win.document.documentElement.clientWidth) : offset)
                /
                (vwm ? scrollElement.scrollWidth : scrollElement.scrollHeight);
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
const _blacklistIdClassForCssSelectors = [LINK_TARGET_CLASS, CSS_CLASS_NO_FOCUS_OUTLINE, SKIP_LINK_ID, POPUP_DIALOG_CLASS, ID_HIGHLIGHTS_CONTAINER, CLASS_HIGHLIGHT_CONTAINER, CLASS_HIGHLIGHT_AREA, CLASS_HIGHLIGHT_BOUNDING_AREA, CLASS_HIGHLIGHT_BOUNDING_AREA_MARGIN, TTS_ID_SPEAKING_DOC_ELEMENT, ROOT_CLASS_KEYBOARD_INTERACT, ROOT_CLASS_INVISIBLE_MASK, ROOT_CLASS_INVISIBLE_MASK_REMOVED, CLASS_PAGINATED, ROOT_CLASS_NO_FOOTNOTES];
const _blacklistIdClassForCssSelectorsMathJax = ["mathjax", "ctxt", "mjx"];

// tslint:disable-next-line:max-line-length
const _blacklistIdClassForCFI = [SKIP_LINK_ID, POPUP_DIALOG_CLASS, ID_HIGHLIGHTS_CONTAINER, CLASS_HIGHLIGHT_CONTAINER, CLASS_HIGHLIGHT_AREA, CLASS_HIGHLIGHT_BOUNDING_AREA, CLASS_HIGHLIGHT_BOUNDING_AREA_MARGIN];
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
            let j = 0;
            for (let i = 0; i < currentElementParentChildren.length; i++) {
                const childBlacklisted = checkBlacklisted(currentElementParentChildren[i]);
                if (childBlacklisted) {
                    j++;
                }
                if (currentElement === currentElementParentChildren[i]) {
                    currentElementIndex = i;
                    break;
                }
            }
            if (currentElementIndex >= 0) {
                const cfiIndex = (currentElementIndex - j + 1) * 2;
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

const _htmlNamespaces: { [prefix: string]: string } = {
    epub: "http://www.idpf.org/2007/ops",
    xhtml: "http://www.w3.org/1999/xhtml",
};
const _namespaceResolver = (prefix: string | null): string | null => {
    if (!prefix) {
        return null;
    }
    return _htmlNamespaces[prefix] || null;
};
// type XPathNSResolver =
// ((prefix: string | null) => string | null) |
// { lookupNamespaceURI(prefix: string | null): string | null; };
// const namespaceResolver = win.document.createNSResolver(win.document.documentElement);

interface IHeading {
    element: Element;
    level: number;
    id: string | undefined;
    text: string | undefined;
}
let _allHeadings: IHeading[] | undefined;
const findPrecedingAncestorSiblingHeadings = (element: Element):
    Array<{ id: string | undefined, txt: string | undefined, level: number }> | undefined => {

    if (!_allHeadings) {
        // const xpathResult = win.document.evaluate(
        //     "//h1 | //h2 | //h3 | //h4 | //h5 | //h6",
        //     win.document.body,
        //     _namespaceResolver,
        //     XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        //     null);

        // for (let i = 0; i < xpathResult.snapshotLength; i++) {
        //     const n = xpathResult.snapshotItem(i);
        const headingElements = Array.from(win.document.querySelectorAll("h1,h2,h3,h4,h5,h6"));
        for (const n of headingElements) {
            if (n) {
                const el = n as Element;
                const t = el.textContent || el.getAttribute("title") || el.getAttribute("aria-label");
                let i = el.getAttribute("id");
                if (!i) { // common authoring pattern: parent section (or other container element) has the navigation target anchor
                    let cur = el;
                    let p: Element | null;
                    while ((p = (cur.parentNode as Element | null)) &&
                        p?.nodeType === Node.ELEMENT_NODE) {
                        // debug(`------ PARENT ID LOOP 1 ${cur.tagName} ${p.tagName} (${p.tagName} - ${t})`);

                        if (p.firstElementChild !== cur) {
                            // debug(`------ PARENT ID LOOP 2 ${cur.tagName} ${p.tagName} (${p.tagName} - ${t})`);
                            break;
                        }

                        const di = p.getAttribute("id");
                        if (di) {
                            // debug(`------ PARENT ID LOOP 3 ${cur.tagName} ${p.tagName} (${p.tagName} - ${t})`);
                            i = di;
                            break;
                        }

                        cur = p;
                    }
                }
                const heading: IHeading = {
                    element: el,
                    id: i ? i : undefined,
                    // level: el.localName.toLowerCase(),
                    level: parseInt(el.localName.substring(1), 10),
                    text: t ? t : undefined,
                };
                if (!_allHeadings) {
                    _allHeadings = [];
                }
                _allHeadings.push(heading);
            }
        }

        if (!_allHeadings) {
            _allHeadings = [];
        }

        // debug("_allHeadings", JSON.stringify(_allHeadings, null, 4));
        // JSON.stringify(_allHeadings, null, 4)
        debug("_allHeadings", _allHeadings.length, headingElements.length); // xpathResult.snapshotLength
    }

    let arr: Array<{ id: string | undefined, txt: string | undefined, level: number }> | undefined;
    for (let i = _allHeadings.length - 1; i >= 0; i--) {
        const heading = _allHeadings[i];

        const c = element.compareDocumentPosition(heading.element);
        // tslint:disable-next-line: no-bitwise
        if (c === 0 || (c & Node.DOCUMENT_POSITION_PRECEDING) || (c & Node.DOCUMENT_POSITION_CONTAINS)) {
            debug("preceding or containing heading", heading.id, heading.text);
            if (!arr) {
                arr = [];
            }
            arr.push({
                id: heading.id,
                level: heading.level,
                txt: heading.text,
            });
        }
    }

    return arr;
};

interface IPageBreak {
    element: Element;
    text: string;
}
let _allEpubPageBreaks: IPageBreak[] | undefined;
const findPrecedingAncestorSiblingEpubPageBreak = (element: Element): { epubPage: string | undefined, epubPageID: string | undefined } => {
    if (!_allEpubPageBreaks) {
        // // @namespace epub "http://www.idpf.org/2007/ops";
        // // [epub|type~="pagebreak"]
        // const cssSelectorResult = win.document.documentElement.querySelectorAll(`*[epub\\:type~="pagebreak"]`);
        // cssSelectorResult.forEach((el) => {
        //     if (el.textContent) {
        //         const pageBreak: IPageBreak = {
        //             element: el,
        //             text: el.textContent,
        //         };
        //         if (!_allEpubPageBreaks) {
        //             _allEpubPageBreaks = [];
        //         }
        //         _allEpubPageBreaks.push(pageBreak);
        //     }
        // });
        // // debug("_allEpubPageBreaks CSS selector", JSON.stringify(_allEpubPageBreaks, null, 4));
        // debug("_allEpubPageBreaks CSS selector", _allEpubPageBreaks.length);
        // _allEpubPageBreaks = undefined;

        const xpathResult = win.document.evaluate(
            // `//*[contains(@epub:type,'pagebreak')]`,
            // `//*[tokenize(@epub:type,'\s+')='pagebreak']`
            "//*[contains(concat(' ', normalize-space(@role), ' '), ' doc-pagebreak ')] | //*[contains(concat(' ', normalize-space(@epub:type), ' '), ' pagebreak ')]",
            win.document.body,
            _namespaceResolver,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null);

        for (let i = 0; i < xpathResult.snapshotLength; i++) {
            const n = xpathResult.snapshotItem(i);
            if (n) {
                const el = n as Element;
                const elTitle = el.getAttribute("title");
                const elLabel = el.getAttribute("aria-label");
                const elText = el.textContent;
                const pageLabel = elTitle || elLabel || elText || " "; // ("_" + (el.getAttribute("id") || ""));
                if (pageLabel) {
                    const pageBreak: IPageBreak = {
                        element: el,
                        text: pageLabel,
                    };
                    if (!_allEpubPageBreaks) {
                        _allEpubPageBreaks = [];
                    }
                    _allEpubPageBreaks.push(pageBreak);
                }
            }
        }

        if (!_allEpubPageBreaks) {
            _allEpubPageBreaks = [];
        }

        // debug("_allEpubPageBreaks XPath", JSON.stringify(_allEpubPageBreaks, null, 4));
        debug("_allEpubPageBreaks XPath", _allEpubPageBreaks.length, xpathResult.snapshotLength);
    }

    for (let i = _allEpubPageBreaks.length - 1; i >= 0; i--) {
        const pageBreak = _allEpubPageBreaks[i];

        const c = element.compareDocumentPosition(pageBreak.element);
        // tslint:disable-next-line: no-bitwise
        if (c === 0 || (c & Node.DOCUMENT_POSITION_PRECEDING) || (c & Node.DOCUMENT_POSITION_CONTAINS)) {
            debug("preceding or containing EPUB page break", pageBreak.text);
            return { epubPage: pageBreak.text, epubPageID: pageBreak.element.getAttribute("id") || undefined };
        }
    }

    const nil = { epubPage: undefined, epubPageID: undefined };
    if (_allEpubPageBreaks.length > 0) {
        const first = { epubPage: _allEpubPageBreaks[0].text, epubPageID: _allEpubPageBreaks[0].element.getAttribute("id") || undefined };

        if (win.document.body.firstChild === _allEpubPageBreaks[0].element) {
            debug("pagebreak first", first);
            return first;
        }

        const range = new Range(); // document.createRange()
        range.setStart(win.document.body, 0);
        range.setEnd(_allEpubPageBreaks[0].element, 0);
        let txt = range.toString() || "";
        if (txt) {
            // txt = txt.trim().replace(new RegExp(`^${INJECTED_LINK_TXT}`), "").trim();
            txt = txt.trim();
        }
        const pass = txt.length <= 10;
        debug("pagebreak first? txt", first, txt.length, pass ? txt : "");
        return pass ? first : nil;
    }
    return nil;
};

let _elementsWithID: Array<Element> | undefined;
const findFollowingDescendantSiblingElementsWithID = (el: Element): string[] | undefined => {
    let followingElementIDs: string[] | undefined;
    if (true // win.document.documentElement.classList.contains(R2_MO_CLASS_PLAYING) || win.document.documentElement.classList.contains(R2_MO_CLASS_PAUSED)
    ) {
        followingElementIDs = [];

        if (!_elementsWithID) {
            _elementsWithID = Array.from(win.document.querySelectorAll(`:not(#${ID_HIGHLIGHTS_CONTAINER}):not(#${POPUP_DIALOG_CLASS}):not(#${SKIP_LINK_ID}) *[id]:not(#${ID_HIGHLIGHTS_CONTAINER}):not(#${POPUP_DIALOG_CLASS}):not(#${SKIP_LINK_ID})`));
        }
        // const elHighlightsContainer = win.document.getElementById(ID_HIGHLIGHTS_CONTAINER);
        // const elPopupDialog = win.document.getElementById(POPUP_DIALOG_CLASS);
        // const elSkipLink = win.document.getElementById(SKIP_LINK_ID);

        // for (let i = _elementsWithID.length - 1; i >= 0; i--) {
        for (let i = 0; i < _elementsWithID.length; i++) {
            const elementWithID = _elementsWithID[i];
            const id = elementWithID.id || elementWithID.getAttribute("id");
            if (!id) {
                continue;
            }

            const c = el.compareDocumentPosition(elementWithID);
            // tslint:disable-next-line: no-bitwise
            if (// c === 0 ||
                (c & Node.DOCUMENT_POSITION_FOLLOWING) || (c & Node.DOCUMENT_POSITION_CONTAINED_BY)) {
                // let doPush = true;
                // if (elHighlightsContainer) {
                //     const c1 = elHighlightsContainer.compareDocumentPosition(elementWithID);
                //     if (c1 === 0 || (c1 & Node.DOCUMENT_POSITION_CONTAINED_BY)) {
                //         doPush = false;
                //     }
                // }
                // if (elPopupDialog) {
                //     const c2 = elPopupDialog.compareDocumentPosition(elementWithID);
                //     if (c2 === 0 || (c2 & Node.DOCUMENT_POSITION_CONTAINED_BY)) {
                //         doPush = false;
                //     }
                // }
                // if (elSkipLink) {
                //     const c3 = elSkipLink.compareDocumentPosition(elementWithID);
                //     if (c3 === 0 || (c3 & Node.DOCUMENT_POSITION_CONTAINED_BY)) {
                //         doPush = false;
                //     }
                // }
                // if (doPush) {
                //     followingElementIDs.push(id);
                // }
                followingElementIDs.push(id);
            }
        }
    }
    return followingElementIDs;
};

const notifyReadingLocationRaw = (userInteract?: boolean, ignoreMediaOverlays?: boolean) => {
    if (!win.READIUM2.locationHashOverride) {
        return;
    }

    // skips the first render notification because the first primary webview takes precedence
    // as it has been explicitly linked into (contrary to the second webview which is ancillary)
    if (// !userInteract &&
        win.READIUM2.urlQueryParams && win.READIUM2.urlQueryParams[URL_PARAM_SECOND_WEBVIEW] === "1") {
        win.READIUM2.urlQueryParams[URL_PARAM_SECOND_WEBVIEW] = "2";
        return;
    }

    const blacklisted = checkBlacklisted(win.READIUM2.locationHashOverride);
    if (blacklisted) {
        return;
    }

    // win.READIUM2.locationHashOverride.nodeType === ELEMENT_NODE

    let progressionData: IProgressionData | undefined;

    let cssSelector = getCssSelector(win.READIUM2.locationHashOverride);
    let cfi = computeCFI(win.READIUM2.locationHashOverride);
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

    // text selections created by screen readers do not trigger mouse click on container element,
    // and this makes sense anyway in the general case (start position of the selection is the location to focus on)
    if (selInfo) {
        cssSelector = selInfo.rangeInfo.startContainerElementCssSelector;
        cfi = selInfo.rangeInfo.startContainerElementCFI;
    }

    const text = selInfo ? {
        after: selInfo.cleanAfter,
        before: selInfo.cleanBefore,
        highlight: selInfo.cleanText,
        afterRaw: selInfo.rawAfter,
        beforeRaw: selInfo.rawBefore,
        highlightRaw: selInfo.rawText,
    } as LocatorText : undefined;

    let selectionIsNew: boolean | undefined;
    if (selInfo) {
        selectionIsNew =
            !win.READIUM2.locationHashOverrideInfo ||
            !win.READIUM2.locationHashOverrideInfo.selectionInfo ||
            !sameSelections(win.READIUM2.locationHashOverrideInfo.selectionInfo, selInfo);
    }

    const { epubPage, epubPageID } = findPrecedingAncestorSiblingEpubPageBreak(win.READIUM2.locationHashOverride);
    const headings = findPrecedingAncestorSiblingHeadings(win.READIUM2.locationHashOverride);
    const followingElementIDs = findFollowingDescendantSiblingElementsWithID(win.READIUM2.locationHashOverride);

    const secondWebViewHref = win.READIUM2.urlQueryParams &&
        win.READIUM2.urlQueryParams[URL_PARAM_SECOND_WEBVIEW] &&
        win.READIUM2.urlQueryParams[URL_PARAM_SECOND_WEBVIEW].length > 1 &&
        win.READIUM2.urlQueryParams[URL_PARAM_SECOND_WEBVIEW].startsWith("0") ?
        win.READIUM2.urlQueryParams[URL_PARAM_SECOND_WEBVIEW].substr(1) :
        undefined;

    win.READIUM2.locationHashOverrideInfo = {
        audioPlaybackInfo: undefined,
        docInfo: {
            isFixedLayout: win.READIUM2.isFixedLayout,
            isRightToLeft: isRTL(),
            isVerticalWritingMode: isVerticalWritingMode(),
        },
        epubPage,
        epubPageID,
        headings,
        href: "", // filled-in from host index.js renderer
        locations: {
            cfi,
            cssSelector,
            position: undefined, // calculated in host index.js renderer, where publication object is available
            progression,
        },
        paginationInfo: pinfo,
        secondWebViewHref,
        selectionInfo: selInfo,
        selectionIsNew,
        text,
        title: _docTitle,
        userInteract: userInteract ? true : false,
    };
    if (followingElementIDs) {
        win.READIUM2.locationHashOverrideInfo.followingElementIDs = followingElementIDs;
    }

    const payload: IEventPayload_R2_EVENT_READING_LOCATION = win.READIUM2.locationHashOverrideInfo;
    ipcRenderer.sendToHost(R2_EVENT_READING_LOCATION, payload);

    if (!ignoreMediaOverlays) {
        mediaOverlaysClickRaw(win.READIUM2.locationHashOverride, userInteract ? true : false);
    }

    if (
        // !win.document.documentElement.classList.contains(R2_MO_CLASS_PAUSED) &&
        !win.document.documentElement.classList.contains(R2_MO_CLASS_PLAYING)
    ) {
        tempLinkTargetOutline(win.READIUM2.locationHashOverride, 1000, true);
    }

    if (win.READIUM2.DEBUG_VISUALS) {
        const existings = win.document.querySelectorAll(`*[${readPosCssStylesAttr4}]`);
        existings.forEach((existing) => {
            existing.removeAttribute(`${readPosCssStylesAttr4}`);
        });
        win.READIUM2.locationHashOverride.setAttribute(readPosCssStylesAttr4, "notifyReadingLocationRaw");
    }
};
const notifyReadingLocationDebounced = debounce((userInteract?: boolean, ignoreMediaOverlays?: boolean) => {
    notifyReadingLocationRaw(userInteract, ignoreMediaOverlays);
}, 250);
const notifyReadingLocationDebouncedImmediate = debounce((userInteract?: boolean, ignoreMediaOverlays?: boolean) => {
    notifyReadingLocationRaw(userInteract, ignoreMediaOverlays);
}, 250, { immediate: true });

if (!win.READIUM2.isAudio) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcRenderer.on(R2_EVENT_TTS_DO_PLAY, (_event: any, payload: IEventPayload_R2_EVENT_TTS_DO_PLAY) => {
        const rootElement = win.document.querySelector(payload.rootElement);
        const startElement = payload.startElement ? win.document.querySelector(payload.startElement) : null;
        ttsPlay(
            payload.speed,
            payload.voice,
            focusScrollRaw,
            rootElement ? rootElement : undefined,
            startElement ? startElement : undefined,
            undefined,
            -1,
            ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable,
            ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcRenderer.on(R2_EVENT_TTS_DO_STOP, (_event: any) => {
        ttsStop();
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcRenderer.on(R2_EVENT_TTS_DO_PAUSE, (_event: any) => {
        ttsPause();
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcRenderer.on(R2_EVENT_TTS_DO_RESUME, (_event: any) => {
        ttsResume();
    });

    ipcRenderer.on(R2_EVENT_TTS_DO_NEXT,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_event: any, payload?: IEventPayload_R2_EVENT_TTS_DO_NEXT_OR_PREVIOUS) => {
        ttsNext(payload?.skipSentences);
    });

    ipcRenderer.on(R2_EVENT_TTS_DO_PREVIOUS,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_event: any, payload?: IEventPayload_R2_EVENT_TTS_DO_NEXT_OR_PREVIOUS) => {
        ttsPrevious(payload?.skipSentences);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcRenderer.on(R2_EVENT_TTS_PLAYBACK_RATE, (_event: any, payload: IEventPayload_R2_EVENT_TTS_PLAYBACK_RATE) => {
        ttsPlaybackRate(payload.speed);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcRenderer.on(R2_EVENT_TTS_VOICE, (_event: any, payload: IEventPayload_R2_EVENT_TTS_VOICE) => {
        ttsVoice(payload.voice);
    });

    ipcRenderer.on(R2_EVENT_TTS_SKIP_ENABLE,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_event: any, payload: IEventPayload_R2_EVENT_TTS_SKIP_ENABLE) => {
        win.READIUM2.ttsSkippabilityEnabled = payload.doEnable;
    });
    ipcRenderer.on(R2_EVENT_TTS_SENTENCE_DETECT_ENABLE,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_event: any, payload: IEventPayload_R2_EVENT_TTS_SENTENCE_DETECT_ENABLE) => {
        win.READIUM2.ttsSentenceDetectionEnabled = payload.doEnable;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcRenderer.on(R2_EVENT_TTS_CLICK_ENABLE, (_event: any, payload: IEventPayload_R2_EVENT_TTS_CLICK_ENABLE) => {
        win.READIUM2.ttsClickEnabled = payload.doEnable;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcRenderer.on(R2_EVENT_TTS_OVERLAY_ENABLE, (_event: any, payload: IEventPayload_R2_EVENT_TTS_OVERLAY_ENABLE) => {
        win.READIUM2.ttsOverlayEnabled = payload.doEnable;
    });

    ipcRenderer.on(R2_EVENT_MEDIA_OVERLAY_STATE,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_event: any, payload: IEventPayload_R2_EVENT_MEDIA_OVERLAY_STATE) => {

        clearImageZoomOutlineDebounced();

        win.document.documentElement.classList.remove(R2_MO_CLASS_PAUSED, R2_MO_CLASS_PLAYING, R2_MO_CLASS_STOPPED);

        win.document.documentElement.classList.add(payload.state === MediaOverlaysStateEnum.PAUSED ? R2_MO_CLASS_PAUSED :
            (payload.state === MediaOverlaysStateEnum.PLAYING ? R2_MO_CLASS_PLAYING : R2_MO_CLASS_STOPPED));
    });

    ipcRenderer.on(R2_EVENT_MEDIA_OVERLAY_HIGHLIGHT,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_event: any, payload: IEventPayload_R2_EVENT_MEDIA_OVERLAY_HIGHLIGHT) => {

            const styleAttr = win.document.documentElement.getAttribute("style");
            const isNight = styleAttr ? styleAttr.indexOf("readium-night-on") > 0 : false;
            const isSepia = styleAttr ? styleAttr.indexOf("readium-sepia-on") > 0 : false;
            // "--USER__backgroundColor" "--USER__backgroundColor"

            const activeClass = (isNight || isSepia) ? R2_MO_CLASS_ACTIVE :
                (payload.classActive ? payload.classActive : R2_MO_CLASS_ACTIVE);
            const activeClassPlayback =
                payload.classActivePlayback ? payload.classActivePlayback : R2_MO_CLASS_ACTIVE_PLAYBACK;

            if (payload.classActive) {
                const activeMoElements = win.document.body.querySelectorAll(`.${payload.classActive}`);
                activeMoElements.forEach((elem) => {
                    if (payload.classActive) {
                        elem.classList.remove(payload.classActive);
                    }
                });
            }
            const activeMoElements_ = win.document.body.querySelectorAll(`.${R2_MO_CLASS_ACTIVE}`);
            activeMoElements_.forEach((elem) => {
                elem.classList.remove(R2_MO_CLASS_ACTIVE);
            });

            let removeCaptionContainer = true;
            if (!payload.id) {
                win.document.documentElement.classList.remove(R2_MO_CLASS_ACTIVE_PLAYBACK, activeClassPlayback);
            } else {
                win.document.documentElement.classList.add(activeClassPlayback);

                const targetEl = win.document.getElementById(payload.id);
                if (targetEl) {
                    targetEl.classList.add(activeClass);

                    if (payload.captionsMode) {
                        let text = targetEl.textContent;
                        if (text) {
                            // text = text.trim().replace(/[\r\n]/g, " ").replace(/\s+/g, " ");
                            text = normalizeText(text).trim();
                            if (text) {
                                removeCaptionContainer = false;
                                const isUserBackground = styleAttr ?
                                    styleAttr.indexOf("--USER__backgroundColor") >= 0 : false;
                                const isUserColor = styleAttr ?
                                    styleAttr.indexOf("--USER__textColor") >= 0 : false;
                                const docStyle = win.getComputedStyle(win.document.documentElement);
                                let containerStyle = "background-color: white; color: black;";
                                if (isNight || isSepia) {
                                    const rsBackground = docStyle.getPropertyValue("--RS__backgroundColor");
                                    const rsColor = docStyle.getPropertyValue("--RS__textColor");
                                    containerStyle = `background-color: ${rsBackground}; color: ${rsColor};`;
                                } else {
                                    if (isUserBackground || isUserColor) {
                                        containerStyle = "";
                                    }
                                    if (isUserBackground) {
                                        const usrBackground = docStyle.getPropertyValue("--USER__backgroundColor");
                                        containerStyle += `background-color: ${usrBackground};`;
                                    }
                                    if (isUserColor) {
                                        const usrColor = docStyle.getPropertyValue("--USER__textColor");
                                        containerStyle += `color: ${usrColor};`;
                                    }
                                }
                                const isUserFontSize = styleAttr ?
                                    styleAttr.indexOf("--USER__fontSize") >= 0 : false;
                                if (isUserFontSize) {
                                    const usrFontSize = docStyle.getPropertyValue("--USER__fontSize");
                                    containerStyle += `font-size: ${usrFontSize};`;
                                } else {
                                    containerStyle += "font-size: 120%;";
                                }
                                const isUserLineHeight = styleAttr ?
                                    styleAttr.indexOf("--USER__lineHeight") >= 0 : false;
                                if (isUserLineHeight) {
                                    const usrLineHeight = docStyle.getPropertyValue("--USER__lineHeight");
                                    containerStyle += `line-height: ${usrLineHeight};`;
                                } else {
                                    containerStyle += "line-height: 1.2;";
                                }
                                const isUserFont = styleAttr ?
                                    styleAttr.indexOf("--USER__fontFamily") >= 0 : false;
                                if (isUserFont) {
                                    const usrFont = docStyle.getPropertyValue("--USER__fontFamily");
                                    containerStyle += `font-family: ${usrFont};`;
                                }

                                const payloadCaptions: IEventPayload_R2_EVENT_CAPTIONS = {
                                    containerStyle,
                                    text,
                                    textStyle: "font-size: 120%;",
                                };
                                ipcRenderer.sendToHost(R2_EVENT_CAPTIONS, payloadCaptions);
                            }
                        }
                    }

                    debug(".hashElement = 7");
                    // underscore special link will prioritise hashElement!
                    win.READIUM2.hashElement = targetEl;
                    win.READIUM2.locationHashOverride = targetEl;

                    if (
                        // !isPaginated(win.document) &&
                        !isVisible(targetEl, undefined)) {

                        scrollElementIntoView(targetEl, false, true, undefined);
                    }

                    scrollToHashDebounced.clear();
                    notifyReadingLocationRaw(false, true);

                    if (win.READIUM2.DEBUG_VISUALS) {
                        const el = win.READIUM2.locationHashOverride;
                        const existings = win.document.querySelectorAll(`*[${readPosCssStylesAttr2}]`);
                        existings.forEach((existing) => {
                            existing.removeAttribute(`${readPosCssStylesAttr2}`);
                        });
                        el.setAttribute(readPosCssStylesAttr2, "R2_EVENT_MEDIA_OVERLAY_HIGHLIGHT");
                    }
                }
            }

            if (removeCaptionContainer) {
                const payloadCaptions: IEventPayload_R2_EVENT_CAPTIONS = {
                    containerStyle: undefined,
                    text: undefined,
                    textStyle: undefined,
                };
                ipcRenderer.sendToHost(R2_EVENT_CAPTIONS, payloadCaptions);
            }
        });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            [
                {
                    color: undefined,
                    drawType: undefined,
                    expand: undefined,
                    selectionInfo: undefined,
                } as IHighlightDefinition,
            ] :
            payloadPing.highlightDefinitions;

        for (const highlightDefinition of highlightDefinitions) {
            if (!highlightDefinition.selectionInfo) {
                highlightDefinition.selectionInfo = getCurrentSelectionInfo(win, getCssSelector, computeCFI);
            }
        }
        const highlights = createHighlights(
            win,
            highlightDefinitions,
            true, // mouse / pointer interaction
        );
        const payloadPong: IEventPayload_R2_EVENT_HIGHLIGHT_CREATE = {
            highlightDefinitions: payloadPing.highlightDefinitions,
            highlights: highlights.length ? highlights : undefined,
        };
        ipcRenderer.sendToHost(R2_EVENT_HIGHLIGHT_CREATE, payloadPong);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcRenderer.on(R2_EVENT_HIGHLIGHT_REMOVE, (_event: any, payload: IEventPayload_R2_EVENT_HIGHLIGHT_REMOVE) => {
        payload.highlightIDs.forEach((highlightID) => {
            destroyHighlight(win.document, highlightID);
        });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcRenderer.on(R2_EVENT_HIGHLIGHT_REMOVE_ALL, (_event: any) => {
        destroyAllhighlights(win.document);
    });
}
