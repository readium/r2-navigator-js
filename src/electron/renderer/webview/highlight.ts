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
import { IReadiumElectronWebviewWindow } from "./state";

// import { isRTL } from './readium-css';

export const ID_HIGHLIGHTS_CONTAINER = "R2_ID_HIGHLIGHTS_CONTAINER";
export const CLASS_HIGHLIGHT_CONTAINER = "R2_CLASS_HIGHLIGHT_CONTAINER";
export const CLASS_HIGHLIGHT_AREA = "R2_CLASS_HIGHLIGHT_AREA";
export const CLASS_HIGHLIGHT_BOUNDING_AREA = "R2_CLASS_HIGHLIGHT_BOUNDING_AREA";

const USE_SVG = false;

const DEFAULT_BACKGROUND_COLOR_OPACITY = 0.3;
const ALT_BACKGROUND_COLOR_OPACITY = 0.45;
const DEFAULT_BACKGROUND_COLOR: IColor = {
    blue: 100,
    green: 50,
    red: 230,
};

const _highlights: IHighlight[] = [];

interface IWithRect {
    rect: IRectSimple;
    scale: number;
    // xOffset: number;
    // yOffset: number;
}
interface IHTMLDivElementWithRect extends HTMLDivElement, IWithRect {
}

const SVG_XML_NAMESPACE = "http://www.w3.org/2000/svg";
interface ISVGRectElementWithRect extends SVGRectElement, IWithRect {
}
interface ISVGLineElementWithRect extends SVGLineElement, IWithRect {
}

function resetHighlightBoundingStyle(_win: IReadiumElectronWebviewWindow, highlightBounding: HTMLElement) {

    highlightBounding.style.outline = "none";
    // tslint:disable-next-line:max-line-length
    highlightBounding.style.setProperty("background-color", "transparent", "important");
}

// tslint:disable-next-line:max-line-length
function setHighlightBoundingStyle(_win: IReadiumElectronWebviewWindow, highlightBounding: HTMLElement, highlight: IHighlight) {

    const opacity = ALT_BACKGROUND_COLOR_OPACITY;
    // tslint:disable-next-line:max-line-length
    highlightBounding.style.setProperty("background-color", `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity})`, "important");

    // tslint:disable-next-line:max-line-length
    highlightBounding.style.outlineColor = `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, 1)`;
    highlightBounding.style.outlineStyle = "solid";
    highlightBounding.style.outlineWidth = "1px";
    highlightBounding.style.outlineOffset = "0px";
}

function resetHighlightAreaStyle(win: IReadiumElectronWebviewWindow, highlightArea: HTMLElement | SVGElement) {

    const useSVG = !win.READIUM2.DEBUG_VISUALS && USE_SVG;
    const isSVG = useSVG && highlightArea.namespaceURI === SVG_XML_NAMESPACE;

    const id = isSVG ?
        // tslint:disable-next-line:max-line-length
        ((highlightArea.parentNode && highlightArea.parentNode.parentNode && highlightArea.parentNode.parentNode.nodeType === Node.ELEMENT_NODE && (highlightArea.parentNode.parentNode as Element).getAttribute) ? (highlightArea.parentNode.parentNode as Element).getAttribute("id") : undefined) :
        // tslint:disable-next-line:max-line-length
        ((highlightArea.parentNode && highlightArea.parentNode.nodeType === Node.ELEMENT_NODE && (highlightArea.parentNode as Element).getAttribute) ? (highlightArea.parentNode as Element).getAttribute("id") : undefined);
    if (id) {
        const highlight = _highlights.find((h) => {
            return h.id === id;
        });
        if (highlight) {
            const opacity = DEFAULT_BACKGROUND_COLOR_OPACITY;
            // highlightArea as ElementCSSInlineStyle (implied by HTMLElement | SVGElement)
            if (isSVG) {
                // tslint:disable-next-line:max-line-length
                highlightArea.style.setProperty("fill", `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})`, "important");
                // tslint:disable-next-line:max-line-length
                highlightArea.style.setProperty("fill-opacity", `${opacity}`, "important");
                // tslint:disable-next-line:max-line-length
                highlightArea.style.setProperty("stroke", `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})`, "important");
                // tslint:disable-next-line:max-line-length
                highlightArea.style.setProperty("stroke-opacity", `${opacity}`, "important");
            } else {
                // tslint:disable-next-line:max-line-length
                highlightArea.style.setProperty("background-color", `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity})`, "important");
            }
        }
    }
}

