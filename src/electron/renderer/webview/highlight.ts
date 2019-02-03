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

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

export const ID_HIGHLIGHTS_CONTAINER = "R2_ID_HIGHLIGHTS_CONTAINER";
export const CLASS_HIGHLIGHT_CONTAINER = "R2_CLASS_HIGHLIGHT_CONTAINER";
export const CLASS_HIGHLIGHT_AREA = "R2_CLASS_HIGHLIGHT_AREA";
export const CLASS_HIGHLIGHT_BOUNDING_AREA = "R2_CLASS_HIGHLIGHT_BOUNDING_AREA";

export interface IColor {
    red: number;
    green: number;
    blue: number;
}

const DEFAULT_BACKGROUND_COLOR_OPACITY = 0.1;
const ALT_BACKGROUND_COLOR_OPACITY = 0.2;
const DEFAULT_BACKGROUND_COLOR: IColor = {
    blue: 100,
    green: 50,
    red: 230,
};

interface IHighlight {
    id: string;
    selectionInfo: ISelectionInfo;
    color: IColor;
    pointerInteraction: boolean;
}

const _highlights: IHighlight[] = [];

interface IHTMLDivElementWithRect extends HTMLDivElement {
    rect: IRectSimple;
    scale: number;
    xOffset: number;
    yOffset: number;
}

