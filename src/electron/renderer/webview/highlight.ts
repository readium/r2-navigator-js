// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { debounce } from "debounce";

import { isPaginated } from "../../common/readium-css-inject";
import { ISelectionInfo } from "../../common/selection";
import { convertRangeInfo } from "./selection";
import { IElectronWebviewTagWindow } from "./state";

// import { isRTL } from './readium-css';

// const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

export const ID_HIGHLIGHTS_CONTAINER = "R2_ID_HIGHLIGHTS_CONTAINER";
export const CLASS_HIGHLIGHT_CONTAINER = "R2_CLASS_HIGHLIGHT_CONTAINER";
export const CLASS_HIGHLIGHT_AREA = "R2_CLASS_HIGHLIGHT_AREA";

const DEFAULT_BACKGROUND_COLOR = "rgba(0, 0, 255, 0.30)";

interface IHighlight {
    id: string;
    selectionInfo: ISelectionInfo;
    color: string;
}

const _highlights: IHighlight[] = [];

let _highlightsContainer: HTMLElement | null;
function ensureHighlightsContainer(documant: Document): HTMLElement {
    if (_highlightsContainer) {
        return _highlightsContainer;
    }
    _highlightsContainer = documant.createElement("div");
    _highlightsContainer.setAttribute("id", ID_HIGHLIGHTS_CONTAINER);
    _highlightsContainer.style.setProperty("pointer-events", "none");
    documant.body.append(_highlightsContainer);
    // documant.documentElement.append(_highlightsContainer);
    return _highlightsContainer;
}

export function destroyAllhighlights(documant: Document) {
    // _highlights.forEach((highlight) => {
    //     destroyHighlight(highlight.id);
    // });
    // for (const highlight of _highlights) {
    //     destroyHighlight(highlight.id);
    // }
    // for (let i = _highlights.length - 1; i >= 0; i--) {
    //     const highlight = _highlights[i];
    //     destroyHighlight(highlight.id);
    // }
    // for (const highlight of _highlights) {
    //     const highlightContainer = documant.getElementById(highlight.id);
    //     if (highlightContainer) {
    //         highlightContainer.remove();
    //     }
    // }
    if (_highlightsContainer) {
        _highlightsContainer.remove();
        _highlightsContainer = null;
        ensureHighlightsContainer(documant);
    }
    _highlights.splice(0, _highlights.length);
}