// tslint:disable-next-line:max-line-length
function setHighlightAreaStyle(win: IReadiumElectronWebviewWindow, highlightAreas: Array<HTMLElement | SVGElement>, highlight: IHighlight) {

    const useSVG = !win.READIUM2.DEBUG_VISUALS && USE_SVG;
    for (const highlightArea of highlightAreas) {
        const isSVG = useSVG && highlightArea.namespaceURI === SVG_XML_NAMESPACE;

        const opacity = ALT_BACKGROUND_COLOR_OPACITY;
        // highlightArea as ElementCSSInlineStyle (implied by HTMLElement | SVGElement)
        if (isSVG) {
            // tslint:disable-next-line:max-line-length
            highlightArea.style.setProperty("fill", `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})`, "important");
            // tslint:disable-next-line:max-line-length
            highlightArea.style.setProperty("fill-opacity", `${opacity}`, "important");
            // tslint:disable-next-line:max-line-length
            highlightArea.style.setProperty("stroke", `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})`, "important");
            // tslint:disable-next-line:max-line-length
            highlightArea.style.setProperty("stroke-opacity", `${opacity}`, "important");
        } else {
            // tslint:disable-next-line:max-line-length
            highlightArea.style.setProperty("background-color", `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity})`, "important");
        }

        // if (!win.READIUM2.DEBUG_VISUALS) {
        // tslint:disable-next-line:max-line-length
        //     (highlightArea as HTMLElement).style.outlineColor = `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, 1)`;
        //     (highlightArea as HTMLElement).style.outlineStyle = "solid";
        //     (highlightArea as HTMLElement).style.outlineWidth = "1px";
        //     (highlightArea as HTMLElement).style.outlineOffset = "0px";
        // }
    }
}

function processMouseEvent(win: IReadiumElectronWebviewWindow, ev: MouseEvent) {
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
            const withRect = (highlightFragment as unknown) as IWithRect;
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
            resetHighlightAreaStyle(win, highlightArea as HTMLElement); // can also be SVGElement
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
                    resetHighlightAreaStyle(win, highlightArea as HTMLElement); // can also be SVGElement
                }
            }
            // tslint:disable-next-line:max-line-length
            setHighlightAreaStyle(win, foundElementHighlightAreas as HTMLElement[], foundHighlight); // can also be SVGElement[]

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
        } else if (ev.type === "mouseup" || ev.type === "click") {
            const payload: IEventPayload_R2_EVENT_HIGHLIGHT_CLICK = {
                highlight: foundHighlight,
            };
            ipcRenderer.sendToHost(R2_EVENT_HIGHLIGHT_CLICK, payload);
        }
    }
}

