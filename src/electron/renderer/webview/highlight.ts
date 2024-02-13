// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as crypto from "crypto";
import * as debounce from "debounce";
import { ipcRenderer } from "electron";

import {
    IEventPayload_R2_EVENT_HIGHLIGHT_CLICK, R2_EVENT_HIGHLIGHT_CLICK,
} from "../../common/events";
import {
    HighlightDrawTypeStrikethrough, HighlightDrawTypeUnderline, IColor, IHighlight,
    IHighlightDefinition,
} from "../../common/highlight";
import { isPaginated } from "../../common/readium-css-inject";
import { ISelectionInfo } from "../../common/selection";
import { IRectSimple, getClientRectsNoOverlap_ } from "../common/rect-utils";
import { getScrollingElement, isVerticalWritingMode, isTwoPageSpread } from "./readium-css";
import { convertRangeInfo } from "./selection";
import { ReadiumElectronWebviewWindow } from "./state";

import { ID_HIGHLIGHTS_CONTAINER, CLASS_HIGHLIGHT_AREA, CLASS_HIGHLIGHT_CONTAINER, CLASS_HIGHLIGHT_CURSOR1, CLASS_HIGHLIGHT_CURSOR2, CLASS_HIGHLIGHT_COMMON, CLASS_HIGHLIGHT_BOUNDING_AREA, CLASS_HIGHLIGHT_BOUNDING_AREA_MARGIN, CLASS_HIGHLIGHT_MARGIN, CLASS_HIGHLIGHT_HOVER } from "../../common/styles";

import { isRTL } from "./readium-css";

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

// const DEBUG_VISUALS = false; // IS_DEV;

// const USE_SVG = false;

const DEFAULT_BACKGROUND_COLOR: IColor = {
    blue: 0,
    green: 0,
    red: 255,
};

const _highlights: IHighlight[] = [];

let _drawMargin: boolean | string[] = false;
const drawMargin = (h: IHighlight) => {
    if (Array.isArray(_drawMargin)) {
        if (h.group) {
            return _drawMargin.includes(h.group);
        }
        return false;
    }
    return _drawMargin;
};
export const setDrawMargin = (win: ReadiumElectronWebviewWindow, drawMargin: boolean | string[]) => {
    _drawMargin = drawMargin;
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- _drawMargin: " + JSON.stringify(_drawMargin, null, 4));
    }
    recreateAllHighlightsRaw(win);
};

// interface IAreaWithActiveFlag extends Element {
//     active: boolean | undefined;
// }

interface IWithRect {
    rect: IRectSimple;
    scale: number;
    // xOffset: number;
    // yOffset: number;
}
interface IHTMLDivElementWithRect extends HTMLDivElement, IWithRect {
}

// const SVG_XML_NAMESPACE = "http://www.w3.org/2000/svg";
// interface ISVGRectElementWithRect extends SVGRectElement, IWithRect {
// }
// interface ISVGLineElementWithRect extends SVGLineElement, IWithRect {
// }

// interface IDocumentBody extends HTMLElement {
//     _CachedBoundingClientRect: DOMRect | undefined;
//     _CachedMargins: IRect | undefined;
// }
export function getBoundingClientRectOfDocumentBody(win: ReadiumElectronWebviewWindow): DOMRect {
    // TODO: does this need to be cached? (performance, notably during mouse hover)
    return win.document.body.getBoundingClientRect();

    // if (!(win.document.body as IDocumentBody)._CachedBoundingClientRect) {
    //     (win.document.body as IDocumentBody)._CachedBoundingClientRect = win.document.body.getBoundingClientRect();
    // }
    // console.log("_CachedBoundingClientRect",
    //     JSON.stringify((win.document.body as IDocumentBody)._CachedBoundingClientRect));
    // return (win.document.body as IDocumentBody)._CachedBoundingClientRect as DOMRect;
}
// export function invalidateBoundingClientRectOfDocumentBody(win: ReadiumElectronWebviewWindow) {
//     (win.document.body as IDocumentBody)._CachedBoundingClientRect = undefined;
// }
// function getBodyMargin(win: ReadiumElectronWebviewWindow): IRect {
//     const bodyStyle = win.getComputedStyle(win.document.body);
//     if (!(win.document.body as IDocumentBody)._CachedMargins) {
//         (win.document.body as IDocumentBody)._CachedMargins = {
//             bottom: parseInt(bodyStyle.marginBottom, 10),
//             height: 0,
//             left: parseInt(bodyStyle.marginLeft, 10),
//             right: parseInt(bodyStyle.marginRight, 10),
//             top: parseInt(bodyStyle.marginTop, 10),
//             width: 0,
//         };
//     }
//     console.log("_CachedMargins",
//         JSON.stringify((win.document.body as IDocumentBody)._CachedMargins));
//     return (win.document.body as IDocumentBody)._CachedMargins as IRect;
// }

