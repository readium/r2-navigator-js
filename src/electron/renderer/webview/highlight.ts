// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as crypto from "crypto";

import { debounce } from "debounce";
import { ipcRenderer } from "electron";

import { IEventPayload_R2_EVENT_HIGHLIGHT_CLICK, R2_EVENT_HIGHLIGHT_CLICK } from "../../common/events";
import { IColor, IHighlight } from "../../common/highlight";
import { isPaginated } from "../../common/readium-css-inject";
import { ISelectionInfo } from "../../common/selection";
import { IRectSimple, getClientRectsNoOverlap } from "../common/rect-utils";
import { getScrollingElement } from "./readium-css";
import { convertRangeInfo } from "./selection";
import { IElectronWebviewTagWindow } from "./state";

// import { isRTL } from './readium-css';

export const ID_HIGHLIGHTS_CONTAINER = "R2_ID_HIGHLIGHTS_CONTAINER";
export const CLASS_HIGHLIGHT_CONTAINER = "R2_CLASS_HIGHLIGHT_CONTAINER";
export const CLASS_HIGHLIGHT_AREA = "R2_CLASS_HIGHLIGHT_AREA";
export const CLASS_HIGHLIGHT_BOUNDING_AREA = "R2_CLASS_HIGHLIGHT_BOUNDING_AREA";

const DEFAULT_BACKGROUND_COLOR_OPACITY = 0.1;
const ALT_BACKGROUND_COLOR_OPACITY = 0.4;
const DEFAULT_BACKGROUND_COLOR: IColor = {
    blue: 100,
    green: 50,
    red: 230,
};

const _highlights: IHighlight[] = [];

interface IHTMLDivElementWithRect extends HTMLDivElement {
    rect: IRectSimple;
    scale: number;
    // xOffset: number;
    // yOffset: number;
}

function resetHighlightBoundingStyle(_win: IElectronWebviewTagWindow, highlightBounding: HTMLElement) {

    highlightBounding.style.outline = "none";
    // tslint:disable-next-line:max-line-length
    highlightBounding.style.setProperty("background-color", "transparent", "important");
}

// tslint:disable-next-line:max-line-length
function setHighlightBoundingStyle(_win: IElectronWebviewTagWindow, highlightBounding: HTMLElement, highlight: IHighlight) {

    const opacity = ALT_BACKGROUND_COLOR_OPACITY;
    // tslint:disable-next-line:max-line-length
    highlightBounding.style.setProperty("background-color", `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity})`, "important");

    // tslint:disable-next-line:max-line-length
    highlightBounding.style.outlineColor = `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, 1)`;
    highlightBounding.style.outlineStyle = "solid";
    highlightBounding.style.outlineWidth = "1px";
    highlightBounding.style.outlineOffset = "0px";
}

function resetHighlightAreaStyle(_win: IElectronWebviewTagWindow, highlightArea: HTMLElement) {

    // if (!win.READIUM2.DEBUG_VISUALS) {
    //     highlightArea.style.outline = "none";
    // }

    // tslint:disable-next-line:max-line-length
    const id = (highlightArea.parentNode && highlightArea.parentNode.nodeType === Node.ELEMENT_NODE && (highlightArea.parentNode as Element).getAttribute) ?
        (highlightArea.parentNode as Element).getAttribute("id") : undefined;
    if (id) {
        const highlight = _highlights.find((h) => {
            return h.id === id;
        });
        if (highlight) {
            const opacity = DEFAULT_BACKGROUND_COLOR_OPACITY;
            // tslint:disable-next-line:max-line-length
            highlightArea.style.setProperty("background-color", `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity})`, "important");
        }
    }
}

function setHighlightAreaStyle(_win: IElectronWebviewTagWindow, highlightAreas: Element[], highlight: IHighlight) {

    for (const highlightArea of highlightAreas) {
        const opacity = ALT_BACKGROUND_COLOR_OPACITY;
        // tslint:disable-next-line:max-line-length
        (highlightArea as HTMLElement).style.setProperty("background-color", `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity})`, "important");

        // if (!win.READIUM2.DEBUG_VISUALS) {
        // tslint:disable-next-line:max-line-length
        //     (highlightArea as HTMLElement).style.outlineColor = `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, 1)`;
        //     (highlightArea as HTMLElement).style.outlineStyle = "solid";
        //     (highlightArea as HTMLElement).style.outlineWidth = "1px";
        //     (highlightArea as HTMLElement).style.outlineOffset = "0px";
        // }
    }
}