let lastMouseDownX = -1;
let lastMouseDownY = -1;
let bodyEventListenersSet = false;
let _highlightsContainer: HTMLElement | null;
function ensureHighlightsContainer(win: IReadiumElectronWebviewWindow): HTMLElement {
    const documant = win.document;

    if (!_highlightsContainer) {

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

export function recreateAllHighlightsRaw(win: IReadiumElectronWebviewWindow) {
    hideAllhighlights(win.document);
    for (const highlight of _highlights) {
        createHighlightDom(win, highlight);
    }
}

export const recreateAllHighlightsDebounced = debounce((win: IReadiumElectronWebviewWindow) => {
    recreateAllHighlightsRaw(win);
}, 500);

export function recreateAllHighlights(win: IReadiumElectronWebviewWindow) {
    hideAllhighlights(win.document);
    recreateAllHighlightsDebounced(win);
}

export function createHighlight(
    win: IReadiumElectronWebviewWindow,
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

function createHighlightDom(win: IReadiumElectronWebviewWindow, highlight: IHighlight): HTMLDivElement | undefined {

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

    const useSVG = !win.READIUM2.DEBUG_VISUALS && USE_SVG;
    const drawUnderline = true;
    const drawStrikeThrough = false;

    const doNotMergeHorizontallyAlignedRects = drawUnderline || drawStrikeThrough;
    // const clientRects = range.getClientRects(); // ClientRectList | DOMRectList
    // tslint:disable-next-line:max-line-length
    const clientRects = win.READIUM2.DEBUG_VISUALS ? range.getClientRects() : getClientRectsNoOverlap(range, doNotMergeHorizontallyAlignedRects);

    let highlightAreaSVGDocFrag: DocumentFragment | undefined;

    const roundedCorner = 3;
    const underlineThickness = 2;
    const strikeThroughLineThickness = 3;

    for (const clientRect of clientRects) {
        const opacity = DEFAULT_BACKGROUND_COLOR_OPACITY;

        if (useSVG) {
            const borderThickness = 0;

            if (!highlightAreaSVGDocFrag) {
                highlightAreaSVGDocFrag = documant.createDocumentFragment();
            }

            const highlightAreaSVGRect = documant.createElementNS(SVG_XML_NAMESPACE, "rect") as ISVGRectElementWithRect;
            highlightAreaSVGRect.setAttribute("class", CLASS_HIGHLIGHT_AREA);

            // tslint:disable-next-line:max-line-length
            highlightAreaSVGRect.setAttribute("style", `fill: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important; fill-opacity: ${opacity} !important; stroke-width: 0;`); // stroke-width: ${borderThickness}; stroke: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important; stroke-opacity: ${opacity} !important
            highlightAreaSVGRect.scale = scale;
            // highlightAreaSVGRect.xOffset = xOffset;
            // highlightAreaSVGRect.yOffset = yOffset;
            highlightAreaSVGRect.rect = {
                height: clientRect.height,
                left: clientRect.left - xOffset,
                top: clientRect.top - yOffset,
                width: clientRect.width,
            };
            highlightAreaSVGRect.setAttribute("rx", `${roundedCorner * scale}`);
            highlightAreaSVGRect.setAttribute("ry", `${roundedCorner * scale}`);
            highlightAreaSVGRect.setAttribute("x", `${(highlightAreaSVGRect.rect.left - borderThickness) * scale}`);
            highlightAreaSVGRect.setAttribute("y", `${(highlightAreaSVGRect.rect.top - borderThickness) * scale}`);
            // tslint:disable-next-line:max-line-length
            highlightAreaSVGRect.setAttribute("height", `${(highlightAreaSVGRect.rect.height + (borderThickness * 2)) * scale}`);
            // tslint:disable-next-line:max-line-length
            highlightAreaSVGRect.setAttribute("width", `${(highlightAreaSVGRect.rect.width + (borderThickness * 2)) * scale}`);
            highlightAreaSVGDocFrag.appendChild(highlightAreaSVGRect);

            if (drawUnderline) {
                // tslint:disable-next-line:max-line-length
                const highlightAreaSVGLine = documant.createElementNS(SVG_XML_NAMESPACE, "line") as ISVGLineElementWithRect;
                highlightAreaSVGLine.setAttribute("class", CLASS_HIGHLIGHT_AREA);

                // tslint:disable-next-line:max-line-length
                highlightAreaSVGLine.setAttribute("style", `stroke-linecap: round; stroke-width: ${underlineThickness * scale}; stroke: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important; stroke-opacity: ${opacity} !important`);
                highlightAreaSVGLine.scale = scale;
                // highlightAreaSVGLine.xOffset = xOffset;
                // highlightAreaSVGLine.yOffset = yOffset;
                highlightAreaSVGLine.rect = {
                    height: clientRect.height,
                    left: clientRect.left - xOffset,
                    top: clientRect.top - yOffset,
                    width: clientRect.width,
                };
                const lineOffset = (highlightAreaSVGLine.rect.width > roundedCorner) ? roundedCorner : 0;
                highlightAreaSVGLine.setAttribute("x1", `${(highlightAreaSVGLine.rect.left + lineOffset) * scale}`);
                // tslint:disable-next-line:max-line-length
                highlightAreaSVGLine.setAttribute("x2", `${(highlightAreaSVGLine.rect.left + highlightAreaSVGLine.rect.width - lineOffset) * scale}`);
                // tslint:disable-next-line:max-line-length
                const y = (highlightAreaSVGLine.rect.top + highlightAreaSVGLine.rect.height - (underlineThickness / 2)) * scale;
                highlightAreaSVGLine.setAttribute("y1", `${y}`);
                highlightAreaSVGLine.setAttribute("y2", `${y}`);

                highlightAreaSVGLine.setAttribute("height", `${highlightAreaSVGLine.rect.height * scale}`);
                highlightAreaSVGLine.setAttribute("width", `${highlightAreaSVGLine.rect.width * scale}`);
                highlightAreaSVGDocFrag.appendChild(highlightAreaSVGLine);
            }
            if (drawStrikeThrough) {
                // tslint:disable-next-line:max-line-length
                const highlightAreaSVGLine = documant.createElementNS(SVG_XML_NAMESPACE, "line") as ISVGLineElementWithRect;
                highlightAreaSVGLine.setAttribute("class", CLASS_HIGHLIGHT_AREA);

                // tslint:disable-next-line:max-line-length
                highlightAreaSVGLine.setAttribute("style", `stroke-linecap: butt; stroke-width: ${strikeThroughLineThickness * scale}; stroke: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important; stroke-opacity: ${opacity} !important`); // stroke-dasharray: ${lineThickness * 2},${lineThickness * 2};
                highlightAreaSVGLine.scale = scale;
                // highlightAreaSVGLine.xOffset = xOffset;
                // highlightAreaSVGLine.yOffset = yOffset;
                highlightAreaSVGLine.rect = {
                    height: clientRect.height,
                    left: clientRect.left - xOffset,
                    top: clientRect.top - yOffset,
                    width: clientRect.width,
                };
                highlightAreaSVGLine.setAttribute("x1", `${highlightAreaSVGLine.rect.left * scale}`);
                // tslint:disable-next-line:max-line-length
                highlightAreaSVGLine.setAttribute("x2", `${(highlightAreaSVGLine.rect.left + highlightAreaSVGLine.rect.width) * scale}`);

                const lineOffset = highlightAreaSVGLine.rect.height / 2;
                const y = (highlightAreaSVGLine.rect.top + lineOffset) * scale;
                highlightAreaSVGLine.setAttribute("y1", `${y}`);
                highlightAreaSVGLine.setAttribute("y2", `${y}`);

                highlightAreaSVGLine.setAttribute("height", `${highlightAreaSVGLine.rect.height * scale}`);
                highlightAreaSVGLine.setAttribute("width", `${highlightAreaSVGLine.rect.width * scale}`);
                highlightAreaSVGDocFrag.appendChild(highlightAreaSVGLine);
            }
        } else {
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
            } else {
                if (drawUnderline) {
                    // tslint:disable-next-line:max-line-length
                    extra += `border-bottom: ${underlineThickness * scale}px solid rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity}) !important`;
                }
            }
            // tslint:disable-next-line:max-line-length
            highlightArea.setAttribute("style", `border-radius: ${roundedCorner}px !important; background-color: rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity}) !important; ${extra}`);
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

            if (!win.READIUM2.DEBUG_VISUALS && drawStrikeThrough) {

                const highlightAreaLine = documant.createElement("div") as IHTMLDivElementWithRect;
                highlightAreaLine.setAttribute("class", CLASS_HIGHLIGHT_AREA);

                // tslint:disable-next-line:max-line-length
                highlightAreaLine.setAttribute("style", `background-color: rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity}) !important;`);
                // tslint:disable-next-line:max-line-length
                // highlightArea.setAttribute("style", `outline-color: magenta; outline-style: solid; outline-width: 1px; outline-offset: -1px;`);
                highlightAreaLine.style.setProperty("pointer-events", "none");
                highlightAreaLine.style.position = paginated ? "fixed" : "absolute";
                highlightAreaLine.scale = scale;
                // highlightAreaLine.xOffset = xOffset;
                // highlightAreaLine.yOffset = yOffset;
                highlightAreaLine.rect = {
                    height: clientRect.height,
                    left: clientRect.left - xOffset,
                    top: clientRect.top - yOffset,
                    width: clientRect.width,
                };
                highlightAreaLine.style.width = `${highlightAreaLine.rect.width * scale}px`;
                highlightAreaLine.style.height = `${strikeThroughLineThickness * scale}px`;
                highlightAreaLine.style.left = `${highlightAreaLine.rect.left * scale}px`;
                // tslint:disable-next-line:max-line-length
                highlightAreaLine.style.top = `${(highlightAreaLine.rect.top + (highlightAreaLine.rect.height / 2) - (strikeThroughLineThickness / 2)) * scale}px`;

                highlightParent.append(highlightAreaLine);
            }
        }
    }

    if (useSVG && highlightAreaSVGDocFrag) {
        // const highlightAreaSVGG = documant.createElementNS(SVG_XML_NAMESPACE, "g");
        // highlightAreaSVGG.appendChild(highlightAreaSVGDocFrag);
        const highlightAreaSVG = documant.createElementNS(SVG_XML_NAMESPACE, "svg");
        highlightAreaSVG.setAttribute("pointer-events", "none");
        highlightAreaSVG.style.position = paginated ? "fixed" : "absolute";
        highlightAreaSVG.style.overflow = "visible";
        highlightAreaSVG.style.left = "0";
        highlightAreaSVG.style.top = "0";
        highlightAreaSVG.append(highlightAreaSVGDocFrag);
        highlightParent.append(highlightAreaSVG);
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