function processMouseEvent(win: ReadiumElectronWebviewWindow, ev: MouseEvent) {

    // const highlightsContainer = documant.getElementById(`${ID_HIGHLIGHTS_CONTAINER}`);
    if (!_highlightsContainer) {
        return;
    }

    const isMouseMove = ev.type === "mousemove";
    if (isMouseMove) {
        // no hit testing during user selection drag
        if (ev.buttons > 0) {
            return;
        }

        if (!_highlights.length) {
            return;
        }
    }

    const documant = win.document;
    const scrollElement = getScrollingElement(documant);

    // relative to fixed window top-left corner
    // (unlike pageX/Y which is relative to top-left rendered content area, subject to scrolling)
    const x = ev.clientX;
    const y = ev.clientY;

    const paginated = isPaginated(documant);

    // COSTLY! TODO: cache DOMRect
    const bodyRect = getBoundingClientRectOfDocumentBody(win);

    const xOffset = paginated ? (-scrollElement.scrollLeft) : bodyRect.left;
    const yOffset = paginated ? (-scrollElement.scrollTop) : bodyRect.top;

    const testHit = (highlightFragment: Element) => {
        const withRect = (highlightFragment as unknown) as IWithRect;
        // console.log(`RECT: ${withRect.rect.left} | ${withRect.rect.top} // ${withRect.rect.width} | ${withRect.rect.height}`);

        const left = withRect.rect.left + xOffset; // (paginated ? withRect.xOffset : xOffset);
        const top = withRect.rect.top + yOffset; // (paginated ? withRect.yOffset : yOffset);
        if (x >= left &&
            x < (left + withRect.rect.width) &&
            y >= top &&
            y < (top + withRect.rect.height)
            ) {

            return true;
        }
        return false;
    };

    // const useSVG = !(DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS) && USE_SVG;

    let changeCursor = false;
    let foundHighlight: IHighlight | undefined;
    let foundElement: IHTMLDivElementWithRect | undefined;
    // for (const highlight of _highlights) {
    for (let i = _highlights.length - 1; i >= 0; i--) {
        const highlight = _highlights[i];

        let highlightParent = documant.getElementById(`${highlight.id}`);
        if (!highlightParent) { // ??!!
            highlightParent = _highlightsContainer.querySelector(`#${highlight.id}`); // .${CLASS_HIGHLIGHT_CONTAINER}
        }
        if (!highlightParent) { // what?
            continue;
        }

        let hit = false;
        let highlightFragment = highlightParent.firstElementChild;
        while (highlightFragment) {
            // if (useSVG && highlightFragment.namespaceURI === SVG_XML_NAMESPACE) {
            //     let svgRect = highlightFragment.firstElementChild;
            //     while (svgRect) {
            //         if (testHit(svgRect)) {
            //             changeCursor = true;
            //             hit = true;
            //             break;
            //         }
            //         svgRect = svgRect.nextElementSibling;
            //     }
            //     if (hit) {
            //         break;
            //     }
            // } else
            if (highlightFragment.classList.contains(CLASS_HIGHLIGHT_AREA)) {

                if (testHit(highlightFragment)) {
                    changeCursor = true;
                    hit = true;
                    break;
                }
            } else if (highlightFragment.classList.contains(CLASS_HIGHLIGHT_BOUNDING_AREA_MARGIN)) {

                if (testHit(highlightFragment)) {
                    changeCursor = true;
                    hit = true;
                    break;
                }
            }
            highlightFragment = highlightFragment.nextElementSibling;
        }

        if (hit) {
            foundHighlight = highlight;
            foundElement = highlightParent as IHTMLDivElementWithRect;
            break;
        }
    }

    if (!foundHighlight || !foundElement) {

        documant.documentElement.classList.remove(CLASS_HIGHLIGHT_CURSOR1);
        documant.documentElement.classList.remove(CLASS_HIGHLIGHT_CURSOR2);

        let highlightContainer = _highlightsContainer.firstElementChild;
        while (highlightContainer) {
            highlightContainer.classList.remove(CLASS_HIGHLIGHT_HOVER);

            // const id = highlightContainer.id || highlightContainer.getAttribute("id");
            // const highlight = id ? _highlights.find((h) => h.id === id) : undefined;
            // const drawUnderline = highlight?.drawType === HighlightDrawTypeUnderline;
            // const drawStrikeThrough = highlight?.drawType === HighlightDrawTypeStrikethrough;
            // const doDrawMargin = highlight ? drawMargin(highlight) : false;

            // if ((DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS)) {
            //     let highlightContainerChild = highlightContainer.firstElementChild;
            //     while (highlightContainerChild) {

            //         if (highlightContainerChild.classList.contains(CLASS_HIGHLIGHT_BOUNDING_AREA)
            //             && (highlightContainerChild as unknown as IAreaWithActiveFlag).active) {

            //             (highlightContainerChild as unknown as IAreaWithActiveFlag).active = false;

            //             (highlightContainerChild as HTMLElement).style.setProperty("outline", "none", "important");

            //             (highlightContainerChild as HTMLElement).style.setProperty(
            //                 "background-color",
            //                 "transparent",
            //                 "important");
            //         }
            //         highlightContainerChild = highlightContainerChild.nextElementSibling;
            //     }
            // }

            highlightContainer = highlightContainer.nextElementSibling;
        }

        return;
    }

    if (foundHighlight.pointerInteraction) {

        if (isMouseMove) {
            const doDrawMargin = drawMargin(foundHighlight);

            foundElement.classList.add(CLASS_HIGHLIGHT_HOVER);

            if (changeCursor) {
                documant.documentElement.classList.add(doDrawMargin ? CLASS_HIGHLIGHT_CURSOR1 : CLASS_HIGHLIGHT_CURSOR2);
            }

        } else if (ev.type === "mouseup" || ev.type === "click") {
            ev.preventDefault();
            ev.stopPropagation();

            const payload: IEventPayload_R2_EVENT_HIGHLIGHT_CLICK = {
                highlight: foundHighlight,
                event: {
                    type: ev.type,
                    button: ev.button,
                    alt: ev.altKey,
                    shift: ev.shiftKey,
                    ctrl: ev.ctrlKey,
                    meta: ev.metaKey,
                    x: ev.clientX,
                    y: ev.clientY,
                },
            };
            ipcRenderer.sendToHost(R2_EVENT_HIGHLIGHT_CLICK, payload);
        }
    }
}