function processMouseEvent(win: IElectronWebviewTagWindow, ev: MouseEvent) {
    const documant = win.document;

    // relative to fixed window top-left corner
    // (unlike pageX/Y which is relative to top-left rendered content area, subject to scrolling)
    const x = ev.clientX;
    const y = ev.clientY;

    // const highlightsContainer = documant.getElementById(`${ID_HIGHLIGHTS_CONTAINER}`);
    if (!_highlightsContainer) {
        return;
    }

    const paginated = isPaginated(documant);
    const bodyRect = documant.body.getBoundingClientRect();
    const xOffset = paginated ? (-documant.body.scrollLeft) : bodyRect.left;
    const yOffset = paginated ? (-documant.body.scrollTop) : bodyRect.top;

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
        const highlightFragments = highlightParent.querySelectorAll(`.${CLASS_HIGHLIGHT_AREA}`);
        for (const highlightFragment of highlightFragments) {
            const withRect = highlightFragment as IHTMLDivElementWithRect;
            // tslint:disable-next-line:max-line-length
            // console.log(`RECT: ${withRect.rect.left} | ${withRect.rect.top} // ${withRect.rect.width} | ${withRect.rect.height}`);

            const left = withRect.rect.left + (paginated ? withRect.xOffset : xOffset);
            const top = withRect.rect.top + (paginated ? withRect.yOffset : yOffset);
            if (x >= left &&
                x < (left + withRect.rect.width) &&
                y >= top &&
                y < (top + withRect.rect.height)
                ) {

                hit = true;
                break;
            }
        }
        if (hit) {
            foundHighlight = highlight;
            foundElement = highlightParent as IHTMLDivElementWithRect;
            break;
        }

        // hit = false;
        // const highlightBounding = highlightParent.querySelector(`.${CLASS_HIGHLIGHT_BOUNDING_AREA}`);
        // if (highlightBounding) {
        //     const highlightBoundingWithRect = highlightBounding as IHTMLDivElementWithRect;

        //     const left = highlightBoundingWithRect.rect.left + highlightBoundingWithRect.xOffset;
        //     const top = highlightBoundingWithRect.rect.top + highlightBoundingWithRect.yOffset;
        //     if (x >= left &&
        //         x < (left + highlightBoundingWithRect.rect.width) &&
        //         y >= top &&
        //         y < (top + highlightBoundingWithRect.rect.height)
        //         ) {

        //         hit = true;
        //     }
        // }
        // if (hit) {
        //     foundHighlight = highlight;
        //     foundElement = highlightParent as IHTMLDivElementWithRect;
        //     break;
        // }
    }
    if (!foundHighlight || !foundElement) {
        const highlightParents = _highlightsContainer.querySelectorAll(`.${CLASS_HIGHLIGHT_BOUNDING_AREA}`);
        for (const highlightParent of highlightParents) {
            (highlightParent as HTMLElement).style.outline = "none";
            (highlightParent as HTMLElement).style.backgroundColor = "transparent";
        }
        if (!win.READIUM2.DEBUG_VISUALS) {
            const allHighlightAreas = _highlightsContainer.querySelectorAll(`.${CLASS_HIGHLIGHT_AREA}`);
            for (const highlightArea of allHighlightAreas) {
                (highlightArea as HTMLElement).style.outline = "none";
            }
        }
        return;
    }
    if (foundElement.getAttribute("data-click")) {
        if (ev.type === "mousemove") {
            if (!win.READIUM2.DEBUG_VISUALS) {
                // tslint:disable-next-line:max-line-length
                const foundElementHighlightAreas = Array.from(foundElement.querySelectorAll(`.${CLASS_HIGHLIGHT_AREA}`));
                const allHighlightAreas = _highlightsContainer.querySelectorAll(`.${CLASS_HIGHLIGHT_AREA}`);
                for (const highlightArea of allHighlightAreas) {
                    if (foundElementHighlightAreas.indexOf(highlightArea) < 0) {
                        (highlightArea as HTMLElement).style.outline = "none";
                    }
                }
                for (const highlightArea of foundElementHighlightAreas) {
                    // tslint:disable-next-line:max-line-length
                    (highlightArea as HTMLElement).style.outlineColor = `rgba(${foundHighlight.color.red}, ${foundHighlight.color.green}, ${foundHighlight.color.blue}, 1)`;
                    (highlightArea as HTMLElement).style.outlineStyle = "solid";
                    (highlightArea as HTMLElement).style.outlineWidth = "1px";
                    (highlightArea as HTMLElement).style.outlineOffset = "0px";
                }
            }
            const foundElementHighlightBounding = foundElement.querySelector(`.${CLASS_HIGHLIGHT_BOUNDING_AREA}`);
            const allHighlightBoundings = _highlightsContainer.querySelectorAll(`.${CLASS_HIGHLIGHT_BOUNDING_AREA}`);
            for (const highlightBounding of allHighlightBoundings) {
                if (!foundElementHighlightBounding || highlightBounding !== foundElementHighlightBounding) {
                    (highlightBounding as HTMLElement).style.outline = "none";
                    (highlightBounding as HTMLElement).style.backgroundColor = "transparent";
                }
            }
            if (foundElementHighlightBounding) {
                if (win.READIUM2.DEBUG_VISUALS) {
                    const opacity = ALT_BACKGROUND_COLOR_OPACITY;
                    // tslint:disable-next-line:max-line-length
                    // highlightBounding.setAttribute("style", `background-color: rgba(${foundHighlight.color.red}, ${foundHighlight.color.green}, ${foundHighlight.color.blue}, ${opacity}) !important;`);
                    // tslint:disable-next-line:max-line-length
                    (foundElementHighlightBounding as HTMLElement).style.backgroundColor = `rgba(${foundHighlight.color.red}, ${foundHighlight.color.green}, ${foundHighlight.color.blue}, ${opacity})`;
                    // tslint:disable-next-line:max-line-length
                    // (highlightBounding as HTMLElement).style.setProperty("background-color", `rgba(${foundHighlight.color.red}, ${foundHighlight.color.green}, ${foundHighlight.color.blue}, ${opacity})`);

                    // tslint:disable-next-line:max-line-length
                    (foundElementHighlightBounding as HTMLElement).style.outlineColor = `rgba(${foundHighlight.color.red}, ${foundHighlight.color.green}, ${foundHighlight.color.blue}, 1)`;
                    (foundElementHighlightBounding as HTMLElement).style.outlineStyle = "solid";
                    (foundElementHighlightBounding as HTMLElement).style.outlineWidth = "1px";
                    (foundElementHighlightBounding as HTMLElement).style.outlineOffset = "0px";
                }
            }
        } else if (ev.type === "click") {
            console.log("HIGHLIGHT CLICK: " + foundHighlight.id);
            console.log(JSON.stringify(foundHighlight, null, "  "));
        }
    }
}

