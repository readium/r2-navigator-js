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

import { CLASS_HIGHLIGHT_CONTOUR, CLASS_HIGHLIGHT_CONTOUR_MARGIN, ID_HIGHLIGHTS_CONTAINER, CLASS_HIGHLIGHT_CONTAINER, CLASS_HIGHLIGHT_CURSOR2, CLASS_HIGHLIGHT_COMMON, CLASS_HIGHLIGHT_MARGIN, CLASS_HIGHLIGHT_HOVER } from "../../common/styles";

import { isRTL } from "./readium-css";

// import offset from "@flatten-js/polygon-offset";
import {
Polygon,
Box,
BooleanOperations,
Point,
Face,
ORIENTATION,
// Edge,
// Segment,
} from "@flatten-js/core";
const { unify } = BooleanOperations;

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

//     const rgb = Math.round(0xffffff * Math.random());
//     // tslint:disable-next-line:no-bitwise
//     const r = rgb >> 16;
//     // tslint:disable-next-line:no-bitwise
//     const g = rgb >> 8 & 255;
//     // tslint:disable-next-line:no-bitwise
//     const b = rgb & 255;
// rgb(${r}, ${g}, ${b});

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

interface IWithRect {
    rect: IRectSimple;
    scale: number;
    // xOffset: number;
    // yOffset: number;
}
interface IHTMLDivElementWithRect extends HTMLDivElement, IWithRect {
}