export function destroyHighlight(documant: Document, id: string) {
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

export function recreateAllHighlightsRaw(win: IElectronWebviewTagWindow) {
    // for (const highlight of _highlights) {
    //     const highlightContainer = win.document.getElementById(highlight.id);
    //     if (highlightContainer) {
    //         highlightContainer.remove();
    //     }
    // }
    if (_highlightsContainer) {
        _highlightsContainer.remove();
        _highlightsContainer = null;
        ensureHighlightsContainer(win.document);
    }
    for (const highlight of _highlights) {
        createHighlightDom(win, highlight);
    }
}

export const recreateAllHighlightsDebounced = debounce((win: IElectronWebviewTagWindow) => {
    recreateAllHighlightsRaw(win);
}, 250);

export function createHighlight(
    win: IElectronWebviewTagWindow,
    selectionInfo: ISelectionInfo,
    color: string | undefined): string {

    // tslint:disable-next-line:no-string-literal
    console.log("Chromium: " + process.versions["chrome"]);

    // const unique = new Buffer(JSON.stringify(selectionInfo.rangeInfo, null, "")).toString("base64");
    // tslint:disable-next-line:max-line-length
    const unique = new Buffer(`${selectionInfo.rangeInfo.cfi}${selectionInfo.rangeInfo.startContainerElementCssSelector}${selectionInfo.rangeInfo.startContainerChildTextNodeIndex}${selectionInfo.rangeInfo.startOffset}${selectionInfo.rangeInfo.endContainerElementCssSelector}${selectionInfo.rangeInfo.endContainerChildTextNodeIndex}${selectionInfo.rangeInfo.endOffset}`).toString("base64");
    const id = "R2_HIGHLIGHT_" + unique.replace(/\+/, "_").replace(/=/, "-").replace(/\//, ".");

    destroyHighlight(win.document, id);

    const highlight: IHighlight = {
        color: color ? color : DEFAULT_BACKGROUND_COLOR,
        id,
        selectionInfo,
    };
    _highlights.push(highlight);

    createHighlightDom(win, highlight);

    return id;
}

function createHighlightDom(win: IElectronWebviewTagWindow, highlight: IHighlight): HTMLDivElement | undefined {

    const documant = win.document;

    const range = convertRangeInfo(documant, highlight.selectionInfo.rangeInfo);
    if (!range) {
        return undefined;
    }

    // checkRangeFix(documant);

    const highlightsContainer = ensureHighlightsContainer(documant);

    const highlightContainer = documant.createElement("div");
    highlightContainer.setAttribute("id", highlight.id);
    highlightContainer.setAttribute("class", CLASS_HIGHLIGHT_CONTAINER);
    highlightsContainer.append(highlightContainer);

    const paginated = isPaginated(documant);
    // const rtl = isRTL();

    // Resize Sensor sets body position to "relative" (default static),
    // which may breaks things!
    // (e.g. highlights CSS absolute/fixed positioning)
    // Also note that ReadiumCSS default to (via stylesheet :root):
    // documant.documentElement.style.position = "relative";
    documant.body.style.position = "relative";
    // documant.body.style.setProperty("position", "relative !important");

    // const docStyle = (documant.defaultView as Window).getComputedStyle(documant.documentElement);
    // const bodyStyle = (documant.defaultView as Window).getComputedStyle(documant.body);
    // const marginLeft = bodyStyle.getPropertyValue("margin-left");
    // console.log("marginLeft: " + marginLeft);
    // const marginTop = bodyStyle.getPropertyValue("margin-top");
    // console.log("marginTop: " + marginTop);

    const bodyRect = documant.body.getBoundingClientRect();
    // console.log("==== bodyRect:");
    // console.log("width: " + bodyRect.width);
    // console.log("height: " + bodyRect.height);
    // console.log("top: " + bodyRect.top);
    // console.log("bottom: " + bodyRect.bottom);
    // console.log("left: " + bodyRect.left);
    // console.log("right: " + bodyRect.right);

    // const xOffset = paginated ? (bodyRect.left - parseInt(marginLeft, 10)) : bodyRect.left;
    // const yOffset = paginated ? (bodyRect.top - parseInt(marginTop, 10)) : bodyRect.top;

    const xOffset = paginated ? (-documant.body.scrollLeft) : bodyRect.left;
    const yOffset = paginated ? (-documant.body.scrollTop) : bodyRect.top;

    const scale = 1 / ((win.READIUM2 && win.READIUM2.isFixedLayout) ? win.READIUM2.fxlViewportScale : 1);

    // console.log("documant.body.scrollLeft: " + documant.body.scrollLeft);
    // console.log("documant.body.scrollTop: " + documant.body.scrollTop);

    // if (IS_DEV) { // && win.READIUM2.DEBUG_VISUALS
    //     const rangeRect = range.getBoundingClientRect();

    //     const mainHighlightArea = documant.createElement("div");
    //     mainHighlightArea.setAttribute("class", CLASS_HIGHLIGHT_AREA);
    //     // const color = "rgba(255, 0, 0, 0.60)";
    //     // mainHighlightArea.setAttribute("style", `background-color: ${color} !important`);
    // tslint:disable-next-line:max-line-length
    //     mainHighlightArea.setAttribute("style", `outline-color: blue; outline-style: solid; outline-width: 1px; outline-offset: 2px;`);
    //     mainHighlightArea.style.position = paginated ? "fixed" : "absolute";
    //     mainHighlightArea.style.width = `${rangeRect.width * scale}px`;
    //     mainHighlightArea.style.height = `${rangeRect.height * scale}px`;
    //     mainHighlightArea.style.left = `${(rangeRect.left - xOffset)  * scale}px`;
    //     mainHighlightArea.style.top = `${(rangeRect.top - yOffset)  * scale}px`;
    //     highlightContainer.append(mainHighlightArea);

    //     const rangeRectFix = getBoundingClientRectFix(range);
    //     if (rangeRectFix &&
    //         (rangeRectFix.top !== rangeRect.top ||
    //         rangeRectFix.bottom !== rangeRect.bottom ||
    //         rangeRectFix.left !== rangeRect.left ||
    //         rangeRectFix.right !== rangeRect.right ||
    //         rangeRectFix.width !== rangeRect.width ||
    //         rangeRectFix.height !== rangeRect.height)) {

    //         console.log("######################################");
    //         console.log("==== rangeRect:");
    //         console.log("width: " + rangeRect.width);
    //         console.log("height: " + rangeRect.height);
    //         console.log("top: " + rangeRect.top);
    //         console.log("bottom: " + rangeRect.bottom);
    //         console.log("left: " + rangeRect.left);
    //         console.log("right: " + rangeRect.right);
    //         console.log("--------------------------");
    //         console.log("==== rangeRectFix:");
    //         console.log("width: " + rangeRectFix.width);
    //         console.log("height: " + rangeRectFix.height);
    //         console.log("top: " + rangeRectFix.top);
    //         console.log("bottom: " + rangeRectFix.bottom);
    //         console.log("left: " + rangeRectFix.left);
    //         console.log("right: " + rangeRectFix.right);

    //         const mainHighlightAreaFix = documant.createElement("div");
    //         mainHighlightAreaFix.setAttribute("class", CLASS_HIGHLIGHT_AREA);
    //         // const colorFix = "rgba(255, 0, 0, 0.60)";
    //         // mainHighlightAreaFix.setAttribute("style", `background-color: ${colorFix} !important`);
    // tslint:disable-next-line:max-line-length
    //         mainHighlightAreaFix.setAttribute("style", `outline-color: red; outline-style: solid; outline-width: 1px; outline-offset: 4px;`);
    //         mainHighlightAreaFix.style.position = paginated ? "fixed" : "absolute";
    //         mainHighlightAreaFix.style.width = `${rangeRectFix.width * scale}px`;
    //         mainHighlightAreaFix.style.height = `${rangeRectFix.height * scale}px`;
    //         mainHighlightAreaFix.style.left = `${(rangeRectFix.left - xOffset)  * scale}px`;
    //         mainHighlightAreaFix.style.top = `${(rangeRectFix.top - yOffset)  * scale}px`;
    //         highlightContainer.append(mainHighlightAreaFix);
    //     }
    //     console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    //     console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    //     console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    // }

    // const clientRects = range.getClientRects(); // ClientRectList | DOMRectList
    const clientRects = getClientRectsNoOverlap(range);
    for (const clientRect of clientRects) {
        const highlightArea = documant.createElement("div");
        highlightArea.setAttribute("class", CLASS_HIGHLIGHT_AREA);
        // tslint:disable-next-line:max-line-length
        const extra = ""; // (IS_DEV && win.READIUM2.DEBUG_VISUALS) ? "outline-color: magenta; outline-style: solid; outline-width: 1px; outline-offset: 1px;" : ""; // box-shadow: inset 0 0 0 1px #600;
        // tslint:disable-next-line:max-line-length
        highlightArea.setAttribute("style", `background-color: ${highlight.color} !important; ${extra}`);
        // tslint:disable-next-line:max-line-length
        // highlightArea.setAttribute("style", `outline-color: magenta; outline-style: solid; outline-width: 1px; outline-offset: -1px;`);
        highlightArea.style.position = paginated ? "fixed" : "absolute";
        highlightArea.style.width = `${clientRect.width * scale}px`;
        highlightArea.style.height = `${clientRect.height * scale}px`;
        highlightArea.style.left = `${(clientRect.left - xOffset)  * scale}px`;
        highlightArea.style.top = `${(clientRect.top - yOffset)  * scale}px`;
        highlightContainer.append(highlightArea);
    }

    // console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    // console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    // console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");

    // let i = -1;
    // const clientRectsFix = getClientRectsFix(range);
    // const debugAll = clientRects.length !== clientRectsFix.length;
    // for (const clientRectFix of clientRectsFix) {
    //     i++;
    //     if (debugAll ||
    //         (clientRectFix.top !== clientRects[i].top ||
    //         clientRectFix.bottom !== clientRects[i].bottom ||
    //         clientRectFix.left !== clientRects[i].left ||
    //         clientRectFix.right !== clientRects[i].right ||
    //         clientRectFix.width !== clientRects[i].width ||
    //         clientRectFix.height !== clientRects[i].height)) {
    //         console.log("######################################");
    //         console.log("==== clientRect: " + i + " / " + clientRects.length);
    //         console.log("width: " + clientRects[i].width);
    //         console.log("height: " + clientRects[i].height);
    //         console.log("top: " + clientRects[i].top);
    //         console.log("bottom: " + clientRects[i].bottom);
    //         console.log("left: " + clientRects[i].left);
    //         console.log("right: " + clientRects[i].right);
    //         console.log("--------------------------");
    //         console.log("==== clientRectFix: " + i + " / " + clientRectsFix.length);
    //         console.log("width: " + clientRectFix.width);
    //         console.log("height: " + clientRectFix.height);
    //         console.log("top: " + clientRectFix.top);
    //         console.log("bottom: " + clientRectFix.bottom);
    //         console.log("left: " + clientRectFix.left);
    //         console.log("right: " + clientRectFix.right);
    //     }
    //     const highlightAreaFix = documant.createElement("div");
    //     highlightAreaFix.setAttribute("class", CLASS_HIGHLIGHT_AREA);
    // tslint:disable-next-line:max-line-length
    //     highlightAreaFix.setAttribute("style", `background-color: ${highlight.color} !important`); // ; box-shadow: inset 0 0 0 1px #600;
    // tslint:disable-next-line:max-line-length
    //     // highlightAreaFix.setAttribute("style", `outline-color: orange; outline-style: solid; outline-width: 1px; outline-offset: -2px;`);
    //     highlightAreaFix.style.position = paginated ? "fixed" : "absolute";
    //     highlightAreaFix.style.width = `${clientRectFix.width * scale}px`;
    //     highlightAreaFix.style.height = `${clientRectFix.height * scale}px`;
    //     highlightAreaFix.style.left = `${(clientRectFix.left - xOffset)  * scale}px`;
    //     highlightAreaFix.style.top = `${(clientRectFix.top - yOffset)  * scale}px`;
    //     highlightContainer.append(highlightAreaFix);
    // }

    return highlightContainer;
}

// https://github.com/edg2s/rangefix/blob/master/rangefix.js
// function checkRangeFix(documant: Document) {

//     const p = documant.createElement("p");
//     const span = documant.createElement("span");
//     const t1 = documant.createTextNode("aa");
//     const t2 = documant.createTextNode("aa");
//     const img = documant.createElement("img");
//     img.setAttribute("src", "#null");
//     p.appendChild(t1);
//     p.appendChild(span);
//     span.appendChild(img);
//     span.appendChild(t2);
//     documant.body.appendChild( p );

//     const range = new Range(); // documant.createRange();
//     range.setStart(t1, 1);
//     range.setEnd(span, 0);

//     let getBoundingClientRect = range.getClientRects().length > 1;
//     let getClientRects = getBoundingClientRect;
//     console.log("BUG 1: " + getClientRects);

//     if (!getClientRects) {
//         range.setEnd(t2, 1);
//         getBoundingClientRect = range.getClientRects().length === 2;
//         getClientRects = getBoundingClientRect;
//         console.log("BUG 2: " + getClientRects);
//     }

//     if (!getBoundingClientRect) {
//         // Safari doesn't return a valid bounding rect for collapsed ranges
//         // Equivalent to range.collapse( true ) which isn't well supported
//         range.setEnd(range.startContainer, range.startOffset);
//         const boundingRect = range.getBoundingClientRect();
//         getBoundingClientRect = boundingRect.top === 0 && boundingRect.left === 0;
//         console.log("BUG 3: " + getBoundingClientRect);
//     }

//     documant.body.removeChild(p);
// }

// interface DOMRect extends DOMRectReadOnly {
//     height: number;
//     width: number;
//     x: number;
//     y: number;
// }

// interface ClientRect {
//     bottom: number;
//     readonly height: number;
//     left: number;
//     right: number;
//     top: number;
//     readonly width: number;
// }

// https://github.com/GoogleChrome/lighthouse/blob/master/lighthouse-core/lib/rect-helpers.js
// https://github.com/GoogleChrome/lighthouse/blob/master/lighthouse-core/lib/tappable-rects.js
function almostEqual(a: number, b: number, tolerance: number) {
    return Math.abs(a - b) <= tolerance;
}
function rectContainsPoint(rect: ClientRect | DOMRect, x: number, y: number, tolerance: number) {
    return (rect.left < x || almostEqual(rect.left, x, tolerance)) &&
        (rect.right > x || almostEqual(rect.right, x, tolerance)) &&
        (rect.top < y || almostEqual(rect.top, y, tolerance)) &&
        (rect.bottom > y || almostEqual(rect.bottom, y, tolerance));
}
function rectContains(rect1: ClientRect | DOMRect, rect2: ClientRect | DOMRect, tolerance: number) {
    return (
        rectContainsPoint(rect1, rect2.left, rect2.top, tolerance) && // top left corner
        rectContainsPoint(rect1, rect2.right, rect2.top, tolerance) && // top right corner
        rectContainsPoint(rect1, rect2.left, rect2.bottom, tolerance) && // bottom left corner
        rectContainsPoint(rect1, rect2.right, rect2.bottom, tolerance) // bottom right corner
    );
}
function getBoundingRect(rect1: ClientRect | DOMRect, rect2: ClientRect | DOMRect): ClientRect | DOMRect {
    const left = Math.min(rect1.left, rect2.left);
    const right = Math.max(rect1.right, rect2.right);
    const top = Math.min(rect1.top, rect2.top);
    const bottom = Math.max(rect1.bottom, rect2.bottom);
    return {
        bottom,
        height: bottom - top,
        left,
        right,
        top,
        width: right - left,
    };
}
// tslint:disable-next-line:max-line-length
function rectsTouchOrOverlap(rect1: ClientRect | DOMRect, rect2: ClientRect | DOMRect, tolerance: number) {
    return (
        (rect1.left < rect2.right || (tolerance >= 0 && almostEqual(rect1.left, rect2.right, tolerance))) &&
        (rect2.left < rect1.right || (tolerance >= 0 && almostEqual(rect2.left, rect1.right, tolerance))) &&
        (rect1.top < rect2.bottom || (tolerance >= 0 && almostEqual(rect1.top, rect2.bottom, tolerance))) &&
        (rect2.top < rect1.bottom || (tolerance >= 0 && almostEqual(rect2.top, rect1.bottom, tolerance)))
    );
}
function mergeTouchingRects(rects: ClientRect[] | DOMRect[], tolerance: number): ClientRect[] | DOMRect[] {
    for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
            const rect1 = rects[i];
            const rect2 = rects[j];

            const rectsLineUpHorizontally =
                almostEqual(rect1.top, rect2.top, tolerance) &&
                almostEqual(rect1.bottom, rect2.bottom, tolerance);

            const rectsLineUpVertically =
                almostEqual(rect1.left, rect2.left, tolerance) &&
                almostEqual(rect1.right, rect2.right, tolerance);

            const canMerge =
                rectsTouchOrOverlap(rect1, rect2, tolerance) &&
                (rectsLineUpHorizontally || rectsLineUpVertically);

            if (canMerge) {
                console.log("CLIENT RECT: merging two into one");
                const newRects = rects.filter((rect) => {
                    return rect !== rect1 && rect !== rect2;
                });
                const replacementClientRect = getBoundingRect(rect1, rect2);
                newRects.push(replacementClientRect);

                return mergeTouchingRects(newRects, tolerance);
            }
        }
    }

    return rects;
}
function getClientRectsNoOverlap(range: Range): ClientRect[] | DOMRect[] {

    const tolerance = 1;
    const minW = 5;
    const minH = 10;

    const originalRects = range.getClientRects(); // Array.from(range.getClientRects());

    const rectsToKeep = new Set(originalRects);
    // const rectsToKeep = Array.from(originalRects);

    for (const rect of originalRects) {
        const bigEnough = rect.width > 1 && rect.height > 1;
        if (!bigEnough) {
            console.log("CLIENT RECT: remove tiny");
            rectsToKeep.delete(rect);
            // rectsToKeep.splice(rectsToKeep.indexOf(rect), 1);
            continue;
        }
        for (const possiblyContainingRect of originalRects) {
            if (rect === possiblyContainingRect) {
                continue;
            }
            if (!rectsToKeep.has(possiblyContainingRect)) {
            // if (rectsToKeep.indexOf(possiblyContainingRect) < 0) {
                continue;
            }
            if (rectContains(possiblyContainingRect, rect, tolerance)) {
                console.log("CLIENT RECT: remove contained");
                rectsToKeep.delete(rect);
                // rectsToKeep.splice(rectsToKeep.indexOf(rect), 1);
                break;
            }
        }
    }

    // const rectsBigEnough = originalRects.filter((rect) => {
    //     return rect.width > 1 && rect.height > 1;
    // });
    // Array.prototype.push.apply(rects, rectsBigEnough);

    // const rects: ClientRect[] | DOMRect[] = [];
    // Array.prototype.push.apply(rects, Array.from(rectsToKeep));
    // // rects.push(...rectsToKeep);
    // return rects;

    const newRects = mergeTouchingRects(Array.from(rectsToKeep), tolerance);

    for (let j = newRects.length - 1; j >= 0; j--) {
        const rect = newRects[j];
        const bigEnough = rect.width > minW && rect.height > minH;
        if (!bigEnough) {
            if (j > 0) { // newRects.length > 1
                console.log("CLIENT RECT: remove small");
                newRects.splice(j, 1);
            } else {
                console.log("CLIENT RECT: remove small, but keep otherwise empty!");
                break;
            }
        }
    }

    const stillOverlapingRects = new Set();
    for (const rect1 of newRects) {
        for (const rect2 of newRects) {
            if (rect1 === rect2) {
                continue;
            }
            const has1 = stillOverlapingRects.has(rect1);
            const has2 = stillOverlapingRects.has(rect2);
            if (!has1 || !has2) {
                if (rectsTouchOrOverlap(rect1, rect2, -1)) { // negative tolerance for strict overlap test
                    if (!has1) {
                        stillOverlapingRects.add(rect1);
                    }
                    if (!has2) {
                        stillOverlapingRects.add(rect2);
                    }
                }
            }
        }
    }
    if (stillOverlapingRects.size) {
        console.log(`CLIENT RECT: remaining overlaps ${stillOverlapingRects.size}`);
        for (const rect of stillOverlapingRects) {
            // tslint:disable-next-line:max-line-length
            console.log(`CLIENT RECT: remaining overlaps TOP:${rect.top} BOTTOM:${rect.bottom} LEFT:${rect.left} RIGHT:${rect.right} WIDTH:${rect.width} HEIGHT:${rect.height}`);
        }
    }

    console.log(`CLIENT RECT: reduced ${originalRects.length} --> ${newRects.length}`);
    return newRects;
}