let bodyEventListenersSet = false;
let _highlightsContainer: HTMLElement | null;
function ensureHighlightsContainer(win: IElectronWebviewTagWindow): HTMLElement {
    const documant = win.document;

    if (!_highlightsContainer) {

        if (!bodyEventListenersSet) {
            bodyEventListenersSet = true;

            // reminder: mouseenter/mouseleave do not bubble, so no event delegation
            documant.body.addEventListener("click", (ev: MouseEvent) => {
                processMouseEvent(win, ev);
            }, false);
            documant.body.addEventListener("mousemove", (ev: MouseEvent) => {
                processMouseEvent(win, ev);
            }, false);
        }

        _highlightsContainer = documant.createElement("div");
        _highlightsContainer.setAttribute("id", ID_HIGHLIGHTS_CONTAINER);
        _highlightsContainer.style.setProperty("pointer-events", "none");
        documant.body.append(_highlightsContainer);
        // documant.documentElement.append(_highlightsContainer);
    }
    return _highlightsContainer;
}

export function hideAllhighlights(_documant: Document) {
    // for (const highlight of _highlights) {
    //     const highlightContainer = documant.getElementById(highlight.id);
    //     if (highlightContainer) {
    //         highlightContainer.remove();
    //     }
    // }
    if (_highlightsContainer) {
        _highlightsContainer.remove();
        _highlightsContainer = null;
        // ensureHighlightsContainer(documant);
    }
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
    hideAllhighlights(documant);
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
    hideAllhighlights(win.document);
    for (const highlight of _highlights) {
        createHighlightDom(win, highlight);
    }
}

export const recreateAllHighlightsDebounced = debounce((win: IElectronWebviewTagWindow) => {
    recreateAllHighlightsRaw(win);
}, 500);

export function recreateAllHighlights(win: IElectronWebviewTagWindow) {
    hideAllhighlights(win.document);
    recreateAllHighlightsDebounced(win);
}

