// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as xmldom from "xmldom";

import {
    focusCssStyles,
    readPosCssStyles,
    scrollBarCssStyles,
    selectionCssStyles,
    targetCssStyles,
} from "../renderer/webview/styles";
import {
    IEventPayload_R2_EVENT_READIUMCSS,
} from "./events";
import { READIUM_CSS_URL_PATH } from "./readium-css-settings";

export const DEBUG_VISUALS = false;

// TODO DARK THEME
const CSS_CLASS_DARK_THEME = "mdc-theme--dark";

// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS16-internationalization.md
// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS12-user_prefs.md#user-settings-can-be-language-specific

export function isDocVertical(document: Document): boolean {
    if (!document || !document.documentElement) {
        return false;
    }

    // let vertical = false;

    // let langAttr = document.documentElement.getAttribute("lang");
    // if (!langAttr) {
    //     langAttr = document.documentElement.getAttribute("xml:lang");
    // }
    // if (!langAttr) {
    //     langAttr = document.documentElement.getAttributeNS("http://www.w3.org/XML/1998/", "lang");
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

export function isDocRTL(document: Document): boolean {
    if (!document || !document.documentElement) {
        return false;
    }

    let rtl = false;

    let foundDir = false;

    let dirAttr = document.documentElement.getAttribute("dir");
    if (dirAttr === "rtl") {
        foundDir = true;
        rtl = true;
    }
    if (!rtl && document.body) {
        dirAttr = document.body.getAttribute("dir");
        if (dirAttr === "rtl") {
            foundDir = true;
            rtl = true;
        }
    }

    // let foundLang = false;

    if (!rtl) {
        let langAttr = document.documentElement.getAttribute("lang");
        if (!langAttr) {
            langAttr = document.documentElement.getAttribute("xml:lang");
        }
        if (!langAttr) {
            langAttr = document.documentElement.getAttributeNS("http://www.w3.org/XML/1998/", "lang");
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
            document.documentElement.setAttribute("dir", "rtl");
        }
        // really?
        // if (!foundLang) {
        //     document.documentElement.setAttribute("lang", "ar");
        //     // document.documentElement.setAttributeNS("http://www.w3.org/XML/1998/", "lang", "ar");
        //     document.documentElement.setAttribute("xml:lang", "ar");
        // }
    }
    return rtl;
}

export function isPaginated(document: Document): boolean {
    return document && document.documentElement &&
        document.documentElement.classList.contains("readium-paginated");
}

// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS12-user_prefs.md
// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/ReadiumCSS-user_variables.css
// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS19-api.md#user-settings
export function readiumCSSSet(
    document: Document,
    messageJson: IEventPayload_R2_EVENT_READIUMCSS,
    urlRootReadiumCSS: string | undefined,
    isVerticalWritingMode: boolean, isRTL: boolean) {

    if (!messageJson) {
        return;
    }

    if (!document || !document.documentElement) {
        return;
    }

    const docElement = document.documentElement;

    if (!messageJson.setCSS) {

        docElement.removeAttribute("data-readiumcss");
        removeAllCSS(document);
        // removeAllCSSInline(document);

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

        // Not in XMLDOM :(
        // if (document.head && document.head.childElementCount) {
        //     let elem = document.head.firstElementChild;
        //     while (elem) {
        //         // ...
        //         elem = elem.nextElementSibling;
        //     }
        // }
        if (document.head && document.head.childNodes && document.head.childNodes.length) {
            // tslint:disable-next-line: prefer-for-of
            for (let i = 0; i < document.head.childNodes.length; i++) {
                const child = document.head.childNodes[i];
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

        if (needsDefaultCSS && document.body) {
            // Not in XMLDOM :(
            // querySelector("*[style]");
            const styleAttr = document.body.getAttribute("style");
            if (styleAttr) {
                needsDefaultCSS = false;
            }
        }

        const urlRoot = messageJson.urlRoot ?
            (messageJson.urlRoot + "/" + READIUM_CSS_URL_PATH + "/") :
            (urlRootReadiumCSS ? urlRootReadiumCSS : ("/" + READIUM_CSS_URL_PATH + "/"));

        appendCSS(document, "before", urlRoot);
        if (needsDefaultCSS) {
            appendCSS(document, "default", urlRoot);
        }
        appendCSS(document, "after", urlRoot);
    }

    const setCSS = messageJson.setCSS;

    if (DEBUG_VISUALS) {
        console.log("---- setCSS -----");
        console.log(setCSS);
        console.log("-----");
    }

    if (setCSS.night) {
        // document.body
        docElement.classList.add(CSS_CLASS_DARK_THEME);
    } else {
        // document.body
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
}
export function configureFixedLayout(
        document: Document,
        isFixedLayout: boolean,
        fxlViewportWidth: number, fxlViewportHeight: number,
        innerWidth: number, innerHeight: number): IwidthHeight | undefined {

    if (!document || !document.head || !document.body) {
        return undefined;
    }

    let wh: IwidthHeight | undefined;

    let width: number = fxlViewportWidth;
    let height: number = fxlViewportHeight;

    if (!width || !height) {
        let metaViewport: Element | null = null;
        // Not in XMLDOM :(
        if (document.head.querySelector) {
            metaViewport = document.head.querySelector("meta[name=viewport]");
        } else {
            if (document.head.childNodes && document.head.childNodes.length) {
                // tslint:disable-next-line: prefer-for-of
                for (let i = 0; i < document.head.childNodes.length; i++) {
                    const child = document.head.childNodes[i];
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
            console.log("configureFixedLayout NO meta[name=viewport]");
            return undefined;
        }
        const attr = metaViewport.getAttribute("content");
        if (!attr) {
            console.log("configureFixedLayout NO meta[name=viewport && content]");
            return undefined;
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

            wh = {
                height,
                width,
            };
        }
    }

    if (innerWidth && innerHeight && width && height && isFixedLayout
        && document && document.documentElement && document.body) {
        document.documentElement.style.overflow = "hidden";

        // Many FXL EPUBs lack the body dimensions (only viewport meta)
        document.body.style.width = width + "px";
        document.body.style.height = height + "px";
        document.body.style.overflow = "hidden";
        document.body.style.margin = "0"; // 8px by default!

        console.log("FXL width: " + width);
        console.log("FXL height: " + height);

        const visibleWidth = innerWidth;
        const visibleHeight = innerHeight;
        console.log("FXL visible width: " + visibleWidth);
        console.log("FXL visible height: " + visibleHeight);

        const ratioX = visibleWidth / width;
        const ratioY = visibleHeight / height;
        const ratio = Math.min(ratioX, ratioY);

        const tx = (visibleWidth - (width * ratio)) / 2;
        const ty = (visibleHeight - (height * ratio)) / 2;
        console.log("FXL trans X: " + tx);
        console.log("FXL trans Y: " + ty);

        document.documentElement.style.transformOrigin = "0 0";
        document.documentElement.style.transform = `translateX(${tx}px) translateY(${ty}px) scale(${ratio})`;
    }

    return wh;
}

export function ensureHead(document: Document) {

    if (!document || !document.documentElement) {
        return;
    }

    const docElement = document.documentElement;

    if (!document.head) {
        const headElement = document.createElement("head");
        if (document.body) {
            docElement.insertBefore(headElement, document.body);
        } else {
            docElement.appendChild(headElement);
        }
    }
}

export function appendCSSInline(document: Document, id: string, css: string) {
    ensureHead(document);

    if (!document || !document.head) {
        return;
    }

    const styleElement = document.createElement("style");
    styleElement.setAttribute("id", "Readium2-" + id);
    styleElement.setAttribute("type", "text/css");
    styleElement.appendChild(document.createTextNode(css));
    document.head.appendChild(styleElement);
}

// unused (for now)
// export function removeCSSInline(document: Document, id: string) {
//     const styleElement = document.getElementById("Readium2-" + id);
//     if (styleElement && styleElement.parentNode) {
//         styleElement.parentNode.removeChild(styleElement);
//     }
// }

export function appendCSS(document: Document, mod: string, urlRoot: string) {
    ensureHead(document);

    if (!document || !document.head) {
        return;
    }

    const linkElement = document.createElement("link");
    linkElement.setAttribute("id", "ReadiumCSS-" + mod);
    linkElement.setAttribute("rel", "stylesheet");
    linkElement.setAttribute("type", "text/css");
    linkElement.setAttribute("href", urlRoot + "ReadiumCSS-" + mod + ".css");

    // Not in XMLDOM :(
    let childElementCount = 0;
    let firstElementChild: Element | null = null;
    if (typeof document.head.childElementCount !== "undefined") {
        childElementCount = document.head.childElementCount;
        firstElementChild = document.head.firstElementChild;
    } else {
        if (document.head && document.head.childNodes && document.head.childNodes.length) {
            // tslint:disable-next-line: prefer-for-of
            for (let i = 0; i < document.head.childNodes.length; i++) {
                const child = document.head.childNodes[i];
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
        document.head.insertBefore(linkElement, firstElementChild);
    } else {
        document.head.appendChild(linkElement);
    }
}

export function removeCSS(document: Document, mod: string) {
    const linkElement = document.getElementById("ReadiumCSS-" + mod);
    if (linkElement && linkElement.parentNode) {
        linkElement.parentNode.removeChild(linkElement);
    }
}

// export function removeAllCSSInline(_document: Document) {
//     // removeCSSInline("electron-selection");
//     // removeCSSInline("electron-focus");
//     // removeCSSInline("electron-scrollbars");
// }

export function removeAllCSS(document: Document) {
    removeCSS(document, "before");
    removeCSS(document, "after");
    // removeCSS("base");
    // removeCSS("html5patch");
    // removeCSS("safeguards");
    removeCSS(document, "default");
    // removeCSS("highlights");
    // removeCSS("scroll");
    // removeCSS("pagination");
    // removeCSS("night_mode");
    // removeCSS("pagination");
    // removeCSS("os_a11y");
    // removeCSS("user_settings");
    // removeCSS("fs_normalize");
}

export function injectDefaultCSS(document: Document) {
    appendCSSInline(document, "electron-selection", selectionCssStyles);
    appendCSSInline(document, "electron-focus", focusCssStyles);
    appendCSSInline(document, "electron-target", targetCssStyles);
    appendCSSInline(document, "electron-scrollbars", scrollBarCssStyles);
}

export function injectReadPosCSS(document: Document) {
    // if (!DEBUG_VISUALS) {
    //     return;
    // }
    appendCSSInline(document, "electron-readPos", readPosCssStyles);
}

// export function injectResizeSensor(document: Document, urlResizeSensor: string) {
//     ensureHead(document);
//     const scriptElement = document.createElement("script");
//     scriptElement.setAttribute("id", "Readium2-ResizeSensor");
//     scriptElement.setAttribute("type", "application/javascript");
//     scriptElement.setAttribute("src", urlResizeSensor);
//     scriptElement.appendChild(document.createTextNode(" "));
//     document.head.appendChild(scriptElement);
//     scriptElement.addEventListener("load", () => {
//         console.log("ResizeSensor LOADED");
//     });
// };

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
                    if (child.nodeType === 1) { // Node.ELEMENT_NODE
                        const element = child as Element;
                        if (element.localName && element.localName.toLowerCase() === elementName) {
                            (doc as any)[key] = element; // cache
                            if (DEBUG_VISUALS) {
                                console.log(`XMLDOM - cached document.${elementName}`);
                            }
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
    if (DEBUG_VISUALS) {
        console.log(`XMLDOM - cssStyleItem: ${i}`);
    }
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
                    if (DEBUG_VISUALS) {
                        console.log(`XMLDOM - cssStyleItem: ${i} => ${regexMatch[1]}`);
                    }
                    return regexMatch[1];
                }
            }
        }
    }
    return undefined;
}
function cssStyleGet(cssProperty: string, elem: Element): string | undefined {
    if (DEBUG_VISUALS) {
        console.log(`XMLDOM - cssStyleGet: ${cssProperty}`);
    }

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
            if (DEBUG_VISUALS) {
                console.log(`XMLDOM - cssStyleGet: ${cssProperty} => ${cssPropertyValue}`);
            }
            break;
        }
    }
    return cssPropertyValue ? cssPropertyValue : undefined;
}
function cssStyleSet(cssProperty: string, val: string | undefined, elem: Element) {
    if (DEBUG_VISUALS) {
        console.log(`XMLDOM - cssStyleSet: ${cssProperty}: ${val};`);
    }

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

            if (DEBUG_VISUALS) {
                console.log(`XMLDOM - style.length`);
            }

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
            if (DEBUG_VISUALS) {
                console.log(`XMLDOM - style.length: ${count}`);
            }
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
    if (DEBUG_VISUALS) {
        console.log(`XMLDOM - classListContains: ${className}`);
    }

    const classAttr = elem.getAttribute("class");
    if (!classAttr) {
        return false;
    }
    const classes = classAttr.split(" ");
    for (const clazz of classes) {
        if (clazz === className) {
            if (DEBUG_VISUALS) {
                console.log(`XMLDOM - classListContains TRUE: ${className}`);
            }
            return true;
        }
    }
    return false;
}
function classListAdd(this: any, className: string) {
    const style = this;
    const elem = style.element;

    if (DEBUG_VISUALS) {
        console.log(`XMLDOM - classListAdd: ${className}`);
    }

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

    if (DEBUG_VISUALS) {
        console.log(`XMLDOM - classListRemove: ${className}`);
    }

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

    const doc = typeof mediaType === "string" ?
        new xmldom.DOMParser().parseFromString(htmlStr, mediaType) :
        new xmldom.DOMParser().parseFromString(htmlStr);

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

    // const wh = configureFixedLayout(doc, win.READIUM2.isFixedLayout,
    //     win.READIUM2.fxlViewportWidth, win.READIUM2.fxlViewportHeight,
    //     win.innerWidth, win.innerHeight);
    // if (wh) {
    //     win.READIUM2.fxlViewportWidth = wh.width;
    //     win.READIUM2.fxlViewportHeight = wh.height;
    // }

    injectDefaultCSS(doc);
    if (DEBUG_VISUALS) {
        injectReadPosCSS(doc);
    }

    const rtl = isDocRTL(doc);
    const vertical = isDocVertical(doc);
    if (readiumcssJson) {
        readiumCSSSet(doc, readiumcssJson,
            undefined, // urlRootReadiumCSS
            vertical,
            rtl);
    }

    return new xmldom.XMLSerializer().serializeToString(doc);
}