function processMouseEvent(win: IElectronWebviewTagWindow, ev: MouseEvent) {
    const documant = win.document;
    const scrollElement = getScrollingElement(documant);

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
    const xOffset = paginated ? (-scrollElement.scrollLeft) : bodyRect.left;
    const yOffset = paginated ? (-scrollElement.scrollTop) : bodyRect.top;

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

            const left = withRect.rect.left + xOffset; // (paginated ? withRect.xOffset : xOffset);
            const top = withRect.rect.top + yOffset; // (paginated ? withRect.yOffset : yOffset);
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
        const highlightBoundings = _highlightsContainer.querySelectorAll(`.${CLASS_HIGHLIGHT_BOUNDING_AREA}`);
        for (const highlightBounding of highlightBoundings) {
            resetHighlightBoundingStyle(win, highlightBounding as HTMLElement);
        }
        const allHighlightAreas = Array.from(_highlightsContainer.querySelectorAll(`.${CLASS_HIGHLIGHT_AREA}`));
        for (const highlightArea of allHighlightAreas) {
            resetHighlightAreaStyle(win, highlightArea as HTMLElement);
        }
        return;
    }
    if (foundElement.getAttribute("data-click")) {
        if (ev.type === "mousemove") {
            // tslint:disable-next-line:max-line-length
            const foundElementHighlightAreas = Array.from(foundElement.querySelectorAll(`.${CLASS_HIGHLIGHT_AREA}`));
            const allHighlightAreas = _highlightsContainer.querySelectorAll(`.${CLASS_HIGHLIGHT_AREA}`);
            for (const highlightArea of allHighlightAreas) {
                if (foundElementHighlightAreas.indexOf(highlightArea) < 0) {
                    resetHighlightAreaStyle(win, highlightArea as HTMLElement);
                }
            }
            setHighlightAreaStyle(win, foundElementHighlightAreas, foundHighlight);

            const foundElementHighlightBounding = foundElement.querySelector(`.${CLASS_HIGHLIGHT_BOUNDING_AREA}`);
            const allHighlightBoundings = _highlightsContainer.querySelectorAll(`.${CLASS_HIGHLIGHT_BOUNDING_AREA}`);
            for (const highlightBounding of allHighlightBoundings) {
                if (!foundElementHighlightBounding || highlightBounding !== foundElementHighlightBounding) {
                    resetHighlightBoundingStyle(win, highlightBounding as HTMLElement);
                }
            }
            if (foundElementHighlightBounding) {
                if (win.READIUM2.DEBUG_VISUALS) {
                    setHighlightBoundingStyle(win, foundElementHighlightBounding as HTMLElement, foundHighlight);
                }
            }
        } else if (ev.type === "click") {
            const payload: IEventPayload_R2_EVENT_HIGHLIGHT_CLICK = {
                highlight: foundHighlight,
            };
            ipcRenderer.sendToHost(R2_EVENT_HIGHLIGHT_CLICK, payload);
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
    pointerInteraction: boolean): IHighlight {

    // tslint:disable-next-line:no-string-literal
    // console.log("Chromium: " + process.versions["chrome"]);

    // tslint:disable-next-line:max-line-length
    const uniqueStr = `${selectionInfo.rangeInfo.cfi}${selectionInfo.rangeInfo.startContainerElementCssSelector}${selectionInfo.rangeInfo.startContainerChildTextNodeIndex}${selectionInfo.rangeInfo.startOffset}${selectionInfo.rangeInfo.endContainerElementCssSelector}${selectionInfo.rangeInfo.endContainerChildTextNodeIndex}${selectionInfo.rangeInfo.endOffset}`;
    // const unique = new Buffer(JSON.stringify(selectionInfo.rangeInfo, null, "")).toString("base64");
    // const unique = new Buffer(uniqueStr).toString("base64");
    // const id = "R2_HIGHLIGHT_" + unique.replace(/\+/, "_").replace(/=/, "-").replace(/\//, ".");
    const checkSum = crypto.createHash("sha256");
    checkSum.update(uniqueStr);
    const sha256Hex = checkSum.digest("hex");
    const id = "R2_HIGHLIGHT_" + sha256Hex;

    destroyHighlight(win.document, id);

    const highlight: IHighlight = {
        color: color ? color : DEFAULT_BACKGROUND_COLOR,
        id,
        pointerInteraction,
        selectionInfo,
    };
    _highlights.push(highlight);

    createHighlightDom(win, highlight);

    return highlight;
}

function createHighlightDom(win: IElectronWebviewTagWindow, highlight: IHighlight): HTMLDivElement | undefined {

    const documant = win.document;
    const scrollElement = getScrollingElement(documant);

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

    const xOffset = paginated ? (-scrollElement.scrollLeft) : bodyRect.left;
    const yOffset = paginated ? (-scrollElement.scrollTop) : bodyRect.top;

    const scale = 1 / ((win.READIUM2 && win.READIUM2.isFixedLayout) ? win.READIUM2.fxlViewportScale : 1);

    // console.log("scrollElement.scrollLeft: " + scrollElement.scrollLeft);
    // console.log("scrollElement.scrollTop: " + scrollElement.scrollTop);

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
        // highlightArea.xOffset = xOffset;
        // highlightArea.yOffset = yOffset;
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
    // highlightBounding.xOffset = xOffset;
    // highlightBounding.yOffset = yOffset;
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