let lastMouseDownX = -1;
let lastMouseDownY = -1;
let bodyEventListenersSet = false;
let _highlightsContainer: HTMLElement | null;
function ensureHighlightsContainer(win: ReadiumElectronWebviewWindow): HTMLElement {
    const documant = win.document;

    if (!_highlightsContainer) {

        // Note that legacy ResizeSensor sets body position to "relative" (default static).
        // Also note that ReadiumCSS default to (via stylesheet :root):
        // documant.documentElement.style.position = "relative";
        // see styles.js (static CSS injection):
        // documant.documentElement.style.setProperty("height", "100vh", "important");
        // documant.body.style.position = "relative";
        // documant.body.style.setProperty("position", "relative", "important");
        // documant.body.style.height = "inherit";
        // https://github.com/edrlab/thorium-reader/issues/1658

        if (!bodyEventListenersSet) {
            bodyEventListenersSet = true;

            // reminder: mouseenter/mouseleave do not bubble, so no event delegation
            // documant.body.addEventListener("click", (ev: MouseEvent) => {
            //     processMouseEvent(win, ev);
            // }, false);
            documant.body.addEventListener("mousedown", (ev: MouseEvent) => {
                lastMouseDownX = ev.clientX;
                lastMouseDownY = ev.clientY;
            }, false);
            documant.body.addEventListener("mouseup", (ev: MouseEvent) => {
                if ((Math.abs(lastMouseDownX - ev.clientX) < 3) &&
                    (Math.abs(lastMouseDownY - ev.clientY) < 3)) {
                    processMouseEvent(win, ev);
                }
            }, false);
            documant.body.addEventListener("mousemove", (ev: MouseEvent) => {
                processMouseEvent(win, ev);
            }, false);
        }

        _highlightsContainer = documant.createElement("div");
        _highlightsContainer.setAttribute("id", ID_HIGHLIGHTS_CONTAINER);
        _highlightsContainer.setAttribute("class", CLASS_HIGHLIGHT_COMMON);
        _highlightsContainer.setAttribute("style",
            "width: auto !important; " +
            "height: auto !important; ");
        documant.body.append(_highlightsContainer);
    }
    return _highlightsContainer;
}

export function hideAllhighlights(_documant: Document) {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- hideAllhighlights: " + _highlights.length);
    }

    if (_highlightsContainer) {
        _highlightsContainer.remove();
        _highlightsContainer = null;
        // ensureHighlightsContainer(documant); LAZY
    }
}

export function destroyAllhighlights(documant: Document) {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- destroyAllhighlights: " + _highlights.length);
    }
    hideAllhighlights(documant);
    _highlights.splice(0, _highlights.length);
}

export function destroyHighlight(documant: Document, id: string) {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- destroyHighlight: " + id + " ... " + _highlights.length);
    }
    let i = -1;
    const highlight = _highlights.find((h, j) => {
        i = j;
        return h.id === id;
    });
    if (highlight && i >= 0 && i < _highlights.length) {
        _highlights.splice(i, 1);
    }

    const highlightContainer = documant.getElementById(id);
    if (highlightContainer) {
        highlightContainer.remove();
    }
}

export function destroyHighlightsGroup(documant: Document, group: string) {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- destroyHighlightsGroup: " + group + " ... " + _highlights.length);
    }
    while (true) {
        let i = -1;
        const highlight = _highlights.find((h, j) => {
            i = j;
            return h.group === group;
        });
        if (highlight) {
            if (i >= 0 && i < _highlights.length) {
                _highlights.splice(i, 1);
            }

            const highlightContainer = documant.getElementById(highlight.id);
            if (highlightContainer) {
                highlightContainer.remove();
            }
        } else {
            break;
        }
    }
}

export function recreateAllHighlightsRaw(win: ReadiumElectronWebviewWindow, highlights?: IHighlight[]) {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- recreateAllHighlightsRaw: " + _highlights.length + " ==> " + highlights?.length);
    }

    const documant = win.document;

    if (highlights?.length) {
        if (_highlights.length) {
            if (IS_DEV) {
                console.log("--HIGH WEBVIEW-- recreateAllHighlightsRaw DESTROY OLD BEFORE RESTORE BACKUP: " + _highlights.length + " ==> " + highlights.length);
            }
            destroyAllhighlights(documant);
        }
        if (IS_DEV) {
            console.log("--HIGH WEBVIEW-- recreateAllHighlightsRaw RESTORE BACKUP: " + _highlights.length + " ==> " + highlights.length);
        }
        _highlights.push(...highlights);
    }

    if (!_highlights.length) {
        return;
    }

    if (!documant.body) {
        if (IS_DEV) {
            console.log("--HIGH WEBVIEW-- NO BODY?! (retrying...): " + _highlights.length);
        }
        recreateAllHighlightsDebounced(win);
        return;
    }

    hideAllhighlights(documant);

    const bodyRect = getBoundingClientRectOfDocumentBody(win);
    const bodyComputedStyle = win.getComputedStyle(documant.body);

    const docFrag = documant.createDocumentFragment();
    for (const highlight of _highlights) {
        const div = createHighlightDom(win, highlight, bodyRect, bodyComputedStyle);
        if (div) {
            docFrag.append(div);
        }
    }

    const highlightsContainer = ensureHighlightsContainer(win);
    highlightsContainer.append(docFrag);
}

