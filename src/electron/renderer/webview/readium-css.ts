// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { ipcRenderer } from "electron";

import {
    IEventPayload_R2_EVENT_READIUMCSS,
    R2_EVENT_READIUMCSS,
} from "../../common/events";
import {
    READIUM2_ELECTRON_HTTP_PROTOCOL,
    convertCustomSchemeToHttpUrl,
} from "../../common/sessions";
import { IElectronWebviewTagWindow } from "./state";
import {
    focusCssStyles,
    readPosCssStyles,
    scrollBarCssStyles,
    selectionCssStyles,
    targetCssStyles,
} from "./styles";

const win = (global as any).window as IElectronWebviewTagWindow;

// TODO DARK THEME
const CSS_CLASS_DARK_THEME = "mdc-theme--dark";

// TODO: extract the const string "readium-css"
// (also used in electron/main/readium-css.ts)
let origin = win.location.origin;
if (origin.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://")) {
    origin = convertCustomSchemeToHttpUrl(win.location.href);
    origin = origin.replace(/\/pub\/.*/, "");
}
const urlRootReadiumCSS = origin + "/readium-css/";
console.log(urlRootReadiumCSS);
// const urlResizeSensor = win.location.origin + "/resize-sensor.js";

export const DEBUG_VISUALS = false;

export const configureFixedLayout = (isFixedLayout: boolean) => {
    if (!win.document || !win.document.head || !win.document.body) {
        return;
    }

    let width: number = win.READIUM2.fxlViewportWidth;
    let height: number = win.READIUM2.fxlViewportHeight;

    if (!width || !height) {
        const metaViewport = win.document.head.querySelector("meta[name=viewport]");
        if (!metaViewport) {
            console.log("configureFixedLayout NO meta[name=viewport]");
            return;
        }
        const attr = metaViewport.getAttribute("content");
        if (!attr) {
            console.log("configureFixedLayout NO meta[name=viewport && content]");
            return;
        }
        const wMatch = attr.match(/\s*width\s*=\s*([0-9]+)/);
        if (wMatch && wMatch.length >= 2) {
            try {
                width = parseInt(wMatch[1], 10);
            } catch (err) {
                console.log(err);
                // ignore
            }
        } else {
            console.log("configureFixedLayout NO meta[name=viewport && content WIDTH]");
        }
        const hMatch = attr.match(/\s*height\s*=\s*([0-9]+)/);
        if (hMatch && hMatch.length >= 2) {
            try {
                height = parseInt(hMatch[1], 10);
            } catch (err) {
                console.log(err);
                // ignore
            }
        } else {
            console.log("configureFixedLayout NO meta[name=viewport && content HEIGHT]");
        }

        if (width && height) {
            console.log("READIUM_FXL_VIEWPORT_WIDTH: " + width);
            console.log("READIUM_FXL_VIEWPORT_HEIGHT: " + height);

            win.READIUM2.fxlViewportWidth = width;
            win.READIUM2.fxlViewportHeight = height;
        }
    }

    if (width && height && isFixedLayout
        && win.document && win.document.documentElement && win.document.body) {
        win.document.documentElement.style.overflow = "hidden";

        // Many FXL EPUBs lack the body dimensions (only viewport meta)
        win.document.body.style.width = width + "px";
        win.document.body.style.height = height + "px";
        win.document.body.style.overflow = "hidden";
        win.document.body.style.margin = "0"; // 8px by default!

        console.log("FXL width: " + width);
        console.log("FXL height: " + height);

        const visibleWidth = win.innerWidth;
        const visibleHeight = win.innerHeight;
        console.log("FXL visible width: " + visibleWidth);
        console.log("FXL visible height: " + visibleHeight);

        const ratioX = visibleWidth / width;
        const ratioY = visibleHeight / height;
        const ratio = Math.min(ratioX, ratioY);

        const tx = (visibleWidth - (width * ratio)) / 2;
        const ty = (visibleHeight - (height * ratio)) / 2;
        console.log("FXL trans X: " + tx);
        console.log("FXL trans Y: " + ty);

        win.document.documentElement.style.transformOrigin = "0 0";
        win.document.documentElement.style.transform = `translateX(${tx}px) translateY(${ty}px) scale(${ratio})`;
    }
};

