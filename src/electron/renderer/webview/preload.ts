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
import * as xmldom from "xmldom";

import {
    IEventPayload_R2_EVENT_LINK,
    IEventPayload_R2_EVENT_PAGE_TURN,
    IEventPayload_R2_EVENT_READING_LOCATION,
    IEventPayload_R2_EVENT_READING_LOCATION_PAGINATION_INFO,
    IEventPayload_R2_EVENT_READIUMCSS,
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
import { INameVersion, setWindowNavigatorEpubReadingSystem } from "./epubReadingSystem";
import {
    calculateColumnDimension,
    calculateMaxScrollShift,
    calculateTotalColumns,
    computeVerticalRTL,
    computeVerticalRTL_,
    isRTL,
    isTwoPageSpread,
    isVerticalWritingMode,
    readiumCSS,
} from "./readium-css";
import {
    DEBUG_VISUALS,
    configureFixedLayout,
    injectDefaultCSS,
    injectReadPosCSS,
    isPaginated,
} from "./readium-css-inject";
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
    let readiumEpubReadingSystemJson: INameVersion | undefined;

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
        const wh = configureFixedLayout(win.document, win.READIUM2.isFixedLayout,
            win.READIUM2.fxlViewportWidth, win.READIUM2.fxlViewportHeight,
            win.innerWidth, win.innerHeight);
        if (wh) {
            win.READIUM2.fxlViewportWidth = wh.width;
            win.READIUM2.fxlViewportHeight = wh.height;
        }

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

    const isPaged = isPaginated(win.document);
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

    if (!win.document || !win.document.documentElement || !win.document.body || !isPaginated(win.document)) {
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

    const isPaged = isPaginated(win.document);

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

function definePropertyGetterSetter_DocHeadBody(docu: Document, elementName: string) {

    Object.defineProperty(docu, elementName, {
        get() {
            const doc = this as Document;

            const key = elementName + "_";
            if ((doc as any)[key]) {
                return (doc as any)[key]; // cached
            }
            if (doc.documentElement.childNodes && doc.documentElement.childNodes.length) {
                // tslint:disable-next-line: prefer-for-of
                for (let i = 0; i < doc.documentElement.childNodes.length; i++) {
                    const child = doc.documentElement.childNodes[i];
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        const element = child as Element;
                        if (element.localName && element.localName.toLowerCase() === elementName) {
                            (doc as any)[key] = element; // cache
                            console.log(`XMLDOM - cached document.${elementName}`);
                            return element;
                        }
                    }
                }
            }
            return undefined;
        },
        set(_val) {
            console.log("document." + elementName + " CANNOT BE SET!!");
        },
    });
}
function cssSetProperty(this: any, cssProperty: string, val: string) {
    const style = this;
    const elem = style.element;

    // console.log(`XMLDOM - cssSetProperty: ${cssProperty}: ${val};`);
    cssStyleSet(cssProperty, val, elem);
}
function cssRemoveProperty(this: any, cssProperty: string) {
    const style = this;
    const elem = style.element;

    // console.log(`XMLDOM - cssRemoveProperty: ${cssProperty}`);
    cssStyleSet(cssProperty, undefined, elem);
}
function cssStyleItem(this: any, i: number): string | undefined {
    const style = this;
    const elem = style.element;

    console.log(`XMLDOM - cssStyleItem: ${i}`);
    const styleAttr = elem.getAttribute("style");
    if (!styleAttr) {
        return undefined;
    }
    let count = -1;
    const cssProps = styleAttr.split(";");
    for (const cssProp of cssProps) {
        const trimmed = cssProp.trim();
        if (trimmed.length) {
            count++;
            if (count === i) {
                const regExStr = `(.+)[\s]*:[\s]*(.+)`;
                const regex = new RegExp(regExStr, "g");
                const regexMatch = regex.exec(trimmed);
                if (regexMatch) {
                    console.log(`XMLDOM - cssStyleItem: ${i} => ${regexMatch[1]}`);
                    return regexMatch[1];
                }
            }
        }
    }
    return undefined;
}
function cssStyleGet(cssProperty: string, elem: Element): string | undefined {
    console.log(`XMLDOM - cssStyleGet: ${cssProperty}`);

    const styleAttr = elem.getAttribute("style");
    if (!styleAttr) {
        return undefined;
    }
    const regExStr = `${cssProperty}[\s]*:[\s]*(.+)`;
    const cssProps = styleAttr.split(";");
    let cssPropertyValue: string | undefined;
    for (const cssProp of cssProps) {
        const regex = new RegExp(regExStr, "g");
        const regexMatch = regex.exec(cssProp.trim());
        if (regexMatch) {
            cssPropertyValue = regexMatch[1];
            console.log(`XMLDOM - cssStyleGet: ${cssProperty} => ${cssPropertyValue}`);
            break;
        }
    }
    return cssPropertyValue ? cssPropertyValue : undefined;
}
function cssStyleSet(cssProperty: string, val: string | undefined, elem: Element) {
    console.log(`XMLDOM - cssStyleSet: ${cssProperty}: ${val};`);

    const str = val ? `${cssProperty}: ${val}` : undefined;

    const styleAttr = elem.getAttribute("style");
    if (!styleAttr) {
        if (str) {
            elem.setAttribute("style", str);
        }
    } else {
        const regExStr = `${cssProperty}[\s]*:[\s]*(.+)`;
        const regex = new RegExp(regExStr, "g");
        const regexMatch = regex.exec(styleAttr);
        if (regexMatch) {
            elem.setAttribute("style", styleAttr.replace(regex, str ? `${str}` : ""));
        } else {
            if (str) {
                elem.setAttribute("style", `${styleAttr}; ${str}`);
            }
        }
    }
}
function definePropertyGetterSetter_ElementStyle(element: Element) {
    const styleObj: any = {};
    styleObj.element = element;

    styleObj.setProperty = cssSetProperty.bind(styleObj);
    styleObj.removeProperty = cssRemoveProperty.bind(styleObj);

    styleObj.item = cssStyleItem.bind(styleObj);
    Object.defineProperty(styleObj, "length", {
        get() {
            const style = this as any;
            const elem = style.element;

            console.log(`XMLDOM - style.length`);

            const styleAttr = elem.getAttribute("style");
            if (!styleAttr) {
                return 0;
            }
            let count = 0;
            const cssProps = styleAttr.split(";");
            for (const cssProp of cssProps) {
                if (cssProp.trim().length) {
                    count++;
                }
            }
            console.log(`XMLDOM - style.length: ${count}`);
            return count;
        },
        set(_val) {
            console.log("style.length CANNOT BE SET!!");
        },
    });

    const cssProperties = ["overflow", "width", "height", "margin", "transformOrigin", "transform"];
    cssProperties.forEach((cssProperty) => {

        Object.defineProperty(styleObj, cssProperty, {
            get() {
                const style = this as any;
                const elem = style.element;

                return cssStyleGet(cssProperty, elem);
            },
            set(val) {
                const style = this as any;
                const elem = style.element;

                cssStyleSet(cssProperty, val, elem);
            },
        });
    });

    (element as any).style = styleObj;
}
function classListContains(this: any, className: string): boolean {
    const style = this;
    const elem = style.element;

    console.log(`XMLDOM - classListContains: ${className}`);

    const classAttr = elem.getAttribute("class");
    if (!classAttr) {
        return false;
    }
    const classes = classAttr.split(" ");
    for (const clazz of classes) {
        if (clazz === className) {
            console.log(`XMLDOM - classListContains TRUE: ${className}`);
            return true;
        }
    }
    return false;
}
function classListAdd(this: any, className: string) {
    const style = this;
    const elem = style.element;

    console.log(`XMLDOM - classListAdd: ${className}`);

    const classAttr = elem.getAttribute("class");
    if (!classAttr) {
        elem.setAttribute("class", className);
        return;
    }
    let needsAdding = true;
    const classes = classAttr.split(" ");
    for (const clazz of classes) {
        if (clazz === className) {
            needsAdding = false;
            break;
        }
    }
    if (needsAdding) {
        elem.setAttribute("class", `${classAttr} ${className}`);
    }
}
function classListRemove(this: any, className: string) {
    const style = this;
    const elem = style.element;

    console.log(`XMLDOM - classListRemove: ${className}`);

    const classAttr = elem.getAttribute("class");
    if (!classAttr) {
        return;
    }
    const arr: string[] = [];
    const classes = classAttr.split(" ");
    for (const clazz of classes) {
        if (clazz !== className) {
            arr.push(clazz);
        }
    }
    elem.setAttribute("class", arr.join(" "));
}
function definePropertyGetterSetter_ElementClassList(element: Element) {
    const classListObj: any = {};
    classListObj.element = element;

    classListObj.contains = classListContains.bind(classListObj);
    classListObj.add = classListAdd.bind(classListObj);
    classListObj.remove = classListRemove.bind(classListObj);

    (element as any).classList = classListObj;
}
function testReadiumCSS(readiumcssJson: IEventPayload_R2_EVENT_READIUMCSS | undefined) {
    const rawHTML = win.document.documentElement.outerHTML;
    const iBody = rawHTML.indexOf("<body");
    console.log(rawHTML.substr(0, iBody + 100));

    const doc = new xmldom.DOMParser().parseFromString(rawHTML);

    if (!doc.head) {
        definePropertyGetterSetter_DocHeadBody(doc, "head");
    }
    if (!doc.body) {
        definePropertyGetterSetter_DocHeadBody(doc, "body");
    }
    if (!doc.documentElement.style) {
        definePropertyGetterSetter_ElementStyle(doc.documentElement);
    }
    if (!doc.body.style) {
        definePropertyGetterSetter_ElementStyle(doc.body);
    }
    if (!doc.documentElement.classList) {
        definePropertyGetterSetter_ElementClassList(doc.documentElement);
    }

    const wh = configureFixedLayout(doc, win.READIUM2.isFixedLayout,
        win.READIUM2.fxlViewportWidth, win.READIUM2.fxlViewportHeight,
        win.innerWidth, win.innerHeight);
    if (wh) {
        win.READIUM2.fxlViewportWidth = wh.width;
        win.READIUM2.fxlViewportHeight = wh.height;
    }

    injectDefaultCSS(doc);
    if (DEBUG_VISUALS) {
        injectReadPosCSS(doc);
    }
    computeVerticalRTL_(doc);
    if (readiumcssJson) {
        readiumCSS(doc, readiumcssJson);
    }

    const rawHTML_ = new xmldom.XMLSerializer().serializeToString(doc);
    const iBody_ = rawHTML_.indexOf("<body");
    console.log(rawHTML_.substr(0, iBody_ + 100));
}

win.addEventListener("DOMContentLoaded", () => {

    // const linkUri = new URI(win.location.href);

    if (win.location.hash && win.location.hash.length > 1) {
        win.READIUM2.hashElement = win.document.getElementById(win.location.hash.substr(1));
    }

    // resetInitialState();
    win.READIUM2.locationHashOverride = undefined;
    win.READIUM2.readyPassDone = false;
    win.READIUM2.readyEventSent = false;

    let readiumcssJson: IEventPayload_R2_EVENT_READIUMCSS | undefined;
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

    if (readiumcssJson) {
        win.READIUM2.isFixedLayout = (typeof readiumcssJson.isFixedLayout !== "undefined") ?
            readiumcssJson.isFixedLayout : false;
    }

    testReadiumCSS(readiumcssJson);

    const wh = configureFixedLayout(win.document, win.READIUM2.isFixedLayout,
        win.READIUM2.fxlViewportWidth, win.READIUM2.fxlViewportHeight,
        win.innerWidth, win.innerHeight);
    if (wh) {
        win.READIUM2.fxlViewportWidth = wh.width;
        win.READIUM2.fxlViewportHeight = wh.height;
    }
    if (win.READIUM2.isFixedLayout) {
        notifyReady();
    }

    injectDefaultCSS(win.document);

    if (DEBUG_VISUALS) {
        injectReadPosCSS(win.document);
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

        const isPaged = isPaginated(win.document);
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

    computeVerticalRTL();
    if (readiumcssJson) {
        readiumCSS(win.document, readiumcssJson);
    }
});

// // after DOMContentLoaded
// win.addEventListener("load", () => {
//     // computeVerticalRTL();
// });

// after DOMContentLoaded
win.addEventListener("load", () => {
    checkReadyPass();
});

// // does not occur when re-using same webview (src="href")
// win.addEventListener("unload", () => {
//     resetInitialState();
// });

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

    const isPaged = isPaginated(win.document);

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