// function getClientRectsFix(range: Range): ClientRect[] | DOMRect[] {

//     const rects: ClientRect[] | DOMRect[] = [];

//     let endContainer: Node | null = range.endContainer;
//     let endOffset: number = range.endOffset;
//     let partialRange = new Range();

//     while (endContainer && endContainer !== range.commonAncestorContainer) {
//         partialRange.setStart(endContainer, 0);
//         partialRange.setEnd(endContainer, endOffset);

//         Array.prototype.push.apply(rects, partialRange.getClientRects());

//         const parentNode: Node | null = endContainer.parentNode;
//         if (parentNode) {
//             endOffset = Array.prototype.indexOf.call(parentNode.childNodes, endContainer);
//         }
//         endContainer = parentNode;
//     }

//     if (endContainer) {
//         partialRange = range.cloneRange();
//         partialRange.setEnd(endContainer, endOffset);
//         Array.prototype.push.apply(rects, partialRange.getClientRects());
//     }

//     return rects;
// }

// function getBoundingClientRectFix(range: Range): ClientRect | DOMRect | undefined {

//     const rects = getClientRectsFix(range);
//     if (rects.length === 0) {
//         return undefined;
//     }

//     const nativeBoundingRect = range.getBoundingClientRect();
//     if (nativeBoundingRect.width === 0 && nativeBoundingRect.height === 0) {
//         return rects[0];
//     }

//     let boundingRect: ClientRect | undefined;

//     for (const rect of rects) {
//         if (!boundingRect) {
//             boundingRect = {
//                 bottom: rect.bottom,
//                 height: rect.bottom - rect.top,
//                 left: rect.left,
//                 right: rect.right,
//                 top: rect.top,
//                 width: rect.right - rect.left,
//             };
//         } else {
//             boundingRect.left = Math.min(boundingRect.left, rect.left);
//             boundingRect.top = Math.min(boundingRect.top, rect.top);
//             boundingRect.right = Math.max(boundingRect.right, rect.right);
//             boundingRect.bottom = Math.max(boundingRect.bottom, rect.bottom);
//             (boundingRect as any).width = boundingRect.right - boundingRect.left;
//             (boundingRect as any).height = boundingRect.bottom - boundingRect.top;
//         }
//     }

//     return boundingRect;
// }