export const injectDefaultCSS = () => {
    appendCSSInline("electron-selection", selectionCssStyles);
    appendCSSInline("electron-focus", focusCssStyles);
    appendCSSInline("electron-target", targetCssStyles);
    appendCSSInline("electron-scrollbars", scrollBarCssStyles);
};

export const injectReadPosCSS = () => {
    if (!DEBUG_VISUALS) {
        return;
    }
    appendCSSInline("electron-readPos", readPosCssStyles);
};

let _isVerticalWritingMode = false;
export function isVerticalWritingMode(): boolean {
    return _isVerticalWritingMode;
}

let _isRTL = false;
export function isRTL(): boolean {
    return _isRTL;
}

export const isPaginated = (): boolean => {
    return win && win.document && win.document.documentElement &&
        win.document.documentElement.classList.contains("readium-paginated");
};

export const calculateMaxScrollShift = (): number => {

    if (!win || !win.document || !win.document.body || !win.document.documentElement) {
        return 0;
    }

    const isPaged = isPaginated();

    const maxScrollShift = isPaged ?
        ((isVerticalWritingMode() ?
            (win.document.body.scrollHeight - win.document.documentElement.offsetHeight) :
            (win.document.body.scrollWidth - win.document.documentElement.offsetWidth))) :
        ((isVerticalWritingMode() ?
            (win.document.body.scrollWidth - win.document.documentElement.clientWidth) :
            (win.document.body.scrollHeight - win.document.documentElement.clientHeight)));

    return maxScrollShift;
};

export const isTwoPageSpread = (): boolean => {

    if (!win || !win.document || !win.document.documentElement) {
        return false;
    }

    // const bodyStyle = win.getComputedStyle(win.document.body);
    const docStyle = win.getComputedStyle(win.document.documentElement);

    let docColumnCount: number | undefined;
    // let docColumnGap: number | undefined;
    if (docStyle) {
        docColumnCount = parseInt(docStyle.getPropertyValue("column-count"), 10);
        // docColumnGap = parseInt(docStyle.getPropertyValue("column-gap"), 10);
    }

    return docColumnCount === 2;
};
export const calculateTotalColumns = (): number => {
    if (!win || !win.document || !win.document.body || !isPaginated()) {
        return 0;
    }

    let totalColumns = 0;
    if (isVerticalWritingMode()) {
        totalColumns = Math.ceil(win.document.body.offsetWidth / win.document.body.scrollWidth);
    } else {
        totalColumns = Math.ceil(win.document.body.offsetHeight / win.document.body.scrollHeight);
    }
    return totalColumns;
};
export function calculateColumnDimension(): number {
    if (!win.document || !win.document.documentElement || !win.document.body || !isPaginated()) {
        return 0;
    }

    // win.document.body.offsetWidth + left/right margins === win.document.documentElement.offsetWidth
    // margins non-zero in single page view

    const isTwoPage = isTwoPageSpread();

    let columnDimension = 0;
    if (isVerticalWritingMode()) {
        columnDimension = win.document.documentElement.offsetHeight;
    } else {
        columnDimension = (win.document.documentElement.offsetWidth * (isTwoPage ? 0.5 : 1));
    }
    return columnDimension;
}

