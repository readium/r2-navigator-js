import { ipcRenderer } from "electron";

import {
    IEventPayload_R2_EVENT_READIUMCSS,
    R2_EVENT_READIUMCSS,
} from "../../common/events";
import { IElectronWebviewTagWindow } from "./state";

import { focusCssStyles, readPosCssStyles, scrollBarCssStyles, selectionCssStyles } from "./styles";

import {
    READIUM2_ELECTRON_HTTP_PROTOCOL,
    convertCustomSchemeToHttpUrl,
} from "../../common/sessions";

const win = (global as any).window as IElectronWebviewTagWindow;

// TODO DARK THEME
const CSS_CLASS_DARK_THEME = "mdc-theme--dark";

// TODO: extract the const string "readium-css"
// (also used in electron/main/readium-css.ts)
let origin = win.location.origin;
if (origin.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://")) {
    origin = convertCustomSchemeToHttpUrl(origin);
    origin = origin.replace(/\/pub\/.*/, "");
}
const urlRootReadiumCSS = origin + "/readium-css/";
console.log(urlRootReadiumCSS);
// const urlResizeSensor = win.location.origin + "/resize-sensor.js";

export const DEBUG_VISUALS = false;

export const configureFixedLayout = (isFixedLayout: boolean) => {
    if (!win.document || !win.document.head || !win.document.body) {
        console.log("configureFixedLayout !win.document || !win.document.head || !win.document.body");
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

    if (width && height && isFixedLayout) {
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

// TODO? page-progression-direction
// TODO? xml:lang ar, fa, he ==> RTL, ensure html@xml:lang and html@dir (if missing)
// TODO? xml:lang zh, ja, ko ==> horizontal, ensure html@xml:lang (if missing)
// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/prototype/iOS-implem/dist/ReadMe.md#dealing-with-languagesscripts
function computeVerticalRTL() {

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

    const htmlStyle = window.getComputedStyle(win.document.documentElement);
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
        const bodyStyle = window.getComputedStyle(win.document.body);
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
    // console.log("R-CSS WIN LOAD");

    computeVerticalRTL();
});

const ensureHead = () => {
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

function readiumCSSInject(messageJson: IEventPayload_R2_EVENT_READIUMCSS) {

    if (typeof messageJson.injectCSS === "undefined") {
        return;
    }

    const docElement = win.document.documentElement;
    ensureHead();

    const remove = (typeof messageJson.injectCSS === "string" && messageJson.injectCSS.indexOf("rollback") >= 0)
        || !messageJson.injectCSS;

    if (remove) {
        docElement.removeAttribute("data-readiumcss");
        removeAllCSS();
        removeAllCSSInline();
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

        // appendCSS("base");
        // appendCSS("html5patch");
        // appendCSS("safeguards");
        // appendCSS("default");
        // appendCSS("highlights");
        // if (messageJson.injectCSS.indexOf("scroll") >= 0) {
        //     appendCSS("scroll");
        // } else {
        //     appendCSS("pagination");
        // }
        // if (messageJson.injectCSS.indexOf("night_mode") >= 0) {
        //     appendCSS("night_mode");
        // } else if (messageJson.injectCSS.indexOf("sepia_mode") >= 0) {
        //     appendCSS("pagination");
        // }
        // appendCSS("os_a11y");
        // appendCSS("user_settings");
        // if (messageJson.injectCSS.indexOf("fs_normalize") >= 0) {
        //     appendCSS("fs_normalize");
        // }

        appendCSS("before");
        if (needsDefaultCSS) {
            appendCSS("default");
        }
        appendCSS("after");
    }
}

function readiumCSSSet(messageJson: IEventPayload_R2_EVENT_READIUMCSS) {
    if (!messageJson || typeof messageJson.setCSS === "undefined") {
        return;
    }

    const docElement = win.document.documentElement;

    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/readium-css/tree/develop/prototype/iOS-implem#manage-user-settings
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/readium-css/blob/develop/prototype/iOS-implem/Specific-docs/CSS12-api.md#user-settings
    // tslint:disable-next-line:max-line-length
    // https://github.com/readium/readium-css/blob/develop/prototype/iOS-implem/Specific-docs/CSS09-user_prefs.md#switches

    const remove = (typeof messageJson.setCSS === "string" && messageJson.setCSS.indexOf("rollback") >= 0)
        || !messageJson.setCSS;
    if (remove) {

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
    } else {
        let dark = false;
        let night = false;
        let sepia = false;
        let invert = false;
        let paged = false;
        let font: string | undefined;
        let fontSize: string | undefined;
        let lineHeight: string | undefined;
        let colCount: string | undefined;
        let align: string | undefined;
        if (typeof messageJson.setCSS === "object") {
            if (messageJson.setCSS.dark) {
                dark = true;
            }
            if (messageJson.setCSS.night) {
                night = true;
            }
            if (messageJson.setCSS.sepia) {
                sepia = true;
            }
            if (messageJson.setCSS.invert) {
                invert = true;
            }
            if (messageJson.setCSS.paged) {
                paged = true;
            }
            if (typeof messageJson.setCSS.font === "string") {
                font = messageJson.setCSS.font;
            }
            if (typeof messageJson.setCSS.fontSize === "string") {
                fontSize = messageJson.setCSS.fontSize;
            }
            if (typeof messageJson.setCSS.lineHeight === "string") {
                lineHeight = messageJson.setCSS.lineHeight;
            }
            if (typeof messageJson.setCSS.colCount === "string") {
                colCount = messageJson.setCSS.colCount;
            }
            if (typeof messageJson.setCSS.align === "string") {
                align = messageJson.setCSS.align;
            }
        }

        if (night) {
            // win.document.body
            docElement.classList.add(CSS_CLASS_DARK_THEME);
        } else {
            // win.document.body
            docElement.classList.remove(CSS_CLASS_DARK_THEME);
        }

        const needsAdvanced = true; // dark || invert;

        // readium-advanced-on | readium-advanced-off
        docElement.style.setProperty("--USER__advancedSettings",
            needsAdvanced ? "readium-advanced-on" : "readium-advanced-off");

        // readium-darken-on | readium-darken-off
        docElement.style.setProperty("--USER__darkenFilter",
            dark ? "readium-darken-on" : "readium-darken-off");

        // readium-invert-on | readium-invert-off
        docElement.style.setProperty("--USER__invertFilter",
            invert ? "readium-invert-on" : "readium-invert-off");

        // readium-default-on | readium-sepia-on | readium-night-on
        docElement.style.setProperty("--USER__appearance",
            sepia ? "readium-sepia-on" : (night ? "readium-night-on" : "readium-default-on"));

        // readium-paged-on | readium-scroll-on
        docElement.style.setProperty("--USER__view",
            paged ? "readium-paged-on" : "readium-scroll-on");
        if (paged) {
            docElement.style.overflow = "hidden";
            docElement.classList.add("readium-paginated");
        } else {
            docElement.classList.remove("readium-paginated");
        }

        const needsFontOverride = typeof font !== "undefined" && font !== "DEFAULT";
        // readium-font-on | readium-font-off
        docElement.style.setProperty("--USER__fontOverride",
            needsFontOverride ? "readium-font-on" : "readium-font-off");

        // var(--RS__oldStyleTf) | var(--RS__modernTf) | var(--RS__sansTf) | var(--RS__humanistTf) | AccessibleDfa
        docElement.style.setProperty("--USER__fontFamily",
            !needsFontOverride ? "" :
                (font === "DYS" ? "AccessibleDfa" :
                    (font === "OLD" ? "var(--RS__oldStyleTf)" :
                        (font === "MODERN" ? "var(--RS__modernTf)" :
                            (font === "SANS" ? "var(--RS__sansTf)" :
                                (font === "HUMAN" ? "var(--RS__humanistTf)" :
                                    (font === "MONO" ? "var(--RS__monospaceTf)" :
                                        (font ? font : "var(--RS__oldStyleTf)")
                                    )
                                )
                            )
                        )
                    )
                ));

        // left (LTR) or right (RTL) | justify
        docElement.style.setProperty("--USER__textAlign",
            align === "justify" ? "justify" :
                (align === "right" ? "right" :
                    (align === "left" ? "left" :
                        (align === "center" ? "center" :
                            (align === "initial" ? "initial" : "inherit")
                        )
                    )
                ));

        // 75% | 87.5% | 100% | 112.5% | 137.5% | 150% | 162.5% | 175% | 200% | 225% | 250%
        docElement.style.setProperty("--USER__fontSize", fontSize ? fontSize : "100%");

        // 1 | 1.125 | 1.25 | 1.35 | 1.5 | 1.65 | 1.75 | 2
        docElement.style.setProperty("--USER__lineHeight", lineHeight ? lineHeight : "2");

        // 1 | 2 | auto
        docElement.style.setProperty("--USER__colCount", colCount ? colCount : "auto");

        // // auto | none
        // docElement.style.setProperty("--USER__bodyHyphens", "auto");

        // // 1 | 1.067 | 1.125 | 1.2 (suggested default) | 1.25 | 1.333 | 1.414 | 1.5 | 1.618
        // docElement.style.setProperty("--USER__typeScale", "1.2");

        // // 0 | 0.375rem | 0.75rem | 1rem | 1.125rem | 1.25rem | 1.35rem | 1.5rem | 1.65rem | 1.75rem | 2rem
        // docElement.style.setProperty("--USER__paraSpacing", "1rem");

        // // 0 | 0.5rem | 1rem | 1.25rem | 1.5rem | 2rem | 2.5rem | 3rem
        // docElement.style.setProperty("--USER__paraIndent", "1rem");

        // // 0.125rem | 0.25rem | 0.375rem | 0.5rem
        // docElement.style.setProperty("--USER__wordSpacing", "0.5rem");

        // // 0.0675rem | 0.125rem | 0.1875rem | 0.25rem
        // docElement.style.setProperty("--USER__letterSpacing", "0.1875rem");

        // // 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2
        // docElement.style.setProperty("--USER__pageMargins", "1.25");

        // docElement.style.setProperty("--USER__backgroundColor", "#FFFFFF");
        // docElement.style.setProperty("--USER__textColor", "#000000");

        // https://github.com/readium/readium-css/blob/develop/prototype/iOS-implem/dist/ReadMe.md#right-to-left
        // TODO? --USER__ligatures (for RTL)
    }
}

export const readiumCSS = (messageJson: IEventPayload_R2_EVENT_READIUMCSS) => {
    readiumCSSInject(messageJson);
    readiumCSSSet(messageJson);
};

function appendCSSInline(id: string, css: string) {
    ensureHead();

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

function appendCSS(mod: string) {
    ensureHead();

    const linkElement = win.document.createElement("link");
    linkElement.setAttribute("id", "ReadiumCSS-" + mod);
    linkElement.setAttribute("rel", "stylesheet");
    linkElement.setAttribute("type", "text/css");
    linkElement.setAttribute("href", urlRootReadiumCSS + "ReadiumCSS-" + mod + ".css");
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