export function createHighlight(
    win: IElectronWebviewTagWindow,
    selectionInfo: ISelectionInfo,
    color: IColor | undefined,
    pointerInteraction: boolean): string {

    // tslint:disable-next-line:no-string-literal
    // console.log("Chromium: " + process.versions["chrome"]);

    // const unique = new Buffer(JSON.stringify(selectionInfo.rangeInfo, null, "")).toString("base64");
    // tslint:disable-next-line:max-line-length
    const unique = new Buffer(`${selectionInfo.rangeInfo.cfi}${selectionInfo.rangeInfo.startContainerElementCssSelector}${selectionInfo.rangeInfo.startContainerChildTextNodeIndex}${selectionInfo.rangeInfo.startOffset}${selectionInfo.rangeInfo.endContainerElementCssSelector}${selectionInfo.rangeInfo.endContainerChildTextNodeIndex}${selectionInfo.rangeInfo.endOffset}`).toString("base64");
    const id = "R2_HIGHLIGHT_" + unique.replace(/\+/, "_").replace(/=/, "-").replace(/\//, ".");

    destroyHighlight(win.document, id);

    const highlight: IHighlight = {
        color: color ? color : DEFAULT_BACKGROUND_COLOR,
        id,
        pointerInteraction,
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

    const paginated = isPaginated(documant);
    // const rtl = isRTL();

    // checkRangeFix(documant);

    const highlightsContainer = ensureHighlightsContainer(win);

    const highlightParent = documant.createElement("div") as IHTMLDivElementWithRect;
    highlightParent.setAttribute("id", highlight.id);
    highlightParent.setAttribute("class", CLASS_HIGHLIGHT_CONTAINER);
    highlightParent.style.setProperty("pointer-events", "none");
    if (highlight.pointerInteraction) {
        highlightParent.setAttribute("data-click", "1");
    }

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

    // const clientRects = range.getClientRects(); // ClientRectList | DOMRectList
    const clientRects = win.READIUM2.DEBUG_VISUALS ? range.getClientRects() : getClientRectsNoOverlap(range);

    for (const clientRect of clientRects) {
        const highlightArea = documant.createElement("div") as IHTMLDivElementWithRect;
        highlightArea.setAttribute("class", CLASS_HIGHLIGHT_AREA);

        let extra = "";
        if (win.READIUM2.DEBUG_VISUALS) {
            const rgb = Math.round(0xffffff * Math.random());
            // tslint:disable-next-line:no-bitwise
            const r = rgb >> 16;
            // tslint:disable-next-line:no-bitwise
            const g = rgb >> 8 & 255;
            // tslint:disable-next-line:no-bitwise
            const b = rgb & 255;
            // tslint:disable-next-line:max-line-length
            extra = `outline-color: rgb(${r}, ${g}, ${b}); outline-style: solid; outline-width: 1px; outline-offset: -1px;`;
            // box-shadow: inset 0 0 0 1px #600;
        }
        const opacity = DEFAULT_BACKGROUND_COLOR_OPACITY;
        // tslint:disable-next-line:max-line-length
        highlightArea.setAttribute("style", `background-color: rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity}) !important; ${extra}`);
        // tslint:disable-next-line:max-line-length
        // highlightArea.setAttribute("style", `outline-color: magenta; outline-style: solid; outline-width: 1px; outline-offset: -1px;`);
        highlightArea.style.setProperty("pointer-events", "none");
        highlightArea.style.position = paginated ? "fixed" : "absolute";
        highlightArea.scale = scale;
        highlightArea.xOffset = xOffset;
        highlightArea.yOffset = yOffset;
        highlightArea.rect = {
            height: clientRect.height,
            left: clientRect.left - xOffset,
            top: clientRect.top - yOffset,
            width: clientRect.width,
        };
        highlightArea.style.width = `${highlightArea.rect.width * scale}px`;
        highlightArea.style.height = `${highlightArea.rect.height * scale}px`;
        highlightArea.style.left = `${highlightArea.rect.left * scale}px`;
        highlightArea.style.top = `${highlightArea.rect.top * scale}px`;

        // if (highlight.pointerInteraction) {
        //     highlightArea.style.setProperty("pointer-events", "auto");
        // }

        highlightParent.append(highlightArea);
    }

    const rangeBoundingClientRect = range.getBoundingClientRect();
    const highlightBounding = documant.createElement("div") as IHTMLDivElementWithRect;
    highlightBounding.setAttribute("class", CLASS_HIGHLIGHT_BOUNDING_AREA);
    if (win.READIUM2.DEBUG_VISUALS) {
        // tslint:disable-next-line:max-line-length
        highlightBounding.setAttribute("style", `outline-color: magenta; outline-style: solid; outline-width: 1px; outline-offset: -1px;`);
    }
    highlightBounding.style.setProperty("pointer-events", "none");
    highlightBounding.style.position = paginated ? "fixed" : "absolute";
    highlightBounding.scale = scale;
    highlightBounding.xOffset = xOffset;
    highlightBounding.yOffset = yOffset;
    highlightBounding.rect = {
        height: rangeBoundingClientRect.height,
        left: rangeBoundingClientRect.left - xOffset,
        top: rangeBoundingClientRect.top - yOffset,
        width: rangeBoundingClientRect.width,
    };
    highlightBounding.style.width = `${highlightBounding.rect.width * scale}px`;
    highlightBounding.style.height = `${highlightBounding.rect.height * scale}px`;
    highlightBounding.style.left = `${highlightBounding.rect.left * scale}px`;
    highlightBounding.style.top = `${highlightBounding.rect.top * scale}px`;
    highlightParent.append(highlightBounding);

    highlightsContainer.append(highlightParent);
    return highlightParent;
}

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
interface IRectSimple {
    height: number;
    left: number;
    top: number;
    width: number;
}
interface IRect extends IRectSimple {
    bottom: number;
    right: number;
}
// https://github.com/GoogleChrome/lighthouse/blob/master/lighthouse-core/lib/rect-helpers.js
// https://github.com/GoogleChrome/lighthouse/blob/master/lighthouse-core/lib/tappable-rects.js
function almostEqual(a: number, b: number, tolerance: number) {
    return Math.abs(a - b) <= tolerance;
}
function rectIntersect(rect1: IRect, rect2: IRect): IRect {
    const maxLeft = Math.max(rect1.left, rect2.left);
    const minRight = Math.min(rect1.right, rect2.right);
    const maxTop = Math.max(rect1.top, rect2.top);
    const minBottom = Math.min(rect1.bottom, rect2.bottom);
    const rect: IRect = {
        bottom: minBottom,
        height: Math.max(0, minBottom - maxTop),
        left: maxLeft,
        right: minRight,
        top: maxTop,
        width: Math.max(0, minRight - maxLeft),
    };
    return rect;
}
// rect1 - rect2
function rectSubtract(rect1: IRect, rect2: IRect): IRect[] {

    const rectIntersected = rectIntersect(rect2, rect1);
    if (rectIntersected.height === 0 || rectIntersected.width === 0) {
    // if (rectIntersected.left >= rectIntersected.right || rectIntersected.top >= rectIntersected.bottom) {
        return [rect1];
    }

    const rects: IRect[] = [];

    {
        // left strip
        const rectA: IRect = {
            bottom: rect1.bottom,
            height: 0,
            left: rect1.left,
            right: rectIntersected.left,
            top: rect1.top,
            width: 0,
        };
        rectA.width = rectA.right - rectA.left;
        rectA.height = rectA.bottom - rectA.top;
        if (rectA.height !== 0 && rectA.width !== 0) {
        // if (rectA.left < rectA.right && rectA.top < rectA.bottom) {
            rects.push(rectA);
        }
    }

    {
        // inside strip
        const rectB: IRect = {
            bottom: rectIntersected.top,
            height: 0,
            left: rectIntersected.left,
            right: rectIntersected.right,
            top: rect1.top,
            width: 0,
        };
        rectB.width = rectB.right - rectB.left;
        rectB.height = rectB.bottom - rectB.top;
        if (rectB.height !== 0 && rectB.width !== 0) {
        // if (rectB.left < rectB.right && rectB.top < rectB.bottom) {
            rects.push(rectB);
        }
    }

    {
        // inside strip
        const rectC: IRect = {
            bottom: rect1.bottom,
            height: 0,
            left: rectIntersected.left,
            right: rectIntersected.right,
            top: rectIntersected.bottom,
            width: 0,
        };
        rectC.width = rectC.right - rectC.left;
        rectC.height = rectC.bottom - rectC.top;
        if (rectC.height !== 0 && rectC.width !== 0) {
        // if (rectC.left < rectC.right && rectC.top < rectC.bottom) {
            rects.push(rectC);
        }
    }

    {
        // right strip
        const rectD: IRect = {
            bottom: rect1.bottom,
            height: 0,
            left: rectIntersected.right,
            right: rect1.right,
            top: rect1.top,
            width: 0,
        };
        rectD.width = rectD.right - rectD.left;
        rectD.height = rectD.bottom - rectD.top;
        if (rectD.height !== 0 && rectD.width !== 0) {
        // if (rectD.left < rectD.right && rectD.top < rectD.bottom) {
            rects.push(rectD);
        }
    }

    return rects;
}
function rectContainsPoint(rect: IRect, x: number, y: number, tolerance: number) {
    return (rect.left < x || almostEqual(rect.left, x, tolerance)) &&
        (rect.right > x || almostEqual(rect.right, x, tolerance)) &&
        (rect.top < y || almostEqual(rect.top, y, tolerance)) &&
        (rect.bottom > y || almostEqual(rect.bottom, y, tolerance));
}
function rectContains(rect1: IRect, rect2: IRect, tolerance: number) {
    return (
        rectContainsPoint(rect1, rect2.left, rect2.top, tolerance) && // top left corner
        rectContainsPoint(rect1, rect2.right, rect2.top, tolerance) && // top right corner
        rectContainsPoint(rect1, rect2.left, rect2.bottom, tolerance) && // bottom left corner
        rectContainsPoint(rect1, rect2.right, rect2.bottom, tolerance) // bottom right corner
    );
}
function getBoundingRect(rect1: IRect, rect2: IRect): IRect {
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
function rectsTouchOrOverlap(rect1: IRect, rect2: IRect, tolerance: number) {
    return (
        (rect1.left < rect2.right || (tolerance >= 0 && almostEqual(rect1.left, rect2.right, tolerance))) &&
        (rect2.left < rect1.right || (tolerance >= 0 && almostEqual(rect2.left, rect1.right, tolerance))) &&
        (rect1.top < rect2.bottom || (tolerance >= 0 && almostEqual(rect1.top, rect2.bottom, tolerance))) &&
        (rect2.top < rect1.bottom || (tolerance >= 0 && almostEqual(rect2.top, rect1.bottom, tolerance)))
    );
}
function mergeTouchingRects(rects: IRect[], tolerance: number): IRect[] {
    for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
            const rect1 = rects[i];
            const rect2 = rects[j];
            if (rect1 === rect2) {
                if (IS_DEV) {
                    console.log("mergeTouchingRects rect1 === rect2 ??!");
                }
                continue;
            }

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
                if (IS_DEV) {
                    console.log("CLIENT RECT: merging two into one");
                }
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
function replaceOverlapingRects(rects: IRect[]): IRect[] {
    for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
            const rect1 = rects[i];
            const rect2 = rects[j];
            if (rect1 === rect2) {
                if (IS_DEV) {
                    console.log("replaceOverlapingRects rect1 === rect2 ??!");
                }
                continue;
            }

            if (rectsTouchOrOverlap(rect1, rect2, -1)) { // negative tolerance for strict overlap test

                let toAdd: IRect[] = [];
                let toRemove: IRect;
                let toPreserve: IRect;

                // rect1 - rect2
                const subtractRects1 = rectSubtract(rect1, rect2); // discard #1, keep #2, add returned rects
                if (subtractRects1.length === 1) {
                    toAdd = subtractRects1;
                    toRemove = rect1;
                    toPreserve = rect2;
                } else {
                    // rect2 - rect1
                    const subtractRects2 = rectSubtract(rect2, rect1); // discard #2, keep #1, add returned rects
                    if (subtractRects1.length < subtractRects2.length) {
                        toAdd = subtractRects1;
                        toRemove = rect1;
                        toPreserve = rect2;
                    } else {
                        toAdd = subtractRects2;
                        toRemove = rect2;
                        toPreserve = rect1;
                    }
                }

                if (IS_DEV) {
                    const toCheck = [];
                    toCheck.push(toPreserve);
                    Array.prototype.push.apply(toCheck, toAdd);
                    checkOverlaps(toCheck);
                }

                if (IS_DEV) {
                    console.log(`CLIENT RECT: overlap, cut one rect into ${toAdd.length}`);
                }
                const newRects = rects.filter((rect) => {
                    return rect !== toRemove;
                });
                Array.prototype.push.apply(newRects, toAdd);

                return replaceOverlapingRects(newRects);
            }
        }
    }

    return rects;
}
function getRectOverlapX(rect1: IRect, rect2: IRect) {
    return Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
}
function getRectOverlapY(rect1: IRect, rect2: IRect) {
    return Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
}
function removeContainedRects(rects: IRect[], tolerance: number): IRect[] {

    const rectsToKeep = new Set(rects);

    for (const rect of rects) {
        const bigEnough = rect.width > 1 && rect.height > 1;
        if (!bigEnough) {
            if (IS_DEV) {
                console.log("CLIENT RECT: remove tiny");
            }
            rectsToKeep.delete(rect);
            continue;
        }
        for (const possiblyContainingRect of rects) {
            if (rect === possiblyContainingRect) {
                continue;
            }
            if (!rectsToKeep.has(possiblyContainingRect)) {
                continue;
            }
            if (rectContains(possiblyContainingRect, rect, tolerance)) {
                if (IS_DEV) {
                    console.log("CLIENT RECT: remove contained");
                }
                rectsToKeep.delete(rect);
                break;
            }
        }
    }

    return Array.from(rectsToKeep);
}
function getClientRectsNoOverlap(range: Range): IRect[] {

    const tolerance = 1;

    const rangeClientRects = range.getClientRects(); // Array.from(range.getClientRects());

    const originalRects: IRect[] = [];
    for (const rangeClientRect of rangeClientRects) {
        originalRects.push({
            bottom: rangeClientRect.bottom,
            height: rangeClientRect.height,
            left: rangeClientRect.left,
            right: rangeClientRect.right,
            top: rangeClientRect.top,
            width: rangeClientRect.width,
        });
    }

    const mergedRects = mergeTouchingRects(originalRects, tolerance);
    const noContainedRects = removeContainedRects(mergedRects, tolerance);
    const newRects = replaceOverlapingRects(noContainedRects);

    const minArea = 2 * 2;
    for (let j = newRects.length - 1; j >= 0; j--) {
        const rect = newRects[j];
        const bigEnough = (rect.width * rect.height) > minArea;
        if (!bigEnough) {
            if (newRects.length > 1) {
                if (IS_DEV) {
                    console.log("CLIENT RECT: remove small");
                }
                newRects.splice(j, 1);
            } else {
                if (IS_DEV) {
                    console.log("CLIENT RECT: remove small, but keep otherwise empty!");
                }
                break;
            }
        }
    }

    if (IS_DEV) {
        checkOverlaps(newRects);
    }

    if (IS_DEV) {
        console.log(`CLIENT RECT: reduced ${originalRects.length} --> ${newRects.length}`);
    }
    return newRects;
}
function checkOverlaps(rects: IRect[]) {

    const stillOverlapingRects: IRect[] = [];

    for (const rect1 of rects) {
        for (const rect2 of rects) {
            if (rect1 === rect2) {
                continue;
            }
            const has1 = stillOverlapingRects.indexOf(rect1) >= 0;
            const has2 = stillOverlapingRects.indexOf(rect2) >= 0;
            if (!has1 || !has2) {
                if (rectsTouchOrOverlap(rect1, rect2, -1)) { // negative tolerance for strict overlap test

                    if (!has1) {
                        stillOverlapingRects.push(rect1);
                    }
                    if (!has2) {
                        stillOverlapingRects.push(rect2);
                    }

                    console.log("CLIENT RECT: overlap ---");
                    // tslint:disable-next-line:max-line-length
                    console.log(`#1 TOP:${rect1.top} BOTTOM:${rect1.bottom} LEFT:${rect1.left} RIGHT:${rect1.right} WIDTH:${rect1.width} HEIGHT:${rect1.height}`);
                    // tslint:disable-next-line:max-line-length
                    console.log(`#2 TOP:${rect2.top} BOTTOM:${rect2.bottom} LEFT:${rect2.left} RIGHT:${rect2.right} WIDTH:${rect2.width} HEIGHT:${rect2.height}`);

                    const xOverlap = getRectOverlapX(rect1, rect2);
                    console.log(`xOverlap: ${xOverlap}`);

                    const yOverlap = getRectOverlapY(rect1, rect2);
                    console.log(`yOverlap: ${yOverlap}`);
                }
            }
        }
    }
    if (stillOverlapingRects.length) {
        console.log(`CLIENT RECT: overlaps ${stillOverlapingRects.length}`);
        // for (const rect of stillOverlapingRects) {
        // tslint:disable-next-line:max-line-length
        //     console.log(`CLIENT RECT: remaining overlaps TOP:${rect.top} BOTTOM:${rect.bottom} LEFT:${rect.left} RIGHT:${rect.right} WIDTH:${rect.width} HEIGHT:${rect.height}`);
        // }
    }
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