export const recreateAllHighlightsDebounced = debounce((win: ReadiumElectronWebviewWindow) => {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- recreateAllHighlightsDebounced: " + _highlights.length);
    }
    recreateAllHighlightsRaw(win);
}, 500);

export function recreateAllHighlights(win: ReadiumElectronWebviewWindow) {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- recreateAllHighlights: " + _highlights.length);
    }
    hideAllhighlights(win.document);
    recreateAllHighlightsDebounced(win);
}

export function createHighlights(
    win: ReadiumElectronWebviewWindow,
    highDefs: IHighlightDefinition[],
    pointerInteraction: boolean): Array<IHighlight | null> {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- createHighlights: " + highDefs.length + " ... " + _highlights.length);
    }

    const documant = win.document;
    const highlights: Array<IHighlight | null> = [];

    const bodyRect = getBoundingClientRectOfDocumentBody(win);
    const bodyComputedStyle = win.getComputedStyle(documant.body);

    const docFrag = documant.createDocumentFragment();
    for (const highDef of highDefs) {
        if (!highDef.selectionInfo && !highDef.range) {
            highlights.push(null);
            continue;
        }
        const [high, div] = createHighlight(
            win,
            highDef.selectionInfo,
            highDef.range,
            highDef.color,
            pointerInteraction,
            highDef.drawType,
            highDef.expand,
            highDef.group,
            bodyRect,
            bodyComputedStyle);
        highlights.push(high);

        if (div) {
            docFrag.append(div);
        }
    }

    const highlightsContainer = ensureHighlightsContainer(win);
    highlightsContainer.append(docFrag);

    return highlights;
}

const computeCFI = (node: Node): string | undefined => {

    if (node.nodeType !== Node.ELEMENT_NODE) {
        if (node.parentNode) {
            return computeCFI(node.parentNode);
        }
        return undefined;
    }

    let cfi = "";

    let currentElement = node as Element;
    while (currentElement.parentNode && currentElement.parentNode.nodeType === Node.ELEMENT_NODE) {
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
        currentElement = currentElement.parentNode as Element;
    }

    return "/" + cfi;
};

export function createHighlight(
    win: ReadiumElectronWebviewWindow,
    selectionInfo: ISelectionInfo | undefined,
    range: Range | undefined,
    color: IColor | undefined,
    pointerInteraction: boolean,
    drawType: number | undefined,
    expand: number | undefined,
    group: string | undefined,
    bodyRect: DOMRect,
    bodyComputedStyle: CSSStyleDeclaration): [IHighlight, HTMLDivElement | null] {

    // tslint:disable-next-line:no-string-literal
    // console.log("Chromium: " + process.versions["chrome"]);

    const uniqueStr = selectionInfo ? `${selectionInfo.rangeInfo.startContainerElementCssSelector}${selectionInfo.rangeInfo.startContainerChildTextNodeIndex}${selectionInfo.rangeInfo.startOffset}${selectionInfo.rangeInfo.endContainerElementCssSelector}${selectionInfo.rangeInfo.endContainerChildTextNodeIndex}${selectionInfo.rangeInfo.endOffset}` : range ? `${range.startOffset}-${range.endOffset}-${computeCFI(range.startContainer)}-${computeCFI(range.endContainer)}` : "_RANGE_"; // ${selectionInfo.rangeInfo.cfi} useless

    // console.log("RANGE uniqueStr: " + uniqueStr + " (( " + range?.toString());

    // const unique = Buffer.from(JSON.stringify(selectionInfo.rangeInfo, null, "")).toString("base64");
    // const unique = Buffer.from(uniqueStr).toString("base64");
    // const id = "R2_HIGHLIGHT_" + unique.replace(/\+/, "_").replace(/=/, "-").replace(/\//, ".");
    const checkSum = crypto.createHash("sha1"); // sha256 slow
    checkSum.update(uniqueStr);
    const shaHex = checkSum.digest("hex");
    const idBase = "R2_HIGHLIGHT_" + shaHex;
    let id = idBase;
    let idIdx = 0;
    while (
        _highlights.find((h) => h.id === id) ||
        win.document.getElementById(id)) {

        if (IS_DEV) {
            console.log("HIGHLIGHT ID already exists, increment: " + uniqueStr + " ==> " + id);
        }
        id = `${idBase}_${idIdx++}`;
    }

    const highlight: IHighlight = {
        color: color ? color : DEFAULT_BACKGROUND_COLOR,
        drawType,
        expand,
        id,
        pointerInteraction,
        selectionInfo,
        range,
        group,
    };
    _highlights.push(highlight);

    const div = createHighlightDom(win, highlight, bodyRect, bodyComputedStyle);
    return [highlight, div];
}