// TODO? page-progression-direction
// TODO? xml:lang ar, fa, he ==> RTL, ensure html@xml:lang and html@dir (if missing)
// TODO? xml:lang zh, ja, ko ==> horizontal, ensure html@xml:lang (if missing)
// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS16-internationalization.md
// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS12-user_prefs.md#user-settings-can-be-language-specific
function computeVerticalRTL() {

    if (!win.document || !win.document.documentElement) {
        return;
    }

    let dirAttr = win.document.documentElement.getAttribute("dir");
    if (dirAttr === "rtl") {
        _isRTL = true;
    }
    if (!_isRTL && win.document.body) {
        dirAttr = win.document.body.getAttribute("dir");
        if (dirAttr === "rtl") {
            _isRTL = true;
        }
    }

    const htmlStyle = win.getComputedStyle(win.document.documentElement);
    if (htmlStyle) {
        let prop = htmlStyle.getPropertyValue("writing-mode");
        if (!prop) {
            prop = htmlStyle.getPropertyValue("-epub-writing-mode");
        }
        if (prop && prop.indexOf("vertical") >= 0) {
            _isVerticalWritingMode = true;
        }
        if (prop && prop.indexOf("-rl") > 0) {
            _isRTL = true;
        }
        if (!_isRTL) {
            prop = htmlStyle.getPropertyValue("direction");
            if (prop && prop.indexOf("rtl") >= 0) {
                _isRTL = true;
            }
        }
    }
    if ((!_isVerticalWritingMode || !_isRTL) && win.document.body) {
        const bodyStyle = win.getComputedStyle(win.document.body);
        if (bodyStyle) {
            let prop: string;
            if (!_isVerticalWritingMode) {
                prop = bodyStyle.getPropertyValue("writing-mode");
                if (!prop) {
                    prop = bodyStyle.getPropertyValue("-epub-writing-mode");
                }
                if (prop && prop.indexOf("vertical") >= 0) {
                    _isVerticalWritingMode = true;
                }
                if (prop && prop.indexOf("-rl") > 0) {
                    _isRTL = true;
                }
            }
            if (!_isRTL) {
                prop = bodyStyle.getPropertyValue("direction");
                if (prop && prop.indexOf("rtl") >= 0) {
                    _isRTL = true;
                }
            }
        }
    }

    console.log("_isVerticalWritingMode: " + _isVerticalWritingMode);
    console.log("_isRTL: " + _isRTL);
}

// after DOMContentLoaded
win.addEventListener("load", () => {
    computeVerticalRTL();
});

const ensureHead = () => {

    if (!win.document || !win.document.documentElement) {
        return;
    }

    const docElement = win.document.documentElement;

    if (!win.document.head) {
        const headElement = win.document.createElement("head");
        if (win.document.body) {
            docElement.insertBefore(headElement, win.document.body);
        } else {
            docElement.appendChild(headElement);
        }
    }
};

ipcRenderer.on(R2_EVENT_READIUMCSS, (_event: any, payload: IEventPayload_R2_EVENT_READIUMCSS) => {
    readiumCSS(payload);
});

// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS12-user_prefs.md
// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/ReadiumCSS-user_variables.css
// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS19-api.md#user-settings
function readiumCSSSet(messageJson: IEventPayload_R2_EVENT_READIUMCSS) {
    if (!messageJson) {
        return;
    }

    if (!win.document || !win.document.documentElement) {
        return;
    }

    const docElement = win.document.documentElement;

    if (!messageJson.setCSS) {

        docElement.removeAttribute("data-readiumcss");
        removeAllCSS();
        removeAllCSSInline();

        if (messageJson.isFixedLayout) {
            docElement.style.overflow = "hidden";
        } else {
            docElement.style.overflow = "auto";
        }

        const toRemove: string[] = [];
        for (let i = 0; i < docElement.style.length; i++) {
            const item = docElement.style.item(i);
            if (item.indexOf("--USER__") === 0) {
                toRemove.push(item);
            }
        }
        toRemove.forEach((item) => {
            docElement.style.removeProperty(item);
        });

        docElement.classList.remove(CSS_CLASS_DARK_THEME);

        return;
    }

    if (!docElement.hasAttribute("data-readiumcss")) {
        docElement.setAttribute("data-readiumcss", "yes");

        let needsDefaultCSS = true;
        if (win.document.head && win.document.head.childElementCount) {
            let elem = win.document.head.firstElementChild;
            while (elem) {
                if ((elem.localName && elem.localName.toLowerCase() === "style") ||
                    (elem.getAttribute &&
                        (elem.getAttribute("rel") === "stylesheet" ||
                            elem.getAttribute("type") === "text/css" ||
                            (elem.getAttribute("src") &&
                                (elem.getAttribute("src") as string).endsWith(".css"))))) {
                    needsDefaultCSS = false;
                    break;
                }
                elem = elem.nextElementSibling;
            }
        }
        if (needsDefaultCSS && win.document.body) {
            const styleAttr = win.document.body.querySelector("*[style]");
            if (styleAttr) {
                needsDefaultCSS = false;
            }
        }

        const urlRoot = messageJson.urlRoot ?
            messageJson.urlRoot + "/readium-css/" :
            urlRootReadiumCSS;

        appendCSS("before", urlRoot);
        if (needsDefaultCSS) {
            appendCSS("default", urlRoot);
        }
        appendCSS("after", urlRoot);
    }

    const setCSS = messageJson.setCSS;

    if (DEBUG_VISUALS) {
        console.log("---- setCSS -----");
        console.log(setCSS);
        console.log("-----");
    }

    if (setCSS.night) {
        // win.document.body
        docElement.classList.add(CSS_CLASS_DARK_THEME);
    } else {
        // win.document.body
        docElement.classList.remove(CSS_CLASS_DARK_THEME);
    }

    const needsAdvanced = true; // textAlign, bodyHyphens, fontSize, etc.

    // readium-advanced-on | readium-advanced-off
    docElement.style.setProperty("--USER__advancedSettings",
        needsAdvanced ? "readium-advanced-on" : "readium-advanced-off");

    // readium-darken-on | readium-darken-off
    if (typeof setCSS.darken === "undefined") {
        docElement.style.removeProperty("--USER__darkenFilter");
    } else {
        docElement.style.setProperty("--USER__darkenFilter",
            setCSS.darken ? "readium-darken-on" : "readium-darken-off");
    }

    // readium-invert-on | readium-invert-off
    if (typeof setCSS.invert === "undefined") {
        docElement.style.removeProperty("--USER__invertFilter");
    } else {
        docElement.style.setProperty("--USER__invertFilter",
            setCSS.invert ? "readium-invert-on" : "readium-invert-off");
    }

    // readium-default-on | readium-sepia-on | readium-night-on
    docElement.style.setProperty("--USER__appearance",
        setCSS.sepia ? "readium-sepia-on" :
        (setCSS.night ? "readium-night-on" : "readium-default-on"));

    // readium-paged-on | readium-scroll-on
    docElement.style.setProperty("--USER__view",
        setCSS.paged ? "readium-paged-on" : "readium-scroll-on");
    if (setCSS.paged) {
        docElement.style.overflow = "hidden";
        docElement.classList.add("readium-paginated");
    } else {
        docElement.style.overflow = "auto";
        docElement.classList.remove("readium-paginated");
    }

    const defaultPublisherFont = !setCSS.font || setCSS.font === "DEFAULT";

    const a11yNormalize = ((typeof setCSS.a11yNormalize !== "undefined") ?
        (setCSS.a11yNormalize ? "readium-a11y-on" : "readium-a11y-off") :
        "readium-a11y-off" // will remove, because undefined
        );

    const needsFontOverride = a11yNormalize === "readium-a11y-on" || !defaultPublisherFont;

    // readium-font-on | readium-font-off
    docElement.style.setProperty("--USER__fontOverride",
        needsFontOverride ? "readium-font-on" : "readium-font-off");

    // readium-a11y-on | readium-a11y-off
    if (typeof setCSS.a11yNormalize === "undefined") {
        docElement.style.removeProperty("--USER__a11yNormalize");
    } else {
        docElement.style.setProperty("--USER__a11yNormalize", a11yNormalize);
    }

    if (defaultPublisherFont) {
        docElement.style.removeProperty("--USER__fontFamily");
    } else {
        const font = setCSS.font;
        let fontValue = "";
        if (font === "DUO" || font === "IA Writer Duospace") {
            fontValue = "IA Writer Duospace";
        } else if (font === "DYS" || font === "AccessibleDfa") {
            fontValue = "AccessibleDfa";
        } else if (font === "OLD" || font === "oldStyleTf") {
            fontValue = "var(--RS__oldStyleTf)";
        } else if (font === "MODERN" || font === "modernTf") {
            fontValue = "var(--RS__modernTf)";
        } else if (font === "SANS" || font === "sansTf") {
            fontValue = "var(--RS__sansTf)";
        } else if (font === "HUMAN" || font === "humanistTf") {
            fontValue = "var(--RS__humanistTf)";
        } else if (font === "MONO" || font === "monospaceTf") {
            fontValue = "var(--RS__monospaceTf)";
        } else if (font === "JA" || font === "serif-ja") {
            fontValue = "var(--RS__serif-ja)";
        } else if (font === "JA-SANS" || font === "sans-serif-ja") {
            fontValue = "var(--RS__sans-serif-ja)";
        } else if (font === "JA-V" || font === "serif-ja-v") {
            fontValue = "var(--RS__serif-ja-v)";
        } else if (font === "JA-V-SANS" || font === "sans-serif-ja-v") {
            fontValue = "var(--RS__sans-serif-ja-v)";
        } else if (typeof font === "string") {
            fontValue = font;
        }
        if (fontValue) {
            docElement.style.setProperty("--USER__fontFamily", fontValue);
        } else {
            docElement.style.removeProperty("--USER__fontFamily");
        }
    }

    if (setCSS.fontSize) {
        docElement.style.setProperty("--USER__fontSize", setCSS.fontSize);
    } else {
        docElement.style.removeProperty("--USER__fontSize");
    }

    if (setCSS.lineHeight) {
        docElement.style.setProperty("--USER__lineHeight", setCSS.lineHeight);
    } else {
        docElement.style.removeProperty("--USER__lineHeight");
    }

    if (setCSS.typeScale) {
        docElement.style.setProperty("--USER__typeScale", setCSS.typeScale);
    } else {
        docElement.style.removeProperty("--USER__typeScale");
    }

    if (setCSS.paraSpacing) {
        docElement.style.setProperty("--USER__paraSpacing", setCSS.paraSpacing);
    } else {
        docElement.style.removeProperty("--USER__paraSpacing");
    }

    const isCJK = false; // TODO, lang tag?
    if (_isVerticalWritingMode || (_isRTL || isCJK)) {
        docElement.style.removeProperty("--USER__bodyHyphens");

        docElement.style.removeProperty("--USER__wordSpacing");

        docElement.style.removeProperty("--USER__letterSpacing");

        if (_isVerticalWritingMode || isCJK) {
            if (_isVerticalWritingMode) {
                docElement.style.removeProperty("--USER__colCount");
            }

            docElement.style.removeProperty("--USER__paraIndent");

            docElement.style.removeProperty("--USER__textAlign");

        } else if (_isRTL) {
            if (setCSS.ligatures) {
                docElement.style.setProperty("--USER__ligatures", setCSS.ligatures);
            } else {
                docElement.style.removeProperty("--USER__ligatures");
            }
        }
    } else {
        if (setCSS.bodyHyphens) {
            docElement.style.setProperty("--USER__bodyHyphens", setCSS.bodyHyphens);
        } else {
            docElement.style.removeProperty("--USER__bodyHyphens");
        }

        if (setCSS.wordSpacing) {
            docElement.style.setProperty("--USER__wordSpacing", setCSS.wordSpacing);
        } else {
            docElement.style.removeProperty("--USER__wordSpacing");
        }

        if (setCSS.letterSpacing) {
            docElement.style.setProperty("--USER__letterSpacing", setCSS.letterSpacing);
        } else {
            docElement.style.removeProperty("--USER__letterSpacing");
        }

        if (!_isVerticalWritingMode) {
            if (setCSS.colCount) {
                docElement.style.setProperty("--USER__colCount", setCSS.colCount);
            } else {
                docElement.style.removeProperty("--USER__colCount");
            }

            if (setCSS.paraIndent) {
                docElement.style.setProperty("--USER__paraIndent", setCSS.paraIndent);
            } else {
                docElement.style.removeProperty("--USER__paraIndent");
            }

            if (setCSS.textAlign) {
                docElement.style.setProperty("--USER__textAlign", setCSS.textAlign);
            } else {
                docElement.style.removeProperty("--USER__textAlign");
            }
        } else if (!_isRTL) {
            docElement.style.removeProperty("--USER__ligatures");
        }
    }

    if (setCSS.pageMargins) {
        docElement.style.setProperty("--USER__pageMargins", setCSS.pageMargins);
    } else {
        docElement.style.removeProperty("--USER__pageMargins");
    }

    if (setCSS.backgroundColor) {
        docElement.style.setProperty("--USER__backgroundColor", setCSS.backgroundColor);
    } else {
        docElement.style.removeProperty("--USER__backgroundColor");
    }
    if (setCSS.textColor) {
        docElement.style.setProperty("--USER__textColor", setCSS.textColor);
    } else {
        docElement.style.removeProperty("--USER__textColor");
    }
}

