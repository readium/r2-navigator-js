// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debounce from "debounce";
import { IEventPayload_R2_EVENT_READIUMCSS } from "../../common/events";
import {
    isDocRTL, isDocVertical, isPaginated, readiumCSSSet,
} from "../../common/readium-css-inject";
import { EXTRA_COLUMN_PAD_ID, FOOTNOTE_FORCE_SHOW, POPUP_DIALOG_CLASS, ROOT_CLASS_NO_FOOTNOTES } from "../../common/styles";
import { ReadiumElectronWebviewWindow } from "./state";

import {
    POPOUTIMAGE_CONTAINER_ID, R2_MO_CLASS_PAUSED, R2_MO_CLASS_PLAYING, TTS_CLASS_PAUSED, TTS_CLASS_PLAYING,
} from "../../common/styles";

import { SKIP_LINK_ID, ID_HIGHLIGHTS_CONTAINER } from "../../common/styles";

const win = global.window as ReadiumElectronWebviewWindow;

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

export const clearImageZoomOutlineDebounced = debounce(() => {
    if (win.document.documentElement.classList.contains(R2_MO_CLASS_PAUSED) ||
        win.document.documentElement.classList.contains(R2_MO_CLASS_PLAYING) ||
        win.READIUM2.ttsClickEnabled ||
        win.document.documentElement.classList.contains(TTS_CLASS_PAUSED) ||
        win.document.documentElement.classList.contains(TTS_CLASS_PLAYING)) {
        clearImageZoomOutline();
    }
}, 200);
export const clearImageZoomOutline = () => {
    const imgs = win.document.querySelectorAll(`img[data-${POPOUTIMAGE_CONTAINER_ID}]`);
    imgs.forEach((img) => {
        img.removeAttribute(`data-${POPOUTIMAGE_CONTAINER_ID}`);
    });
    const images = win.document.querySelectorAll(`image[data-${POPOUTIMAGE_CONTAINER_ID}]`);
    images.forEach((img) => {
        img.removeAttribute(`data-${POPOUTIMAGE_CONTAINER_ID}`);
    });
    const svgs = win.document.querySelectorAll(`svg[data-${POPOUTIMAGE_CONTAINER_ID}]`);
    svgs.forEach((svg) => {
        svg.removeAttribute(`data-${POPOUTIMAGE_CONTAINER_ID}`);
    });
};

export const getScrollingElement = (documant: Document): Element => {
    if (documant.scrollingElement) {
        return documant.scrollingElement;
    }
    return documant.body;

    // console.log(process.versions);
    // --
    // electron: '1.8.8'
    // chrome: '59.0.3071.115'
    // ---
    // electron: '4.1.3'
    // chrome: '69.0.3497.128'
    // ===
    // const isBody = win.document.scrollingElement === win.document.body;
    // console.log(isBody); // Electron V1: true, V4: false
    // const isHTML = win.document.scrollingElement === win.document.documentElement;
    // console.log(isHTML); // Electron V1: false, V4: true
};

const calculateDocumentColumnizedWidthAdjustedForTwoPageSpread = (): number => {

    if (!win || !win.document || !win.document.body || !win.document.documentElement) {
        return 0;
    }
    const scrollElement = getScrollingElement(win.document);

    let w = scrollElement.scrollWidth;
    const noChange = !isPaginated(win.document) || !isTwoPageSpread() ||
        isVerticalWritingMode(); // TODO: VWM?
    if (!noChange) {
        const columnizedDocWidth = w;
        // console.log(`columnizedDocWidth: ${columnizedDocWidth}`);

        const twoColWidth = win.document.documentElement.offsetWidth;
        // console.log(`twoColWidth: ${twoColWidth}`);

        const nSpreads = columnizedDocWidth / twoColWidth;
        // console.log(`nSpreads: ${nSpreads}`);

        const nWholeSpread = Math.floor(nSpreads);
        // console.log(`nWholeSpread: ${nWholeSpread}`);

        const fractionalSpread = nSpreads - nWholeSpread;
        // console.log(`fractionalSpread: ${fractionalSpread}`);

        if (fractionalSpread > 0 && (Math.round(fractionalSpread * 10) / 10) <= 0.5) {
            w = twoColWidth * Math.ceil(nSpreads);
            // tslint:disable-next-line
            // console.log(`wDIFF: ${scrollElement.scrollWidth} => ${w} (${w - scrollElement.scrollWidth} -- ${twoColWidth / 2})`);
        }
    }
    return w;
};

