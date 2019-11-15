// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debug_ from "debug";
import * as xmldom from "xmldom";

import { IEventPayload_R2_EVENT_READIUMCSS } from "./events";
import { READIUM_CSS_URL_PATH } from "./readium-css-settings";
import {
    ROOT_CLASS_MATHJAX, ROOT_CLASS_NO_FOOTNOTES, ROOT_CLASS_REDUCE_MOTION, focusCssStyles,
    footnotesCssStyles, readPosCssStyles, scrollBarCssStyles, selectionCssStyles, targetCssStyles,
    ttsCssStyles, visibilityMaskCssStyles,
} from "./styles";

// now match with :root[style*="readium-night-on"]
// const CSS_CLASS_DARK_THEME = "mdc-theme--dark";

export const CLASS_PAGINATED = "r2-css-paginated";

// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS16-internationalization.md
// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS12-user_prefs.md#user-settings-can-be-language-specific

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

const debug = debug_("r2:navigator#electron/common/readium-css-inject");

// import { IReadiumElectronWebviewWindow } from "../renderer/webview/state";
// ((global as any).window as IReadiumElectronWebviewWindow).READIUM2.DEBUG_VISUALS
function isDEBUG_VISUALS(documant: Document): boolean {
    if (!IS_DEV) {
        return false;
    }
    if (documant.defaultView && (documant.defaultView as any).READIUM2 &&
        (documant.defaultView as any).READIUM2.DEBUG_VISUALS) {
        return true;
    }
    return false;
}

export function isDocVertical(documant: Document): boolean {
    if (!documant || !documant.documentElement) {
        return false;
    }

    // let vertical = false;

    // let langAttr = documant.documentElement.getAttribute("lang");
    // if (!langAttr) {
    //     langAttr = documant.documentElement.getAttribute("xml:lang");
    // }
    // if (!langAttr) {
    //     langAttr = documant.documentElement.getAttributeNS("http://www.w3.org/XML/1998/", "lang");
    // }
    // if (langAttr &&
    //     (langAttr === "zh" || langAttr.startsWith("zh-") ||
    //     langAttr === "ja" || langAttr.startsWith("ja-") ||
    //     langAttr === "ko" || langAttr.startsWith("ko-"))) {
    //     // foundLang = true;
    //     vertical = true;
    // }

    // return vertical;

    return false;
}

export function isDocRTL(documant: Document): boolean {
    if (!documant || !documant.documentElement) {
        return false;
    }

    let rtl = false;

    let foundDir = false;

    let dirAttr = documant.documentElement.getAttribute("dir");
    if (dirAttr === "rtl") {
        foundDir = true;
        rtl = true;
    }
    if (!rtl && documant.body) {
        dirAttr = documant.body.getAttribute("dir");
        if (dirAttr === "rtl") {
            foundDir = true;
            rtl = true;
        }
    }

    // let foundLang = false;

    if (!rtl) {
        let langAttr = documant.documentElement.getAttribute("lang");
        if (!langAttr) {
            langAttr = documant.documentElement.getAttribute("xml:lang");
        }
        if (!langAttr) {
            langAttr = documant.documentElement.getAttributeNS("http://www.w3.org/XML/1998/", "lang");
        }
        if (langAttr &&
            (langAttr === "ar" || langAttr.startsWith("ar-") ||
            langAttr === "he" || langAttr.startsWith("he-") ||
            langAttr === "fa" || langAttr.startsWith("fa-")) ||
            langAttr === "zh-Hant" ||
            langAttr === "zh-TW"
            ) {
            // foundLang = true;
            rtl = true;
        }
    }
    if (rtl) {
        if (!foundDir) {
            documant.documentElement.setAttribute("dir", "rtl");
        }
        // really?
        // if (!foundLang) {
        //     documant.documentElement.setAttribute("lang", "ar");
        //     // documant.documentElement.setAttributeNS("http://www.w3.org/XML/1998/", "lang", "ar");
        //     documant.documentElement.setAttribute("xml:lang", "ar");
        // }
    }
    return rtl;
}

export function isPaginated(documant: Document): boolean {
    return documant && documant.documentElement &&
        documant.documentElement.classList.contains(CLASS_PAGINATED);
}

// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS12-user_prefs.md
// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/ReadiumCSS-user_variables.css
// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS19-api.md#user-settings
export function readiumCSSSet(
    documant: Document,
    messageJson: IEventPayload_R2_EVENT_READIUMCSS,
    urlRootReadiumCSS: string | undefined,
    isVerticalWritingMode: boolean, isRTL: boolean) {

    if (!messageJson) {
        return;
    }

    if (!documant || !documant.documentElement) {
        return;
    }

    const docElement = documant.documentElement;

    if (messageJson.isFixedLayout) {
        docElement.style.overflow = "hidden";
        return; // exit early
    }

    const setCSS = messageJson.setCSS;
    if (!setCSS) {

        docElement.classList.remove(ROOT_CLASS_NO_FOOTNOTES);

        docElement.removeAttribute("data-readiumcss");
        removeAllCSS(documant);
        // removeAllCSSInline(documant);

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

        // docElement.classList.remove(CSS_CLASS_DARK_THEME);

        return;
    }

    if (!docElement.hasAttribute("data-readiumcss")) {
        docElement.setAttribute("data-readiumcss", "yes");

        let needsDefaultCSS = true;

        // Not in XMLDOM :(
        // if (documant.head && documant.head.childElementCount) {
        //     let elem = documant.head.firstElementChild;
        //     while (elem) {
        //         // ...
        //         elem = elem.nextElementSibling;
        //     }
        // }
        if (documant.head && documant.head.childNodes && documant.head.childNodes.length) {
            // tslint:disable-next-line: prefer-for-of
            for (let i = 0; i < documant.head.childNodes.length; i++) {
                const child = documant.head.childNodes[i];
                if (child.nodeType === 1) { // Node.ELEMENT_NODE
                    const element = child as Element;
                    if ((element.localName && element.localName.toLowerCase() === "style") ||
                        (element.getAttribute &&
                            (element.getAttribute("rel") === "stylesheet" ||
                                element.getAttribute("type") === "text/css" ||
                                (element.getAttribute("src") &&
                                    (element.getAttribute("src") as string).endsWith(".css"))))) {
                        needsDefaultCSS = false;
                        break;
                    }
                }
            }
        }

        if (needsDefaultCSS && documant.body) {
            // Not in XMLDOM :(
            // querySelector("*[style]");
            const styleAttr = documant.body.getAttribute("style");
            if (styleAttr) {
                needsDefaultCSS = false;
            }
        }

        const urlRoot = messageJson.urlRoot ?
            (messageJson.urlRoot + "/" + READIUM_CSS_URL_PATH + "/") :
            (urlRootReadiumCSS ? urlRootReadiumCSS : ("/" + READIUM_CSS_URL_PATH + "/"));

        appendCSS(documant, "before", urlRoot);
        if (needsDefaultCSS) {
            appendCSS(documant, "default", urlRoot);
        }
        appendCSS(documant, "after", urlRoot);
    }

    if (isDEBUG_VISUALS(documant)) {
        debug("---- setCSS -----");
        debug(setCSS);
        debug("-----");
    }

    if (setCSS.noFootnotes) {
        docElement.classList.add(ROOT_CLASS_NO_FOOTNOTES);
    } else {
        docElement.classList.remove(ROOT_CLASS_NO_FOOTNOTES);
    }

    if (setCSS.mathJax) {
        docElement.classList.add(ROOT_CLASS_MATHJAX);
    } else {
        docElement.classList.remove(ROOT_CLASS_MATHJAX);
    }

    if (setCSS.reduceMotion) {
        docElement.classList.add(ROOT_CLASS_REDUCE_MOTION);
    } else {
        docElement.classList.remove(ROOT_CLASS_REDUCE_MOTION);
    }

    // if (setCSS.night) {
    //     // documant.body
    //     docElement.classList.add(CSS_CLASS_DARK_THEME);
    // } else {
    //     // documant.body
    //     docElement.classList.remove(CSS_CLASS_DARK_THEME);
    // }

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
        docElement.classList.add(CLASS_PAGINATED);
    } else {
        docElement.style.overflow = "auto";
        docElement.classList.remove(CLASS_PAGINATED);
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
    if (isVerticalWritingMode || (isRTL || isCJK)) {
        docElement.style.removeProperty("--USER__bodyHyphens");

        docElement.style.removeProperty("--USER__wordSpacing");

        docElement.style.removeProperty("--USER__letterSpacing");

        if (isVerticalWritingMode || isCJK) {
            if (isVerticalWritingMode) {
                docElement.style.removeProperty("--USER__colCount");
            }

            docElement.style.removeProperty("--USER__paraIndent");

            docElement.style.removeProperty("--USER__textAlign");

        } else if (isRTL) {
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
    }

    if (!isVerticalWritingMode) {
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
    } else if (!isRTL) {
        docElement.style.removeProperty("--USER__ligatures");
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

export interface IwidthHeight {
    width: number;
    height: number;
    scale: number;
    tx: number;
    ty: number;
}
export function configureFixedLayout(
        documant: Document,
        isFixedLayout: boolean,
        fxlViewportWidth: number, fxlViewportHeight: number,
        innerWidth: number, innerHeight: number): IwidthHeight | undefined {

    if (!documant || !documant.head || !documant.body) {
        return undefined;
    }
    let wh: IwidthHeight | undefined;

    let width: number = fxlViewportWidth;
    let height: number = fxlViewportHeight;

    if (!width || !height) {
        let metaViewport: Element | null = null;
        // Not in XMLDOM :(
        if (documant.head.querySelector) {
            metaViewport = documant.head.querySelector("meta[name=viewport]");
        } else {
            if (documant.head.childNodes && documant.head.childNodes.length) {
                // tslint:disable-next-line: prefer-for-of
                for (let i = 0; i < documant.head.childNodes.length; i++) {
                    const child = documant.head.childNodes[i];
                    if (child.nodeType === 1) { // Node.ELEMENT_NODE
                        const element = child as Element;
                        if (element.localName && element.localName.toLowerCase() === "meta") {
                            if (element.getAttribute("name") === "viewport") {
                                metaViewport = element;
                                break;
                            }
                        }
                    }
                }
            }
        }
        if (!metaViewport) {
            if (isDEBUG_VISUALS(documant)) {
                debug("configureFixedLayout NO meta[name=viewport]");
            }
            return undefined;
        }
        const attr = metaViewport.getAttribute("content");
        if (!attr) {
            if (isDEBUG_VISUALS(documant)) {
                debug("configureFixedLayout NO meta[name=viewport && content]");
            }
            return undefined;
        }
        const wMatch = attr.match(/\s*width\s*=\s*([0-9]+)/);
        if (wMatch && wMatch.length >= 2) {
            try {
                width = parseInt(wMatch[1], 10);
            } catch (err) {
                debug(err);
                // ignore
            }
        } else {
            if (isDEBUG_VISUALS(documant)) {
                debug("configureFixedLayout NO meta[name=viewport && content WIDTH]");
            }
        }
        const hMatch = attr.match(/\s*height\s*=\s*([0-9]+)/);
        if (hMatch && hMatch.length >= 2) {
            try {
                height = parseInt(hMatch[1], 10);
            } catch (err) {
                debug(err);
                // ignore
            }
        } else {
            if (isDEBUG_VISUALS(documant)) {
                debug("configureFixedLayout NO meta[name=viewport && content HEIGHT]");
            }
        }

        if (width && height) {
            if (isDEBUG_VISUALS(documant)) {
                debug("READIUM_FXL_VIEWPORT_WIDTH: " + width);
                debug("READIUM_FXL_VIEWPORT_HEIGHT: " + height);
            }

            wh = {
                height,
                scale: 1,
                tx: 0,
                ty: 0,
                width,
            };
        }
    } else {
        wh = {
            height,
            scale: 1,
            tx: 0,
            ty: 0,
            width,
        };
    }
    if (innerWidth && innerHeight && width && height && isFixedLayout
        && documant && documant.documentElement && documant.body) {
        documant.documentElement.style.overflow = "hidden";

        // Many FXL EPUBs lack the body dimensions (only viewport meta)
        // documant.body.style.width = width + "px";
        // documant.body.style.height = height + "px";
        // documant.body.style.overflow = "hidden";
        // documant.body.style.margin = "0"; // 8px by default!

        if (isDEBUG_VISUALS(documant)) {
            debug("FXL width: " + width);
            debug("FXL height: " + height);
        }

        const visibleWidth = innerWidth;
        const visibleHeight = innerHeight;
        if (isDEBUG_VISUALS(documant)) {
            debug("FXL visible width: " + visibleWidth);
            debug("FXL visible height: " + visibleHeight);
        }

        const ratioX = visibleWidth / width;
        const ratioY = visibleHeight / height;
        const ratio = Math.min(ratioX, ratioY);

        const tx = (visibleWidth - (width * ratio)) / 2;
        const ty = (visibleHeight - (height * ratio)) / 2;
        if (isDEBUG_VISUALS(documant)) {
            debug("FXL trans X: " + tx);
            debug("FXL trans Y: " + ty);
            debug("FXL scale XY: " + ratio);
        }

        if (wh) {
            wh.scale = ratio;
            wh.tx = tx;
            wh.ty = ty;
        }
        documant.documentElement.style.transformOrigin = "0 0";
        // tslint:disable-next-line:max-line-length
        // documant.documentElement.style.transform = `translateX(${tx}px) translateY(${ty}px) scale3d(${ratio}, ${ratio}, 0)`;
        documant.documentElement.style.transform = `translate(${tx}px, ${ty}px) scale(${ratio})`;
    }
    return wh;
}

export function ensureHead(documant: Document) {

    if (!documant || !documant.documentElement) {
        return;
    }

    const docElement = documant.documentElement;

    if (!documant.head) {
        const headElement = documant.createElement("head");
        if (documant.body) {
            docElement.insertBefore(headElement, documant.body);
        } else {
            docElement.appendChild(headElement);
        }
    }
}

export function appendCSSInline(documant: Document, id: string, css: string) {
    ensureHead(documant);

    if (!documant || !documant.head) {
        return;
    }

    const idz = "Readium2-" + id;
    const s = documant.getElementById(idz);
    if (s) {
        return; // already injected via streamer?
    }
    const styleElement = documant.createElement("style");
    styleElement.setAttribute("id", idz);
    styleElement.setAttribute("type", "text/css");
    styleElement.appendChild(documant.createTextNode(css));
    documant.head.appendChild(styleElement);
}

// unused (for now)
// export function removeCSSInline(documant: Document, id: string) {
//     const styleElement = documant.getElementById("Readium2-" + id);
//     if (styleElement && styleElement.parentNode) {
//         styleElement.parentNode.removeChild(styleElement);
//     }
// }

export function appendCSS(documant: Document, mod: string, urlRoot: string) {
    ensureHead(documant);

    if (!documant || !documant.head) {
        return;
    }

    const idz = "ReadiumCSS-" + mod;
    const s = documant.getElementById(idz);
    if (s) {
        return; // already injected via streamer?
    }
    const linkElement = documant.createElement("link");
    linkElement.setAttribute("id", idz);
    linkElement.setAttribute("rel", "stylesheet");
    linkElement.setAttribute("type", "text/css");
    linkElement.setAttribute("href", urlRoot + "ReadiumCSS-" + mod + ".css");

    // Not in XMLDOM :(
    let childElementCount = 0;
    let firstElementChild: Element | null = null;
    if (typeof documant.head.childElementCount !== "undefined") {
        childElementCount = documant.head.childElementCount;
        firstElementChild = documant.head.firstElementChild;
    } else {
        if (documant.head && documant.head.childNodes && documant.head.childNodes.length) {
            // tslint:disable-next-line: prefer-for-of
            for (let i = 0; i < documant.head.childNodes.length; i++) {
                const child = documant.head.childNodes[i];
                if (child.nodeType === 1) { // Node.ELEMENT_NODE
                    childElementCount++;
                    if (!firstElementChild) {
                        firstElementChild = child as Element;
                    }
                }
            }
        }
    }

    if (mod === "before" && childElementCount && firstElementChild) {
        documant.head.insertBefore(linkElement, firstElementChild);
    } else {
        documant.head.appendChild(linkElement);
    }
}

export function removeCSS(documant: Document, mod: string) {
    const linkElement = documant.getElementById("ReadiumCSS-" + mod);
    if (linkElement && linkElement.parentNode) {
        linkElement.parentNode.removeChild(linkElement);
    }
}

// export function removeAllCSSInline(_documant: Document) {
//     // removeCSSInline("electron-selection");
//     // removeCSSInline("electron-focus");
//     // removeCSSInline("electron-scrollbars");
// }

export function removeAllCSS(documant: Document) {
    removeCSS(documant, "before");
    removeCSS(documant, "after");
    // removeCSS("base");
    // removeCSS("html5patch");
    // removeCSS("safeguards");
    removeCSS(documant, "default");
    // removeCSS("highlights");
    // removeCSS("scroll");
    // removeCSS("pagination");
    // removeCSS("night_mode");
    // removeCSS("pagination");
    // removeCSS("os_a11y");
    // removeCSS("user_settings");
    // removeCSS("fs_normalize");
}

export function injectDefaultCSS(documant: Document) {
    appendCSSInline(documant, "electron-tts", ttsCssStyles);
    appendCSSInline(documant, "electron-footnotes", footnotesCssStyles);
    appendCSSInline(documant, "electron-selection", selectionCssStyles);
    appendCSSInline(documant, "electron-focus", focusCssStyles);
    appendCSSInline(documant, "electron-target", targetCssStyles);
    appendCSSInline(documant, "electron-scrollbars", scrollBarCssStyles);
    appendCSSInline(documant, "electron-visibility-mask", visibilityMaskCssStyles);
}

export function injectReadPosCSS(documant: Document) {
    // if (!isDEBUG_VISUALS(documant)) {
    //     return;
    // }
    appendCSSInline(documant, "electron-readPos", readPosCssStyles);
}

function definePropertyGetterSetter_DocHeadBody(documant: Document, elementName: string) {

    Object.defineProperty(documant, elementName, {
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
                    if (child.nodeType === 1) { // Node.ELEMENT_NODE
                        const element = child as Element;
                        if (element.localName && element.localName.toLowerCase() === elementName) {
                            (doc as any)[key] = element; // cache
                            // if (isDEBUG_VISUALS(documant)) {
                            //     debug(`XMLDOM - cached documant.${elementName}`);
                            // }
                            return element;
                        }
                    }
                }
            }
            return undefined;
        },
        set(_val) {
            debug("documant." + elementName + " CANNOT BE SET!!");
        },
    });
}
function cssSetProperty(this: any, cssProperty: string, val: string) {
    const style = this;
    const elem = style.element;

    // debug(`XMLDOM - cssSetProperty: ${cssProperty}: ${val};`);
    cssStyleSet(cssProperty, val, elem);
}
function cssRemoveProperty(this: any, cssProperty: string) {
    const style = this;
    const elem = style.element;

    // debug(`XMLDOM - cssRemoveProperty: ${cssProperty}`);
    cssStyleSet(cssProperty, undefined, elem);
}
function cssStyleItem(this: any, i: number): string | undefined {
    const style = this;
    const elem = style.element;
    // if (isDEBUG_VISUALS(documant)) {
    //     debug(`XMLDOM - cssStyleItem: ${i}`);
    // }
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
                    // if (isDEBUG_VISUALS(documant)) {
                    //     debug(`XMLDOM - cssStyleItem: ${i} => ${regexMatch[1]}`);
                    // }
                    return regexMatch[1];
                }
            }
        }
    }
    return undefined;
}
function cssStyleGet(cssProperty: string, elem: Element): string | undefined {
    // if (isDEBUG_VISUALS(documant)) {
    //     debug(`XMLDOM - cssStyleGet: ${cssProperty}`);
    // }

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
            // if (isDEBUG_VISUALS(documant)) {
            //     debug(`XMLDOM - cssStyleGet: ${cssProperty} => ${cssPropertyValue}`);
            // }
            break;
        }
    }
    return cssPropertyValue ? cssPropertyValue : undefined;
}
function cssStyleSet(cssProperty: string, val: string | undefined, elem: Element) {
    // if (isDEBUG_VISUALS(documant)) {
    //     debug(`XMLDOM - cssStyleSet: ${cssProperty}: ${val};`);
    // }

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

            // if (isDEBUG_VISUALS(documant)) {
            //     debug(`XMLDOM - style.length`);
            // }

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
            // if (isDEBUG_VISUALS(documant)) {
            //     debug(`XMLDOM - style.length: ${count}`);
            // }
            return count;
        },
        set(_val) {
            debug("style.length CANNOT BE SET!!");
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
    // if (isDEBUG_VISUALS(documant)) {
    //     debug(`XMLDOM - classListContains: ${className}`);
    // }

    const classAttr = elem.getAttribute("class");
    if (!classAttr) {
        return false;
    }
    const classes = classAttr.split(" ");
    for (const clazz of classes) {
        if (clazz === className) {
            // if (isDEBUG_VISUALS(documant)) {
            //     debug(`XMLDOM - classListContains TRUE: ${className}`);
            // }
            return true;
        }
    }
    return false;
}
function classListAdd(this: any, className: string) {
    const style = this;
    const elem = style.element;

    // if (isDEBUG_VISUALS(documant)) {
    //     debug(`XMLDOM - classListAdd: ${className}`);
    // }

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

    // if (isDEBUG_VISUALS(documant)) {
    //     debug(`XMLDOM - classListRemove: ${className}`);
    // }

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

export function transformHTML(
    htmlStr: string,
    readiumcssJson: IEventPayload_R2_EVENT_READIUMCSS | undefined,
    mediaType: string | undefined): string {

    // debug(mediaType);
    // debug(htmlStr);

    // let's remove the DOCTYPE (which can contain entities)
    // let's replace the body with empty txt (we only need the body start tag, not the element contents)

    const iHtmlStart = htmlStr.indexOf("<html");
    if (iHtmlStart < 0) {
        return htmlStr;
    }
    const iBodyStart = htmlStr.indexOf("<body");
    if (iBodyStart < 0) {
        return htmlStr;
    }
    const iBodyEnd = htmlStr.indexOf(">", iBodyStart);
    if (iBodyEnd <= 0) {
        return htmlStr;
    }

    const parseableChunk = htmlStr.substr(iHtmlStart, iBodyEnd - iHtmlStart + 1);
    // debug(chunk);
    const htmlStrToParse = `<?xml version="1.0" encoding="utf-8"?>${parseableChunk}TXT</body></html>`;
    // debug(htmlStrToParse);

    // import * as xmldom from "xmldom";
    const documant = typeof mediaType === "string" ?
        new xmldom.DOMParser().parseFromString(htmlStrToParse, mediaType) :
        new xmldom.DOMParser().parseFromString(htmlStrToParse);

    documant.documentElement.setAttribute("data-readiumcss-injected", "yes");

    // import * as parse5 from "parse5";
    // const documant = parse5.parse(htmlStrToParse);

    // debug(documant.doctype);

    if (!documant.head) {
        definePropertyGetterSetter_DocHeadBody(documant, "head");
    }
    if (!documant.body) {
        definePropertyGetterSetter_DocHeadBody(documant, "body");
    }
    if (!documant.documentElement.style) {
        definePropertyGetterSetter_ElementStyle(documant.documentElement);
    }
    if (!documant.body.style) {
        definePropertyGetterSetter_ElementStyle(documant.body);
    }
    if (!documant.documentElement.classList) {
        definePropertyGetterSetter_ElementClassList(documant.documentElement);
    }

    // const wh = configureFixedLayout(doc, win.READIUM2.isFixedLayout,
    //     win.READIUM2.fxlViewportWidth, win.READIUM2.fxlViewportHeight,
    //     win.innerWidth, win.innerHeight);
    // if (wh) {
    //     win.READIUM2.fxlViewportWidth = wh.width;
    //     win.READIUM2.fxlViewportHeight = wh.height;
    // }

    const rtl = isDocRTL(documant);
    const vertical = isDocVertical(documant);
    if (readiumcssJson) {
        readiumCSSSet(documant, readiumcssJson,
            undefined, // urlRootReadiumCSS
            vertical,
            rtl);
    }

    injectDefaultCSS(documant);
    if (IS_DEV) { // isDEBUG_VISUALS(documant)
        injectReadPosCSS(documant);
    }

    // import * as xmldom from "xmldom";
    const serialized = new xmldom.XMLSerializer().serializeToString(documant);
    // debug("serialized:");
    // debug(serialized);

    // import * as parse5 from "parse5";
    // const newStr = parse5.serialize(documant);

    const prefix = htmlStr.substr(0, iHtmlStart);
    // debug("prefix:");
    // debug(prefix);
    const suffix = htmlStr.substr(iBodyEnd + 1);
    // debug("suffix:");
    // debug(suffix);

    const iHtmlStart_ = serialized.indexOf("<html");
    if (iHtmlStart_ < 0) {
        return htmlStr;
    }
    const iBodyStart_ = serialized.indexOf("<body");
    if (iBodyStart_ < 0) {
        return htmlStr;
    }
    const iBodyEnd_ = serialized.indexOf(">", iBodyStart_);
    if (iBodyEnd_ <= 0) {
        return htmlStr;
    }

    const middle = serialized.substr(iHtmlStart_, iBodyEnd_ - iHtmlStart_ + 1);
    // debug("chunk_:");
    // debug(chunk_);
    const newStr = `${prefix}${middle}${suffix}`;
    // debug("newStr:");
    // debug(newStr);
    return newStr;
}