export const readiumCSS = (messageJson: IEventPayload_R2_EVENT_READIUMCSS) => {
    readiumCSSSet(messageJson);
};

function appendCSSInline(id: string, css: string) {
    ensureHead();

    if (!win.document || !win.document.head) {
        return;
    }

    const styleElement = win.document.createElement("style");
    styleElement.setAttribute("id", "Readium2-" + id);
    styleElement.setAttribute("type", "text/css");
    styleElement.appendChild(document.createTextNode(css));
    win.document.head.appendChild(styleElement);
}

// unused (for now)
// function removeCSSInline(id: string) {
//     const styleElement = win.document.getElementById("Readium2-" + id);
//     if (styleElement && styleElement.parentNode) {
//         styleElement.parentNode.removeChild(styleElement);
//     }
// }

function appendCSS(mod: string, urlRoot: string) {
    ensureHead();

    if (!win.document || !win.document.head) {
        return;
    }

    const linkElement = win.document.createElement("link");
    linkElement.setAttribute("id", "ReadiumCSS-" + mod);
    linkElement.setAttribute("rel", "stylesheet");
    linkElement.setAttribute("type", "text/css");
    linkElement.setAttribute("href", urlRoot + "ReadiumCSS-" + mod + ".css");
    if (mod === "before" && win.document.head.childElementCount) {
        win.document.head.insertBefore(linkElement, win.document.head.firstElementChild);
    } else {
        win.document.head.appendChild(linkElement);
    }
}