export const calculateMaxScrollShift = ():
    { maxScrollShift: number, maxScrollShiftAdjusted: number } => {

    if (!win || !win.document || !win.document.body || !win.document.documentElement) {
        return { maxScrollShift: 0, maxScrollShiftAdjusted: 0 };
    }

    const isPaged = isPaginated(win.document);

    const scrollElement = getScrollingElement(win.document);

    const vwm = isVerticalWritingMode();

    const maxScrollShift = isPaged ?
        ((vwm ?
            (scrollElement.scrollHeight - win.document.documentElement.offsetHeight) :
            (scrollElement.scrollWidth - win.document.documentElement.offsetWidth))) :
        ((vwm ?
            (scrollElement.scrollWidth - win.document.documentElement.clientWidth) :
            (scrollElement.scrollHeight - win.document.documentElement.clientHeight)));

    const maxScrollShiftAdjusted = isPaged ?
        ((vwm ?
            maxScrollShift :
            (calculateDocumentColumnizedWidthAdjustedForTwoPageSpread() - win.document.documentElement.offsetWidth))) :
        ((vwm ?
            maxScrollShift :
            maxScrollShift));

    return { maxScrollShift, maxScrollShiftAdjusted };
};

// when increasing font size with ReadiumCSS columns=auto ==> auto switch to single column (visually) but column count still 2 (col width dictates)
export const isTwoPageSpread = (): boolean => {

    if (!win || !win.document || !win.document.documentElement || !win.document.body) {
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
    const scrollElement = getScrollingElement(win.document);
    const bodyComputedStyle = win.getComputedStyle(win.document.body);
    const bodyWidth = parseInt(bodyComputedStyle.width, 10);
    let paginatedTwo = docColumnCount === 2;
    if (paginatedTwo && (bodyWidth * 2) > scrollElement.clientWidth) {
        paginatedTwo = false;
    }
    if (docColumnCount && isNaN(docColumnCount) // "auto"?
        && (bodyWidth * 2) <= (scrollElement.clientWidth + 10)) {
        paginatedTwo = true;
    }
    return paginatedTwo;
};

export const calculateTotalColumns = (): number => {
    if (!win || !win.document || !win.document.body || !isPaginated(win.document)) {
        return 0;
    }

    const scrollElement = getScrollingElement(win.document);

    let totalColumns = 0;
    if (isVerticalWritingMode()) {
        totalColumns = Math.ceil(win.document.body.offsetWidth / scrollElement.scrollWidth);
    } else {
        totalColumns = Math.ceil(win.document.body.offsetHeight / scrollElement.scrollHeight);
    }
    return totalColumns;
};
export function calculateColumnDimension(): number {
    if (!win.document || !win.document.documentElement || !win.document.body || !isPaginated(win.document)) {
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

let _isVerticalWritingMode = false;
export function isVerticalWritingMode(): boolean {
    return _isVerticalWritingMode;
}

let _isRTL = false;
export function isRTL(): boolean {
    return _isRTL;
}

// TODO? page-progression-direction
// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS16-internationalization.md
// tslint:disable-next-line:max-line-length
// https://github.com/readium/readium-css/blob/develop/docs/CSS12-user_prefs.md#user-settings-can-be-language-specific
// https://developer.mozilla.org/en-US/docs/Web/CSS/writing-mode
export function computeVerticalRTL() {

    if (!win.document || !win.document.documentElement) {
        return;
    }

    let rtl = isDocRTL(win.document);
    let vertical = isDocVertical(win.document);

    const htmlStyle = win.getComputedStyle(win.document.documentElement);
    if (htmlStyle) {
        let prop = htmlStyle.getPropertyValue("direction");
        if (prop && prop.indexOf("rtl") >= 0) {
            rtl = true;
        }
        prop = htmlStyle.getPropertyValue("writing-mode");
        if (!prop) {
            prop = htmlStyle.getPropertyValue("-epub-writing-mode");
        }
        if (prop && prop.indexOf("vertical") >= 0) {
            vertical = true;
        }
        if (prop && prop.indexOf("-rl") > 0) { // overrides direction above!
            rtl = true;
        }
    }
    if (win.document.body) {
        const bodyStyle = win.getComputedStyle(win.document.body);
        if (bodyStyle) {
            let prop = bodyStyle.getPropertyValue("direction");
            if (prop && prop.indexOf("rtl") >= 0) {
                rtl = true;
            }
            prop = bodyStyle.getPropertyValue("writing-mode");
            if (!prop) {
                prop = bodyStyle.getPropertyValue("-epub-writing-mode");
            }
            if (prop && prop.indexOf("vertical") >= 0) {
                vertical = true;
            }
            if (prop && prop.indexOf("-rl") > 0) { // overrides direction above!
                rtl = true;
            }
        }
        let singleChild: Element | undefined;
        let childEl = win.document.body.firstElementChild;
        while (childEl) {
            if (singleChild) {
                singleChild = undefined;
                break;
            }
            const id = childEl.id || childEl.getAttribute("id");
            if (id === SKIP_LINK_ID || id === ID_HIGHLIGHTS_CONTAINER || id === EXTRA_COLUMN_PAD_ID || id === POPUP_DIALOG_CLASS) {
                continue;
            }
            singleChild = childEl;
            childEl = childEl.nextElementSibling;
        }
        if (singleChild) {
            const singleChildStyle = win.getComputedStyle(singleChild);
            if (singleChildStyle) {
                let prop = singleChildStyle.getPropertyValue("direction");
                if (prop && prop.indexOf("rtl") >= 0) {
                    rtl = true;
                }
                prop = singleChildStyle.getPropertyValue("writing-mode");
                if (!prop) {
                    prop = singleChildStyle.getPropertyValue("-epub-writing-mode");
                }
                if (prop && prop.indexOf("vertical") >= 0) {
                    vertical = true;
                }
                if (prop && prop.indexOf("-rl") > 0) { // overrides direction above!
                    rtl = true;
                }
            }
        }
    }

    _isVerticalWritingMode = vertical;
    _isRTL = rtl;
}

export function checkHiddenFootNotes(documant: Document) {
    if (documant.documentElement.classList.contains(ROOT_CLASS_NO_FOOTNOTES)) {
        return;
    }

    if (!documant.querySelectorAll) { // TODO: polyfill querySelector[All]() ?
        return; // when streamer-injected
    }

    const aNodeList = documant.querySelectorAll("a[href]");

    documant.querySelectorAll("aside").forEach((aside) => {
        let id = aside.getAttribute("id");
        if (!id) {
            return;
        }
        id = "#" + id;

        let epubType = aside.getAttribute("epub:type");
        if (!epubType) {
            epubType = aside.getAttributeNS("http://www.idpf.org/2007/ops", "type");
            if (!epubType) {
                epubType = aside.getAttribute("role");
            }
        }
        if (!epubType) {
            return;
        }

        epubType = epubType.trim().replace(/\s\s+/g, " "); // whitespace collapse

        const isPotentiallyHiddenNote =
            epubType.indexOf("note") >= 0 // this covers all of below (and more!) ... TODO: smarter regexp?
            // epubType.indexOf("footnote") >= 0 ||
            // epubType.indexOf("endnote") >= 0 ||
            // epubType.indexOf("rearnote") >= 0 ||

            // epubType.indexOf("doc-note") >= 0
            // epubType.indexOf("doc-footnote") >= 0 ||
            // epubType.indexOf("doc-endnote") >= 0 ||
            // epubType.indexOf("doc-rearnote") >= 0 ||
        ;

        if (!isPotentiallyHiddenNote) {
            return;
        }

        let found = false;
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < aNodeList.length; i++) {
            const aNode = aNodeList[i];
            const href = aNode.getAttribute("href");
            if (!href) {
                continue;
            }
            // try {
            //     const hash = new URL(href).hash; // includes #
            //     if (hash === id) {
            //         found = true;
            //         break;
            //     }
            // } catch (err) {
            //     debug(href);
            //     debug(err);
            //     continue;
            // }
            const iHash = href.indexOf("#");
            if (iHash < 0) { // includes "#ID" (as opposed to "file.xhtml#ID")
                continue;
            }

            // TODO? (edge case) link to external HTML document fragment (not this "documant")
            // with _exact_ same #ID => leaves note content hidden instead of forcing it to show!
            // e.g. win.location.herf == chapter1.html
            //      a@href == chapter2.html#id1
            //      ==> aside#id1 in chapter1.html remains hidden
            //          even though it may in fact not be linked from chapter1.html

            // href.substring(0, iHash)
            if (href.substring(iHash) === id) { // TODO: does not account for ?query-params
                found = true;
                break;
            }
        }
        if (!found) {
            aside.classList.add(FOOTNOTE_FORCE_SHOW);
        }
    });
}

export const readiumCSS = (documant: Document, messageJson: IEventPayload_R2_EVENT_READIUMCSS) => {

    if (IS_DEV) {
        console.log("_____ readiumCssJson.urlRoot (readiumCSS()): ", messageJson.urlRoot);
    }

    readiumCSSSet(documant, messageJson, _isVerticalWritingMode, _isRTL);

    if ((messageJson && messageJson.setCSS && !messageJson.setCSS.noFootnotes)) {
        checkHiddenFootNotes(documant);
    }
};

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