interface IWithPolygon {
    polygon: Polygon;
}
const SVG_XML_NAMESPACE = "http://www.w3.org/2000/svg";
// interface ISVGRectElementWithRect extends SVGRectElement, IWithRect {
// }
// interface ISVGLineElementWithRect extends SVGLineElement, IWithRect {
// }
interface ISVGElementWithPolygon extends SVGSVGElement, IWithPolygon {
}

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

    const scale = 1 / ((win.READIUM2 && win.READIUM2.isFixedLayout) ? win.READIUM2.fxlViewportScale : 1);

    let hit = false;
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

        let highlightFragment = highlightParent.firstElementChild;
        while (highlightFragment) {
            if (highlightFragment.namespaceURI === SVG_XML_NAMESPACE) {

                const svg = highlightFragment as ISVGElementWithPolygon;
                hit = svg.polygon.contains(new Point((x - xOffset) * scale, (y - yOffset) * scale));
                if (hit) {
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

    let highlightContainer = _highlightsContainer.firstElementChild;
    while (highlightContainer) {
        if (!foundElement || foundElement !== highlightContainer) {
            highlightContainer.classList.remove(CLASS_HIGHLIGHT_HOVER);
        }

        // const id = highlightContainer.id || highlightContainer.getAttribute("id");
        // const highlight = id ? _highlights.find((h) => h.id === id) : undefined;
        // const drawUnderline = highlight?.drawType === HighlightDrawTypeUnderline;
        // const drawStrikeThrough = highlight?.drawType === HighlightDrawTypeStrikethrough;
        // const doDrawMargin = highlight ? drawMargin(highlight) : false;

        highlightContainer = highlightContainer.nextElementSibling;
    }

    if (!hit) { // !foundHighlight || !foundElement

        // documant.documentElement.classList.remove(CLASS_HIGHLIGHT_CURSOR1);
        documant.documentElement.classList.remove(CLASS_HIGHLIGHT_CURSOR2);
        return;
    }

    if (foundElement && foundHighlight?.pointerInteraction) {

        if (isMouseMove) {
            foundElement.classList.add(CLASS_HIGHLIGHT_HOVER);

            // const doDrawMargin = drawMargin(foundHighlight);
            // documant.documentElement.classList.add(doDrawMargin ? CLASS_HIGHLIGHT_CURSOR1 : CLASS_HIGHLIGHT_CURSOR2);
            documant.documentElement.classList.add(CLASS_HIGHLIGHT_CURSOR2);

        } else if (ev.type === "mouseup" || ev.type === "click") {
            // documant.documentElement.classList.remove(CLASS_HIGHLIGHT_CURSOR1);
            documant.documentElement.classList.remove(CLASS_HIGHLIGHT_CURSOR2);

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

    const drawUnderline = highlight.drawType === HighlightDrawTypeUnderline;
    const drawStrikeThrough = highlight.drawType === HighlightDrawTypeStrikethrough;

    const paginated = isPaginated(documant);

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

    const doNotMergeHorizontallyAlignedRects = drawUnderline || drawStrikeThrough;

    const rangeClientRects = range.getClientRects();
    const clientRects =
        // doNotMergeHorizontallyAlignedRects ? rangeClientRects :
        getClientRectsNoOverlap_(rangeClientRects, doNotMergeHorizontallyAlignedRects, vertical, highlight.expand ? highlight.expand : 0);

    // let highlightAreaSVGDocFrag: DocumentFragment | undefined;
    // const roundedCorner = 3;

    const underlineThickness = 3;
    const strikeThroughLineThickness = 4;

    // const rangeBoundingClientRect = range.getBoundingClientRect();

    const bodyWidth = parseInt(bodyComputedStyle.width, 10);
    const paginatedTwo = paginated && isTwoPageSpread();
    const paginatedWidth = scrollElement.clientWidth / (paginatedTwo ? 2 : 1);
    const paginatedOffset = (paginatedWidth - bodyWidth) / 2 + parseInt(bodyComputedStyle.paddingLeft, 10);

    const gap = 4;
    const boxesNoGapExpanded = [];
    const boxesGapExpanded = [];

    for (const clientRect of clientRects) {

        const rect = {
            height: clientRect.height,
            left: clientRect.left - xOffset,
            top: clientRect.top - yOffset,
            width: clientRect.width,
        };
        const w = rect.width * scale;
        const h = rect.height * scale;
        const x = rect.left * scale;
        const y = rect.top * scale;

        boxesGapExpanded.push(new Box(
            Number((x - gap).toPrecision(12)),
            Number((y - gap).toPrecision(12)),
            Number((x + w + gap).toPrecision(12)),
            Number((y + h + gap).toPrecision(12)),
        ));

        // boxesNoGapExpanded.push(new Box(
        //     Number((x).toPrecision(12)),
        //     Number((y).toPrecision(12)),
        //     Number((x + w).toPrecision(12)),
        //     Number((y + h).toPrecision(12)),
        // ));

        if (drawStrikeThrough) {
            const ww = (vertical ? strikeThroughLineThickness : rect.width) * scale;
            const hh = (vertical ? rect.height : strikeThroughLineThickness) * scale;
            const xx = (vertical ? (rect.left + (rect.width / 2) - (strikeThroughLineThickness / 2)) : rect.left) * scale;
            const yy = (vertical ? rect.top : (rect.top + (rect.height / 2) - (strikeThroughLineThickness / 2))) * scale;

            boxesNoGapExpanded.push(new Box(
                Number((xx).toPrecision(12)),
                Number((yy).toPrecision(12)),
                Number((xx + ww).toPrecision(12)),
                Number((yy + hh).toPrecision(12)),
            ));

        } else { // drawStrikeThrough

            if (drawUnderline) {
                const ww = (vertical ? underlineThickness : rect.width) * scale;
                const hh = (vertical ? rect.height : underlineThickness) * scale;
                const xx = (vertical ? (rect.left - (underlineThickness / 2)) : rect.left) * scale;
                const yy = (vertical ? rect.top : (rect.top + rect.height - (underlineThickness / 2))) * scale;

                boxesNoGapExpanded.push(new Box(
                    Number((xx).toPrecision(12)),
                    Number((yy).toPrecision(12)),
                    Number((xx + ww).toPrecision(12)),
                    Number((yy + hh).toPrecision(12)),
                ));
            } else {
                boxesNoGapExpanded.push(new Box(
                    Number((x).toPrecision(12)),
                    Number((y).toPrecision(12)),
                    Number((x + w).toPrecision(12)),
                    Number((y + h).toPrecision(12)),
                ));
            }
        }
    }

    const polygonCountourUnionPoly = boxesGapExpanded.reduce((previous, current) => unify(previous, new Polygon(current)), new Polygon());

    Array.from(polygonCountourUnionPoly.faces).forEach((face: Face) => {
        if (face.orientation() !== ORIENTATION.CCW) {
            if (IS_DEV) {
                console.log("--HIGH WEBVIEW-- removing polygon clockwise face / inner hole (contour))");
            }
            polygonCountourUnionPoly.deleteFace(face);
        }
    });

    let polygonSurface: Polygon | Polygon[] | undefined;
    if (doNotMergeHorizontallyAlignedRects) {
        const singleSVGPath = true;
        if (singleSVGPath) {
            polygonSurface = new Polygon();
            for (const box of boxesNoGapExpanded) {
                polygonSurface.addFace(box);
            }
        } else {
            polygonSurface = [];
            for (const box of boxesNoGapExpanded) {
                const poly = new Polygon();
                poly.addFace(box);
                polygonSurface.push(poly);
            }
        }
    } else {
        polygonSurface = boxesNoGapExpanded.reduce((previous, current) => unify(previous, new Polygon(current)), new Polygon());

        Array.from(polygonSurface.faces).forEach((face: Face) => {
            if (face.orientation() !== ORIENTATION.CCW) {
                if (IS_DEV) {
                    console.log("--HIGH WEBVIEW-- removing polygon clockwise face / inner hole (surface))");
                }
                (polygonSurface as Polygon).deleteFace(face);
            }
        });
    }

    // const offsetPolygon = offset(polygonCountour, -gap);

    // const highlightAreaSVGDocFrag = documant.createDocumentFragment();
    // highlightAreaSVGDocFrag.appendChild(highlightAreaSVGRect);
    // const highlightAreaSVGG = documant.createElementNS(SVG_XML_NAMESPACE, "g");
    // highlightAreaSVGG.appendChild(highlightAreaSVGDocFrag);
    const highlightAreaSVG = documant.createElementNS(SVG_XML_NAMESPACE, "svg") as ISVGElementWithPolygon;
    highlightAreaSVG.setAttribute("class", `${CLASS_HIGHLIGHT_COMMON} ${CLASS_HIGHLIGHT_CONTOUR}`);

    // highlightAreaSVG.polygon = polygonSurface;
    highlightAreaSVG.polygon = polygonCountourUnionPoly; // TODO: gap expansion too generous for hit testing?

    // highlightAreaSVG.append((new DOMParser()​​.parseFromString(`<svg xmlns="${SVG_XML_NAMESPACE}">${polys.svg()}</svg>`, "image/svg+xml")).firstChild);
    highlightAreaSVG.innerHTML =
    (
    Array.isArray(polygonSurface)
    ?
    polygonSurface.reduce((prev, cur) => {
        return prev + cur.svg({
            fill: `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})`,
            fillRule: "evenodd",
            stroke: "transparent",
            strokeWidth: 1,
            fillOpacity: 1,
            className: undefined,
            // r: 4,
        });
    }, "")
    :
    polygonSurface.svg({
        fill: `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})`,
        fillRule: "evenodd",
        stroke: "transparent",
        strokeWidth: 1,
        fillOpacity: 1,
        className: undefined,
        // r: 4,
    })
    )
    +
    polygonCountourUnionPoly.svg({
        fill: "transparent",
        fillRule: "evenodd",
        stroke: "transparent",
        strokeWidth: 1,
        fillOpacity: 1,
        className: undefined,
        // r: 4,
    })
    ;

    highlightParent.append(highlightAreaSVG);

    // const boxes = Array.from(polygon.edges).map((edge: Edge) => {
    //     const shape = edge.shape as Segment;
    //     const ps = shape.ps as Point;
    //     const pe = shape.pe as Point;
    //     return new Box(
    //         Math.min(ps.x, pe.x),
    //         Math.min(ps.y, pe.y),
    //         Math.max(ps.x, pe.x),
    //         Math.max(ps.y, pe.y),
    //     );
    // });
    // // box.xmin / box.ymin
    // // box.width / box.height

    if (doDrawMargin && highlight.pointerInteraction) {
        const MARGIN_MARKER_THICKNESS = 14 * (win.READIUM2.isFixedLayout ? scale : 1);
        const MARGIN_MARKER_OFFSET = 6 * (win.READIUM2.isFixedLayout ? scale : 1);
        const paginatedOffset_ = paginatedOffset - MARGIN_MARKER_OFFSET - MARGIN_MARKER_THICKNESS;

        const polygonCountourMarginBoxes = Array.from(polygonCountourUnionPoly.faces).map((face: Face) => {
            const b = face.box;
            const left =
                // ----
                vertical ?
                b.xmin :
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
                    Math.floor((b.xmin) / paginatedWidth) * paginatedWidth
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
                );
            const top =
                vertical
                ?
                parseInt(bodyComputedStyle.paddingTop, 10) - MARGIN_MARKER_THICKNESS - MARGIN_MARKER_OFFSET
                :
                b.ymin;
            const width = vertical ? b.width : MARGIN_MARKER_THICKNESS;
            const height = vertical ? MARGIN_MARKER_THICKNESS : b.height;

            return new Box(left, top, left + width, top + height);
        });
        const polygonMarginUnionPoly = polygonCountourMarginBoxes.reduce((previous, current) => unify(previous, new Polygon(current)), new Polygon());

        Array.from(polygonMarginUnionPoly.faces).forEach((face: Face) => {
            if (face.orientation() !== ORIENTATION.CCW) {
                if (IS_DEV) {
                    console.log("--HIGH WEBVIEW-- removing polygon clockwise face / inner hole (margin))");
                }
                (polygonMarginUnionPoly as Polygon).deleteFace(face);
            }
        });

        const highlightMarginSVG = documant.createElementNS(SVG_XML_NAMESPACE, "svg") as ISVGElementWithPolygon;
        highlightMarginSVG.setAttribute("class", `${CLASS_HIGHLIGHT_COMMON} ${CLASS_HIGHLIGHT_CONTOUR_MARGIN}`);
        highlightMarginSVG.polygon = polygonMarginUnionPoly;
        highlightMarginSVG.innerHTML = polygonMarginUnionPoly.svg({
            fill: `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})`,
            fillRule: "evenodd",
            stroke: "transparent",
            strokeWidth: 0,
            fillOpacity: 1,
            className: undefined,
            // r: 4,
        });

        highlightParent.append(highlightMarginSVG);
    }

    return highlightParent;
}