function removeCSS(mod: string) {
    const linkElement = win.document.getElementById("ReadiumCSS-" + mod);
    if (linkElement && linkElement.parentNode) {
        linkElement.parentNode.removeChild(linkElement);
    }
}

function removeAllCSSInline() {
    // removeCSSInline("electron-selection");
    // removeCSSInline("electron-focus");
    // removeCSSInline("electron-scrollbars");
}

function removeAllCSS() {
    removeCSS("before");
    removeCSS("after");
    // removeCSS("base");
    // removeCSS("html5patch");
    // removeCSS("safeguards");
    removeCSS("default");
    // removeCSS("highlights");
    // removeCSS("scroll");
    // removeCSS("pagination");
    // removeCSS("night_mode");
    // removeCSS("pagination");
    // removeCSS("os_a11y");
    // removeCSS("user_settings");
    // removeCSS("fs_normalize");
}

// // // https://javascript.info/size-and-scroll
// export function debugCSSMetrics() {

//     if (!win || !win.document || !win.document.documentElement || !win.document.body) {
//         return;
//     }

//     // offsetW/H: excludes margin, includes border, scrollbar, padding.
//     // clientW/H: excludes margin, border, scrollbar, includes padding.
//     // scrollW/H: like client, but includes hidden (overflow) areas

//     const bodyStyle = win.getComputedStyle(win.document.body);
//     const docStyle = win.getComputedStyle(win.document.documentElement);

//     console.log("--- XXXXX ---");
//     console.log("webview.innerWidth: " + win.innerWidth);
//     console.log("document.offsetWidth: " + win.document.documentElement.offsetWidth);
//     console.log("document.clientWidth: " + win.document.documentElement.clientWidth);
//     console.log("document.scrollWidth: " + win.document.documentElement.scrollWidth);
//     console.log("document.scrollLeft: " + win.document.documentElement.scrollLeft);
//     if (docStyle) {
//         let propVal = docStyle.getPropertyValue("padding-left");
//         const docPaddingLeft = parseInt(propVal, 10);
//         console.log("document.paddingLeft: " + docPaddingLeft + " // " + propVal);

//         propVal = docStyle.getPropertyValue("padding-right");
//         const docPaddingRight = parseInt(propVal, 10);
//         console.log("document.paddingRight: " + docPaddingRight + " // " + propVal);

//         propVal = docStyle.getPropertyValue("margin-left");
//         const docMarginLeft = parseInt(propVal, 10);
//         console.log("document.marginLeft: " + docMarginLeft + " // " + propVal);

//         propVal = docStyle.getPropertyValue("margin-right");
//         const docMarginRight = parseInt(propVal, 10);
//         console.log("document.marginRight: " + docMarginRight + " // " + propVal);

//         const docTotalWidth = win.document.documentElement.offsetWidth + docMarginLeft + docMarginRight;
//         console.log("document.offsetWidth + margins: " + docTotalWidth);
//     }
//     console.log("body.offsetWidth: " + win.document.body.offsetWidth);
//     console.log("body.clientWidth: " + win.document.body.clientWidth);
//     console.log("body.scrollWidth: " + win.document.body.scrollWidth);
//     console.log("body.scrollLeft: " + win.document.body.scrollLeft);
//     if (bodyStyle) {
//         let propVal = bodyStyle.getPropertyValue("padding-left");
//         const bodyPaddingLeft = parseInt(bodyStyle.getPropertyValue("padding-left"), 10);
//         console.log("body.paddingLeft: " + bodyPaddingLeft + " // " + propVal);