function createHighlightDom(
    win: ReadiumElectronWebviewWindow,
    highlight: IHighlight,
    bodyRect: DOMRect,
    bodyComputedStyle: CSSStyleDeclaration): HTMLDivElement | null {

    const documant = win.document;
    const scrollElement = getScrollingElement(documant);

    const range = highlight.selectionInfo ? convertRangeInfo(documant, highlight.selectionInfo.rangeInfo) : highlight.range;
    if (!range) {
        return null;
    }

    const drawUnderline = highlight.drawType === HighlightDrawTypeUnderline; // && !(DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS);
    const drawStrikeThrough = highlight.drawType === HighlightDrawTypeStrikethrough; // && !(DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS);

    const paginated = isPaginated(documant);
    const paginatedTwo = paginated && isTwoPageSpread();

    const rtl = isRTL();
    const vertical = isVerticalWritingMode();

    const doDrawMargin = drawMargin(highlight);

    // checkRangeFix(documant);

    // const highlightsContainer = ensureHighlightsContainer(win);

    const highlightParent = documant.createElement("div") as IHTMLDivElementWithRect;
    highlightParent.setAttribute("id", highlight.id);
    highlightParent.setAttribute("class", `${CLASS_HIGHLIGHT_CONTAINER} ${CLASS_HIGHLIGHT_COMMON}`);
    highlightParent.setAttribute("data-type", `${highlight.drawType}`);
    if (highlight.group) {
        highlightParent.setAttribute("data-group", highlight.group);
    }
    if (doDrawMargin) {
        // highlightParent.setAttribute("data-margin", "true");
        highlightParent.classList.add(CLASS_HIGHLIGHT_MARGIN);
    }

    const styleAttr = win.document.documentElement.getAttribute("style");
    const isNight = styleAttr ? styleAttr.indexOf("readium-night-on") > 0 : false;
    // const isSepia = styleAttr ? styleAttr.indexOf("readium-sepia-on") > 0 : false;

    highlightParent.style.setProperty(
        "mix-blend-mode",
        isNight ? "hard-light" : "multiply",
        "important");

    // const docStyle = (documant.defaultView as Window).getComputedStyle(documant.documentElement);
    // const bodyStyle = (documant.defaultView as Window).getComputedStyle(documant.body);
    // const marginLeft = bodyStyle.getPropertyValue("margin-left");
    // console.log("marginLeft: " + marginLeft);
    // const marginTop = bodyStyle.getPropertyValue("margin-top");
    // console.log("marginTop: " + marginTop);

    // console.log("==== bodyRect:");
    // console.log("width: " + bodyRect.width);
    // console.log("height: " + bodyRect.height);
    // console.log("top: " + bodyRect.top);
    // console.log("bottom: " + bodyRect.bottom);
    // console.log("left: " + bodyRect.left);
    // console.log("right: " + bodyRect.right);

    // const xOffset = paginated ? (bodyRect.left - parseInt(marginLeft, 10)) : bodyRect.left;
    // const yOffset = paginated ? (bodyRect.top - parseInt(marginTop, 10)) : bodyRect.top;

    const xOffset = paginated ? (-scrollElement.scrollLeft) : bodyRect.left;
    const yOffset = paginated ? (-scrollElement.scrollTop) : bodyRect.top;

    const scale = 1 / ((win.READIUM2 && win.READIUM2.isFixedLayout) ? win.READIUM2.fxlViewportScale : 1);
    // const scale = 1;

    // console.log("scrollElement.scrollLeft: " + scrollElement.scrollLeft);
    // console.log("scrollElement.scrollTop: " + scrollElement.scrollTop);

    // const useSVG = !(DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS) && USE_SVG;

    // TODO isVerticalWritingMode()?
    const doNotMergeHorizontallyAlignedRects = drawUnderline || drawStrikeThrough;

    const expand = highlight.expand ? highlight.expand : 0;

    const rangeClientRects = range.getClientRects();
    const clientRects =
        // (DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS) ?
        // rangeClientRects :
        getClientRectsNoOverlap_(rangeClientRects, doNotMergeHorizontallyAlignedRects, expand);

    // let highlightAreaSVGDocFrag: DocumentFragment | undefined;
    // const roundedCorner = 3;

    const underlineThickness = 3;
    const strikeThroughLineThickness = 4;

    const rangeBoundingClientRect = range.getBoundingClientRect();

    const bodyWidth = parseInt(bodyComputedStyle.width, 10);

    const paginatedWidth = scrollElement.clientWidth / (paginatedTwo ? 2 : 1);

    const paginatedOffset = (paginatedWidth - bodyWidth) / 2 + parseInt(bodyComputedStyle.paddingLeft, 10);

    for (const clientRect of clientRects) {

        // if (useSVG) {
        //     const borderThickness = 0;

        //     if (!highlightAreaSVGDocFrag) {
        //         highlightAreaSVGDocFrag = documant.createDocumentFragment();
        //     }

        //     if (drawUnderline) {
        //         // TODO isVerticalWritingMode()

        //         const highlightAreaSVGLine = documant.createElementNS(SVG_XML_NAMESPACE, "line") as ISVGLineElementWithRect;
        //         highlightAreaSVGLine.setAttribute("class", CLASS_HIGHLIGHT_AREA);

        //         highlightAreaSVGLine.setAttribute("style",
        //             "stroke-linecap: round !important; " +
        //             `stroke-width: ${underlineThickness * scale} !important; ` +
        //             `stroke: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important;`);
        //         highlightAreaSVGLine.scale = scale;
        //         // highlightAreaSVGLine.xOffset = xOffset;
        //         // highlightAreaSVGLine.yOffset = yOffset;
        //         highlightAreaSVGLine.rect = {
        //             height: clientRect.height,
        //             left: clientRect.left - xOffset,
        //             top: clientRect.top - yOffset,
        //             width: clientRect.width,
        //         };
        //         const lineOffset = (highlightAreaSVGLine.rect.width > roundedCorner) ? roundedCorner : 0;
        //         highlightAreaSVGLine.setAttribute("x1", `${(highlightAreaSVGLine.rect.left + lineOffset) * scale}`);
        //         highlightAreaSVGLine.setAttribute("x2", `${(highlightAreaSVGLine.rect.left + highlightAreaSVGLine.rect.width - lineOffset) * scale}`);
        //         const y = (highlightAreaSVGLine.rect.top + highlightAreaSVGLine.rect.height - (underlineThickness / 2)) * scale;
        //         highlightAreaSVGLine.setAttribute("y1", `${y}`);
        //         highlightAreaSVGLine.setAttribute("y2", `${y}`);

        //         highlightAreaSVGLine.setAttribute("height", `${highlightAreaSVGLine.rect.height * scale}`);
        //         highlightAreaSVGLine.setAttribute("width", `${highlightAreaSVGLine.rect.width * scale}`);

        //         highlightAreaSVGDocFrag.appendChild(highlightAreaSVGLine);
        //     } else if (drawStrikeThrough) {
        //         const highlightAreaSVGLine = documant.createElementNS(SVG_XML_NAMESPACE, "line") as ISVGLineElementWithRect;
        //         highlightAreaSVGLine.setAttribute("class", CLASS_HIGHLIGHT_AREA);

        //         highlightAreaSVGLine.setAttribute("style",
        //             "stroke-linecap: butt !important; " +
        //             `stroke-width: ${strikeThroughLineThickness * scale} !important; ` +
        //             `stroke: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important;`);
        //             // stroke-dasharray: ${lineThickness * 2},${lineThickness * 2};

        //         highlightAreaSVGLine.scale = scale;
        //         // highlightAreaSVGLine.xOffset = xOffset;
        //         // highlightAreaSVGLine.yOffset = yOffset;
        //         highlightAreaSVGLine.rect = {
        //             height: clientRect.height,
        //             left: clientRect.left - xOffset,
        //             top: clientRect.top - yOffset,
        //             width: clientRect.width,
        //         };
        //         highlightAreaSVGLine.setAttribute("x1", `${highlightAreaSVGLine.rect.left * scale}`);
        //         highlightAreaSVGLine.setAttribute("x2", `${(highlightAreaSVGLine.rect.left + highlightAreaSVGLine.rect.width) * scale}`);

        //         const lineOffset = highlightAreaSVGLine.rect.height / 2;
        //         const y = (highlightAreaSVGLine.rect.top + lineOffset) * scale;
        //         highlightAreaSVGLine.setAttribute("y1", `${y}`);
        //         highlightAreaSVGLine.setAttribute("y2", `${y}`);

        //         highlightAreaSVGLine.setAttribute("height", `${highlightAreaSVGLine.rect.height * scale}`);
        //         highlightAreaSVGLine.setAttribute("width", `${highlightAreaSVGLine.rect.width * scale}`);

        //         highlightAreaSVGDocFrag.appendChild(highlightAreaSVGLine);
        //     } else {

        //         const highlightAreaSVGRect =
        //             documant.createElementNS(SVG_XML_NAMESPACE, "rect") as ISVGRectElementWithRect;
        //         highlightAreaSVGRect.setAttribute("class", CLASS_HIGHLIGHT_AREA);

        //         highlightAreaSVGRect.setAttribute("style",
        //             `fill: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important; ` +
        //             "stroke-width: 0;");

        //         // stroke-width: ${borderThickness}; stroke: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important; stroke-opacity: ${DEFAULT_BACKGROUND_COLOR_OPACITY} !important

        //         highlightAreaSVGRect.scale = scale;
        //         // highlightAreaSVGRect.xOffset = xOffset;
        //         // highlightAreaSVGRect.yOffset = yOffset;
        //         highlightAreaSVGRect.rect = {
        //             height: clientRect.height,
        //             left: clientRect.left - xOffset,
        //             top: clientRect.top - yOffset,
        //             width: clientRect.width,
        //         };
        //         highlightAreaSVGRect.setAttribute("rx", `${roundedCorner * scale}`);
        //         highlightAreaSVGRect.setAttribute("ry", `${roundedCorner * scale}`);
        //         highlightAreaSVGRect.setAttribute("x", `${(highlightAreaSVGRect.rect.left - borderThickness) * scale}`);
        //         highlightAreaSVGRect.setAttribute("y", `${(highlightAreaSVGRect.rect.top - borderThickness) * scale}`);
        //         highlightAreaSVGRect.setAttribute("height", `${(highlightAreaSVGRect.rect.height + (borderThickness * 2)) * scale}`);
        //         highlightAreaSVGRect.setAttribute("width", `${(highlightAreaSVGRect.rect.width + (borderThickness * 2)) * scale}`);

        //         highlightAreaSVGDocFrag.appendChild(highlightAreaSVGRect);
        //     }
        // } else
        {
            if (drawStrikeThrough) {

                const highlightAreaLine = documant.createElement("div") as IHTMLDivElementWithRect;
                highlightAreaLine.setAttribute("class", `${CLASS_HIGHLIGHT_AREA} ${CLASS_HIGHLIGHT_COMMON}`);
                highlightAreaLine.setAttribute("style",
                    `background-color: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important;`,
                );

                highlightAreaLine.scale = scale;
                // highlightAreaLine.xOffset = xOffset;
                // highlightAreaLine.yOffset = yOffset;

                highlightAreaLine.rect = {
                    height: clientRect.height,
                    left: clientRect.left - xOffset,
                    top: clientRect.top - yOffset,
                    width: clientRect.width,
                };

                highlightAreaLine.style.setProperty("width", `${(vertical ? strikeThroughLineThickness : highlightAreaLine.rect.width) * scale}px`, "important");
                highlightAreaLine.style.setProperty("height", `${(vertical ? highlightAreaLine.rect.height : strikeThroughLineThickness) * scale}px`, "important");
                highlightAreaLine.style.setProperty("min-width", highlightAreaLine.style.width, "important");
                highlightAreaLine.style.setProperty("min-height", highlightAreaLine.style.height, "important");
                highlightAreaLine.style.setProperty("left", `${(vertical ? (highlightAreaLine.rect.left + (highlightAreaLine.rect.width / 2) - (strikeThroughLineThickness / 2)) : highlightAreaLine.rect.left) * scale}px`, "important");
                highlightAreaLine.style.setProperty("top", `${(vertical ? highlightAreaLine.rect.top : (highlightAreaLine.rect.top + (highlightAreaLine.rect.height / 2) - (strikeThroughLineThickness / 2))) * scale}px`, "important");

                highlightParent.append(highlightAreaLine);
            } else {

                const highlightArea = documant.createElement("div") as IHTMLDivElementWithRect;
                highlightArea.setAttribute("class", `${CLASS_HIGHLIGHT_AREA} ${CLASS_HIGHLIGHT_COMMON}`);
                let extra = "";
                // if ((DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS)) {
                //     const rgb = Math.round(0xffffff * Math.random());
                //     // tslint:disable-next-line:no-bitwise
                //     const r = rgb >> 16;
                //     // tslint:disable-next-line:no-bitwise
                //     const g = rgb >> 8 & 255;
                //     // tslint:disable-next-line:no-bitwise
                //     const b = rgb & 255;
                //     extra = `outline-color: rgb(${r}, ${g}, ${b}); outline-style: solid; outline-width: 1px; outline-offset: -1px;`;
                //     // box-shadow: inset 0 0 0 1px #600;
                // } else
                if (drawUnderline) {
                    const side = isVerticalWritingMode() ? "left" : "bottom"; // isRTL()?
                    extra = `border-${side}: ${underlineThickness * scale}px solid ` +
                        `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important`;
                }
                highlightArea.setAttribute("style",
                    (drawUnderline ?
                    "" : // background-color: transparent !important
                    ( // `border-radius: ${roundedCorner}px !important; ` +
                    "background-color: " +
                        `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important;`
                    )
                    ) + ` ${extra}`);

                highlightArea.scale = scale;
                // highlightArea.xOffset = xOffset;
                // highlightArea.yOffset = yOffset;

                highlightArea.rect = {
                    height: clientRect.height,
                    left: clientRect.left - xOffset,
                    top: clientRect.top - yOffset,
                    width: clientRect.width,
                };

                highlightArea.style.setProperty("width", `${highlightArea.rect.width * scale}px`, "important");
                highlightArea.style.setProperty("height", `${highlightArea.rect.height * scale}px`, "important");
                highlightArea.style.setProperty("min-width", highlightArea.style.width, "important");
                highlightArea.style.setProperty("min-height", highlightArea.style.height, "important");
                highlightArea.style.setProperty("left", `${highlightArea.rect.left * scale}px`, "important");
                highlightArea.style.setProperty("top", `${highlightArea.rect.top * scale}px`, "important");

                highlightParent.append(highlightArea);
            }
        }
    }

    if (doDrawMargin && highlight.pointerInteraction) {
        const MARGIN_MARKER_THICKNESS = 18 / (win.READIUM2.isFixedLayout ? scale : 1);
        const MARGIN_MARKER_OFFSET = 4 / (win.READIUM2.isFixedLayout ? scale : 1);

        const highlightBoundingMargin = documant.createElement("div") as IHTMLDivElementWithRect;
        highlightBoundingMargin.setAttribute("class", `${CLASS_HIGHLIGHT_BOUNDING_AREA_MARGIN} ${CLASS_HIGHLIGHT_COMMON}`);

        const round = MARGIN_MARKER_THICKNESS / 1.5;
        highlightBoundingMargin.setAttribute("style",
            // `border-radius: ${round}px;` +
            `border-top-left-radius: ${vertical ? round : rtl ? 0 : round}px;` +
            `border-top-right-radius: ${vertical ? round : !rtl ? 0 : round}px;` +
            `border-bottom-right-radius: ${vertical ? 0 : !rtl ? 0 :round}px;` +
            `border-bottom-left-radius: ${vertical ? 0 : rtl ? 0 :round}px;` +
            "background-color: " +
            `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important;`,
        );

        highlightBoundingMargin.scale = scale;
        // highlightBoundingMargin.xOffset = xOffset;
        // highlightBoundingMargin.yOffset = yOffset;

        const paginatedOffset_ = paginatedOffset - MARGIN_MARKER_OFFSET - MARGIN_MARKER_THICKNESS;

        highlightBoundingMargin.rect = {
            left:
                // ----
                vertical ?
                (rangeBoundingClientRect.left - xOffset) :
                // ----
                paginated ?
                (
                    (rtl
                    ?
                    paginatedWidth - MARGIN_MARKER_THICKNESS // - MARGIN_MARKER_OFFSET
                    :
                    0 // MARGIN_MARKER_OFFSET
                    )
                    +
                    (rtl
                    ?
                    -1 * paginatedOffset_
                    :
                    paginatedOffset_
                    )
                    +
                    Math.floor((rangeBoundingClientRect.left - xOffset) / paginatedWidth) * paginatedWidth
                )
                :
                // ---- scroll
                (rtl
                ?
                MARGIN_MARKER_OFFSET + bodyRect.width - parseInt(bodyComputedStyle.paddingRight, 10)
                :
                win.READIUM2.isFixedLayout
                ?
                MARGIN_MARKER_OFFSET
                :
                parseInt(bodyComputedStyle.paddingLeft, 10) - MARGIN_MARKER_THICKNESS - MARGIN_MARKER_OFFSET
                ),
            top:
            vertical
            ?
            parseInt(bodyComputedStyle.paddingTop, 10) - MARGIN_MARKER_THICKNESS - MARGIN_MARKER_OFFSET
            :
            (rangeBoundingClientRect.top - yOffset),
            width: vertical ? rangeBoundingClientRect.width : MARGIN_MARKER_THICKNESS,
            height: vertical ? MARGIN_MARKER_THICKNESS : rangeBoundingClientRect.height,
        };

        highlightBoundingMargin.style.setProperty("width", `${highlightBoundingMargin.rect.width * scale}px`, "important");
        highlightBoundingMargin.style.setProperty("height", `${highlightBoundingMargin.rect.height * scale}px`, "important");
        highlightBoundingMargin.style.setProperty("min-width", highlightBoundingMargin.style.width, "important");
        highlightBoundingMargin.style.setProperty("min-height", highlightBoundingMargin.style.height, "important");
        highlightBoundingMargin.style.setProperty("left", `${highlightBoundingMargin.rect.left * scale}px`, "important");
        highlightBoundingMargin.style.setProperty("top", `${highlightBoundingMargin.rect.top * scale}px`, "important");
        highlightParent.append(highlightBoundingMargin);
    }

    // if (useSVG && highlightAreaSVGDocFrag) {
    //     // const highlightAreaSVGG = documant.createElementNS(SVG_XML_NAMESPACE, "g");
    //     // highlightAreaSVGG.appendChild(highlightAreaSVGDocFrag);
    //     const highlightAreaSVG = documant.createElementNS(SVG_XML_NAMESPACE, "svg");
    //     highlightAreaSVG.setAttribute("class", CLASS_HIGHLIGHT_COMMON);
    //     // highlightAreaSVG.setAttribute("pointer-events", "none");
    //     highlightAreaSVG.style.setProperty("position", paginated ? "fixed" : "absolute", "important");
    //     highlightAreaSVG.append(highlightAreaSVGDocFrag);
    //     highlightParent.append(highlightAreaSVG);
    // }

    const highlightBounding = documant.createElement("div") as IHTMLDivElementWithRect;
    highlightBounding.setAttribute("class", `${CLASS_HIGHLIGHT_BOUNDING_AREA} ${CLASS_HIGHLIGHT_COMMON}`);

    // if ((DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS)) {
    //     highlightBounding.setAttribute("style",
    //         "outline-color: magenta !important; " +
    //         "outline-style: solid !important; " +
    //         "outline-width: 1px !important; " +
    //         "outline-offset: -1px !important;");
    // }

    highlightBounding.scale = scale;
    // highlightBounding.xOffset = xOffset;
    // highlightBounding.yOffset = yOffset;

    // highlightBounding.rect = {
    //     height: rangeBoundingClientRect.height + expand * 2,
    //     left: rangeBoundingClientRect.left - xOffset - expand,
    //     top: rangeBoundingClientRect.top - yOffset - expand,
    //     width: rangeBoundingClientRect.width + expand * 2,
    // };

    const leftBase = rangeBoundingClientRect.left - xOffset - expand;
    const leftOff = (paginatedWidth - bodyWidth) / 2;
    highlightBounding.rect = {
        left:
            paginated
            ?
            rtl
            ?
            leftBase - leftOff - paginatedWidth
            :
            leftBase - leftOff
            :
            leftBase,
        top: rangeBoundingClientRect.top - yOffset - expand,
        width: rangeBoundingClientRect.width + expand * 2,
        height: rangeBoundingClientRect.height + expand * 2,
    };

    highlightBounding.style.setProperty("width", `${highlightBounding.rect.width * scale}px`, "important");
    highlightBounding.style.setProperty("height", `${highlightBounding.rect.height * scale}px`, "important");
    highlightBounding.style.setProperty("min-width", highlightBounding.style.width, "important");
    highlightBounding.style.setProperty("min-height", highlightBounding.style.height, "important");
    highlightBounding.style.setProperty("left", `${highlightBounding.rect.left * scale}px`, "important");
    highlightBounding.style.setProperty("top", `${highlightBounding.rect.top * scale}px`, "important");
    highlightParent.append(highlightBounding);


    // highlightsContainer.append(highlightParent);
    return highlightParent;
}