//         propVal = bodyStyle.getPropertyValue("padding-right");
//         const bodyPaddingRight = parseInt(propVal, 10);
//         console.log("body.paddingRight: " + bodyPaddingRight + " // " + propVal);

//         propVal = bodyStyle.getPropertyValue("margin-left");
//         const bodyMarginLeft = parseInt(propVal, 10);
//         console.log("body.marginLeft: " + bodyMarginLeft + " // " + propVal);

//         propVal = bodyStyle.getPropertyValue("margin-right");
//         const bodyMarginRight = parseInt(propVal, 10);
//         console.log("body.marginRight: " + bodyMarginRight + " // " + propVal);

//         const bodyTotalWidth = win.document.body.offsetWidth + bodyMarginLeft + bodyMarginRight;
//         console.log("body.offsetWidth + margins: " + bodyTotalWidth);

//         console.log("--- X factor: " + (win.document.documentElement.offsetWidth / bodyTotalWidth));
//     }
//     console.log("--- YYYYY ---");
//     console.log("webview.innerHeight: " + win.innerHeight);
//     console.log("document.offsetHeight: " + win.document.documentElement.offsetHeight);
//     console.log("document.clientHeight: " + win.document.documentElement.clientHeight);
//     console.log("document.scrollHeight: " + win.document.documentElement.scrollHeight);
//     console.log("document.scrollTop: " + win.document.documentElement.scrollTop);
//     if (docStyle) {
//         let propVal = docStyle.getPropertyValue("padding-top");
//         const docPaddingTop = parseInt(propVal, 10);
//         console.log("document.paddingTop: " + docPaddingTop + " // " + propVal);

//         propVal = docStyle.getPropertyValue("padding-bottom");
//         const docPaddingBottom = parseInt(propVal, 10);
//         console.log("document.paddingBottom: " + docPaddingBottom + " // " + propVal);

//         propVal = docStyle.getPropertyValue("margin-top");
//         const docMarginTop = parseInt(propVal, 10);
//         console.log("document.marginTop: " + docMarginTop + " // " + propVal);

//         propVal = docStyle.getPropertyValue("margin-bottom");
//         const docMarginBottom = parseInt(propVal, 10);
//         console.log("document.marginBottom: " + docMarginBottom + " // " + propVal);

//         const docTotalHeight = win.document.documentElement.offsetHeight + docMarginTop + docMarginBottom;
//         console.log("document.offsetHeight + margins: " + docTotalHeight);
//     }
//     console.log("body.offsetHeight: " + win.document.body.offsetHeight);
//     console.log("body.clientHeight: " + win.document.body.clientHeight);
//     console.log("body.scrollHeight: " + win.document.body.scrollHeight);
//     console.log("body.scrollTop: " + win.document.body.scrollTop);
//     if (bodyStyle) {
//         let propVal = bodyStyle.getPropertyValue("padding-top");
//         const bodyPaddingTop = parseInt(propVal, 10);
//         console.log("body.paddingTop: " + bodyPaddingTop);

//         propVal = bodyStyle.getPropertyValue("padding-bottom");
//         const bodyPaddingBottom = parseInt(propVal, 10);
//         console.log("body.paddingBottom: " + bodyPaddingBottom);

//         propVal = bodyStyle.getPropertyValue("margin-top");
//         const bodyMarginTop = parseInt(propVal, 10);
//         console.log("body.marginTop: " + bodyMarginTop);

//         propVal = bodyStyle.getPropertyValue("margin-bottom");
//         const bodyMarginBottom = parseInt(propVal, 10);
//         console.log("body.marginBottom: " + bodyMarginBottom);

//         const bodyTotalHeight = win.document.body.offsetHeight + bodyMarginTop + bodyMarginBottom;
//         console.log("body.offsetHeight + margins: " + bodyTotalHeight);

//         console.log("--- Y factor: " + (win.document.documentElement.offsetHeight / bodyTotalHeight));
//     }
//     console.log("---");
// }
