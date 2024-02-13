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

import { ID_HIGHLIGHTS_CONTAINER, CLASS_HIGHLIGHT_CURSOR1, CLASS_HIGHLIGHT_CURSOR2, CLASS_HIGHLIGHT_COMMON } from "../../common/styles";

import { isRTL } from "./readium-css";

export const CLASS_HIGHLIGHT_CONTAINER = "R2_CLASS_HIGHLIGHT_CONTAINER";
export const CLASS_HIGHLIGHT_AREA = "R2_CLASS_HIGHLIGHT_AREA";
export const CLASS_HIGHLIGHT_BOUNDING_AREA = "R2_CLASS_HIGHLIGHT_BOUNDING_AREA";
export const CLASS_HIGHLIGHT_BOUNDING_AREA_MARGIN = "R2_CLASS_HIGHLIGHT_BOUNDING_AREA_MARGIN";

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

const DEBUG_VISUALS = false; // IS_DEV;

const USE_SVG = false;
const USE_BLEND_MODE = true;

const DEFAULT_BACKGROUND_COLOR_OPACITY = USE_BLEND_MODE ? 0.8 : 0.3;
const ALT_BACKGROUND_COLOR_OPACITY = USE_BLEND_MODE ? 1 : 0.45;
const ALT_OTHER_BACKGROUND_COLOR_OPACITY = 0.2;
const DEFAULT_BACKGROUND_COLOR: IColor = {
    blue: 100,
    green: 50,
    red: 230,
};

const _highlights: IHighlight[] = [];

let _drawMargin: boolean | string[] = false;
// let _drawMarginPrevious: boolean | string[] = true; // ["search"];
const drawMarginMarker = (h: IHighlight) => {
    if (Array.isArray(_drawMargin)) {
        if (h.group) {
            return _drawMargin.includes(h.group);
        }
        return false;
    }
    return _drawMargin;
};
export const setDrawMargin = (win: ReadiumElectronWebviewWindow, drawMargin: boolean | string[]) => {
    // _drawMarginPrevious = _drawMargin;
    _drawMargin = drawMargin;
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- _drawMargin: " + JSON.stringify(_drawMargin, null, 4));
    }
    recreateAllHighlightsRaw(win);
};

interface IAreaWithActiveFlag extends Element {
    active: boolean | undefined;
}

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

function resetHighlightBoundingStyle(_win: ReadiumElectronWebviewWindow, highlightBounding: HTMLElement) {

    if (!(highlightBounding as unknown as IAreaWithActiveFlag).active) {
        return;
    }
    (highlightBounding as unknown as IAreaWithActiveFlag).active = false;

    highlightBounding.style.setProperty("outline", "none", "important");

    highlightBounding.style.setProperty(
        "background-color",
        "transparent",
        "important");
}

// tslint:disable-next-line:max-line-length
function setHighlightBoundingStyle(_win: ReadiumElectronWebviewWindow, highlightBounding: HTMLElement, highlight: IHighlight) {

    if ((highlightBounding as unknown as IAreaWithActiveFlag).active) {
        return;
    }
    (highlightBounding as unknown as IAreaWithActiveFlag).active = true;

    const opacity = ALT_BACKGROUND_COLOR_OPACITY;

    highlightBounding.style.setProperty(
        "background-color",
        USE_BLEND_MODE ?
            `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})` :
            `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity})`,
        "important");
    // if (USE_BLEND_MODE) {
    //     highlightBounding.style.setProperty("mix-blend-mode", "multiply", "important");
    //     highlightBounding.style.opacity = `${opacity}`;
    // }

    // tslint:disable-next-line:max-line-length
    highlightBounding.style.setProperty("outline-color", `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, 1)`, "important");
    highlightBounding.style.setProperty("outline-style", "solid", "important");
    highlightBounding.style.setProperty("outline-width", "1px", "important");
    highlightBounding.style.setProperty("outline-offset", "0px", "important");
}

function resetHighlightBoundingMarginStyle(_win: ReadiumElectronWebviewWindow, highlightBounding: HTMLElement) {
    if (USE_BLEND_MODE) {
        return;
    }

    if (!(highlightBounding as unknown as IAreaWithActiveFlag).active) {
        return;
    }
    (highlightBounding as unknown as IAreaWithActiveFlag).active = false;

    // highlightBounding.style.setProperty("outline", "none", "important");

    const opacity = ALT_BACKGROUND_COLOR_OPACITY;

    // const useSVG = !(DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS) && USE_SVG;
    // const isSVG = useSVG && highlightBounding.namespaceURI === SVG_XML_NAMESPACE;

    // const id = isSVG ?
    //     // tslint:disable-next-line:max-line-length
    //     ((highlightBounding.parentNode && highlightBounding.parentNode.parentNode && highlightBounding.parentNode.parentNode.nodeType === Node.ELEMENT_NODE && (highlightBounding.parentNode.parentNode as Element).getAttribute) ? (highlightBounding.parentNode.parentNode as Element).getAttribute("id") : undefined) :
    //     // tslint:disable-next-line:max-line-length
    //     ((highlightBounding.parentNode && highlightBounding.parentNode.nodeType === Node.ELEMENT_NODE && (highlightBounding.parentNode as Element).getAttribute) ? (highlightBounding.parentNode as Element).getAttribute("id") : undefined);

    const id = ((highlightBounding.parentNode && highlightBounding.parentNode.nodeType === Node.ELEMENT_NODE && (highlightBounding.parentNode as Element).getAttribute) ? (highlightBounding.parentNode as Element).getAttribute("id") : undefined);
    if (id) {
        const highlight = _highlights.find((h) => {
            return h.id === id;
        });
        if (highlight) {
            // highlightArea as ElementCSSInlineStyle (implied by HTMLElement | SVGElement)

            highlightBounding.style.setProperty(
            "background-color",
            USE_BLEND_MODE ?
                `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})` :
                `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity})`,
            "important");
            // if (USE_BLEND_MODE) {
            //     highlightBounding.style.setProperty("mix-blend-mode", "multiply", "important");
            //     highlightBounding.style.opacity = `${opacity}`;
            // }
        }
    }
}

// tslint:disable-next-line:max-line-length
function setHighlightBoundingMarginStyle(_win: ReadiumElectronWebviewWindow, highlightBounding: HTMLElement, highlight: IHighlight) {

    if (USE_BLEND_MODE) {
        return;
    }

    if ((highlightBounding as unknown as IAreaWithActiveFlag).active) {
        return;
    }
    (highlightBounding as unknown as IAreaWithActiveFlag).active = true;

    const opacity = ALT_BACKGROUND_COLOR_OPACITY;

    highlightBounding.style.setProperty(
        "background-color",
        USE_BLEND_MODE ?
            `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})` :
            `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity})`,
        "important");
    // if (USE_BLEND_MODE) {
    //     highlightBounding.style.setProperty("mix-blend-mode", "multiply", "important");
    //     highlightBounding.style.opacity = `${opacity}`;
    // }

    // // tslint:disable-next-line:max-line-length
    // highlightBounding.style.setProperty("outline-color", `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, 1)`, "important");
    // highlightBounding.style.setProperty("outline-style", "solid", "important");
    // highlightBounding.style.setProperty("outline-width", "1px", "important");
    // highlightBounding.style.setProperty("outline-offset", "0px", "important");
}

function resetHighlightAreaStyle(win: ReadiumElectronWebviewWindow, highlightArea: HTMLElement | SVGElement) {

    if (USE_BLEND_MODE) {
        return;
    }

    if (!(highlightArea as unknown as IAreaWithActiveFlag).active) {
        return;
    }
    (highlightArea as unknown as IAreaWithActiveFlag).active = false;

    const opacity = DEFAULT_BACKGROUND_COLOR_OPACITY;

    const useSVG = !(DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS) && USE_SVG;
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
            // highlightArea as ElementCSSInlineStyle (implied by HTMLElement | SVGElement)
            if (isSVG) {
                if (!highlight.drawType) {
                    // tslint:disable-next-line:max-line-length
                    highlightArea.style.setProperty(
                        "fill",
                        `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})`,
                        "important");
                }
                // tslint:disable-next-line:max-line-length
                highlightArea.style.setProperty(
                    "stroke",
                    `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})`,
                    "important");
                if (!USE_BLEND_MODE) {
                    if (!highlight.drawType) {
                        // tslint:disable-next-line:max-line-length
                        highlightArea.style.setProperty(
                            "fill-opacity",
                            `${opacity}`,
                            "important");
                    }
                    // tslint:disable-next-line:max-line-length
                    highlightArea.style.setProperty(
                        "stroke-opacity",
                        `${opacity}`,
                        "important");
                }
            } else {
                // tslint:disable-next-line:max-line-length
                highlightArea.style.setProperty(
                    "background-color",
                    highlight.drawType === HighlightDrawTypeUnderline ? "transparent" : // underline is border bottom
                    (USE_BLEND_MODE ?
                        `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})` :
                        `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity})`),
                    "important");
            }

            // if (USE_BLEND_MODE) {
            //     highlightArea.style.setProperty("mix-blend-mode", "multiply");
            //     highlightArea.style.opacity = `${opacity}`;
            // }
        }
    }
}

// tslint:disable-next-line:max-line-length
function setHighlightAreaStyle(win: ReadiumElectronWebviewWindow, highlightAreas: NodeList, highlight: IHighlight) {

    if (USE_BLEND_MODE) {
        return;
    }

    const opacity = ALT_BACKGROUND_COLOR_OPACITY;

    const useSVG = !(DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS) && USE_SVG;
    for (const highlightArea_ of highlightAreas) {
        const highlightArea = highlightArea_ as HTMLElement;

        if ((highlightArea as unknown as IAreaWithActiveFlag).active) {
            continue;
        }
        (highlightArea as unknown as IAreaWithActiveFlag).active = true;

        const isSVG = useSVG && highlightArea.namespaceURI === SVG_XML_NAMESPACE;

        // highlightArea as ElementCSSInlineStyle (implied by HTMLElement | SVGElement)
        if (isSVG) {
            if (!highlight.drawType) {
                // tslint:disable-next-line:max-line-length
                highlightArea.style.setProperty(
                    "fill",
                    `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})`,
                    "important");
            }
            // tslint:disable-next-line:max-line-length
            highlightArea.style.setProperty(
                "stroke",
                `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})`,
                "important");

            if (!USE_BLEND_MODE) {
                if (!highlight.drawType) {
                    // tslint:disable-next-line:max-line-length
                    highlightArea.style.setProperty(
                        "fill-opacity",
                        `${opacity}`,
                        "important");
                }
                // tslint:disable-next-line:max-line-length
                highlightArea.style.setProperty(
                    "stroke-opacity",
                    `${opacity}`,
                    "important");
            }
        } else {
            // tslint:disable-next-line:max-line-length
            highlightArea.style.setProperty(
                "background-color",
                highlight.drawType === HighlightDrawTypeUnderline ? "transparent" : // underline is border bottom
                (USE_BLEND_MODE ?
                    `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})` :
                    `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity})`),
                "important");
        }

        // if (USE_BLEND_MODE) {
        //     highlightArea.style.setProperty("mix-blend-mode", "multiply", "important");
        //     highlightArea.style.opacity = `${opacity}`;
        // }
        // if (!(DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS)) {
        // tslint:disable-next-line:max-line-length
        //     (highlightArea as HTMLElement).style.outlineColor = `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, 1)`;
        //     (highlightArea as HTMLElement).style.outlineStyle = "solid";
        //     (highlightArea as HTMLElement).style.outlineWidth = "1px";
        //     (highlightArea as HTMLElement).style.outlineOffset = "0px";
        // }
    }
}

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
        // tslint:disable-next-line:max-line-length
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

    const useSVG = !(DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS) && USE_SVG;

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
            if (useSVG && highlightFragment.namespaceURI === SVG_XML_NAMESPACE) {
                let svgRect = highlightFragment.firstElementChild;
                while (svgRect) {
                    if (testHit(svgRect)) {
                        changeCursor = true;
                        hit = true;
                        break;
                    }
                    svgRect = svgRect.nextElementSibling;
                }
                if (hit) {
                    break;
                }
            } else if (highlightFragment.classList.contains(CLASS_HIGHLIGHT_AREA)) {

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
        // const highlightFragments = highlightParent.querySelectorAll(`.${CLASS_HIGHLIGHT_AREA}`);
        // for (const highlightFragment of highlightFragments) {
        // }
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
    const opacity = DEFAULT_BACKGROUND_COLOR_OPACITY;
    if (!foundHighlight || !foundElement) {

        documant.documentElement.classList.remove(CLASS_HIGHLIGHT_CURSOR1);
        documant.documentElement.classList.remove(CLASS_HIGHLIGHT_CURSOR2);

        let highlightContainer = _highlightsContainer.firstElementChild;
        while (highlightContainer) {
            // if (highlightContainer.classList.contains(CLASS_HIGHLIGHT_CONTAINER)) {
            // }
            if (USE_BLEND_MODE) {
                (highlightContainer as HTMLElement).style.setProperty("opacity", `${opacity}`, "important");
            }

            if ((DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS)) {
                let highlightContainerChild = highlightContainer.firstElementChild;
                while (highlightContainerChild) {
                    if (!USE_BLEND_MODE && highlightContainerChild.classList.contains(CLASS_HIGHLIGHT_BOUNDING_AREA_MARGIN)) {
                        resetHighlightBoundingMarginStyle(win, highlightContainerChild as HTMLElement);
                    } else if (highlightContainerChild.classList.contains(CLASS_HIGHLIGHT_BOUNDING_AREA)) {
                        resetHighlightBoundingStyle(win, highlightContainerChild as HTMLElement);
                    } else if (!USE_BLEND_MODE && highlightContainerChild.classList.contains(CLASS_HIGHLIGHT_AREA)) {
                        resetHighlightAreaStyle(win, highlightContainerChild as HTMLElement);
                    } else if (!USE_BLEND_MODE &&
                        useSVG && highlightContainerChild.namespaceURI === SVG_XML_NAMESPACE) {
                        let svgRect = highlightContainerChild.firstElementChild;
                        while (svgRect) {
                            resetHighlightAreaStyle(win, highlightContainerChild as HTMLElement);
                            svgRect = svgRect.nextElementSibling;
                        }
                    }
                    highlightContainerChild = highlightContainerChild.nextElementSibling;
                }
            }

            highlightContainer = highlightContainer.nextElementSibling;
        }
        // const highlightBoundings = _highlightsContainer.querySelectorAll(`.${CLASS_HIGHLIGHT_BOUNDING_AREA}`);
        // for (const highlightBounding of highlightBoundings) {
        // }
        // const allHighlightAreas = _highlightsContainer.querySelectorAll(`.${CLASS_HIGHLIGHT_AREA}`);
        // for (const highlightArea of allHighlightAreas) {
        // }
        // if (USE_BLEND_MODE) {
        //     const allHighlightContainers =
        //         _highlightsContainer.querySelectorAll(`.${CLASS_HIGHLIGHT_CONTAINER}`);
        //     for (const highlightContainer of allHighlightContainers) {
        //     }
        // }
        return;
    }

    if (foundHighlight.pointerInteraction || foundElement.getAttribute("data-click")) {
        const doDrawMarginMarker = drawMarginMarker(foundHighlight);

        if (isMouseMove) {

            if (changeCursor) {
                documant.documentElement.classList.add(doDrawMarginMarker ? CLASS_HIGHLIGHT_CURSOR1 : CLASS_HIGHLIGHT_CURSOR2);
            }

            if (!doDrawMarginMarker) {

                if (doDrawMarginMarker) { // false (satisfies TS compiler in IDE :)

                    const foundElementHighlightBounding = foundElement.querySelector(`.${CLASS_HIGHLIGHT_BOUNDING_AREA}`);

                    const foundElementHighlightBoundingMargin = foundElement.querySelector(`.${CLASS_HIGHLIGHT_BOUNDING_AREA_MARGIN}`);

                    if ((DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS)) {
                        if (foundElementHighlightBounding) {
                            setHighlightBoundingStyle(win, foundElementHighlightBounding as HTMLElement, foundHighlight);
                        }

                        if (foundElementHighlightBoundingMargin) {
                            setHighlightBoundingMarginStyle(win, foundElementHighlightBoundingMargin as HTMLElement, foundHighlight);
                        }
                    }

                    let highlightContainer = _highlightsContainer.firstElementChild;
                    while (highlightContainer) {
                        // if (highlightContainer.classList.contains(CLASS_HIGHLIGHT_CONTAINER)) {
                        // }

                        if (USE_BLEND_MODE) {
                            if (highlightContainer !== foundElement) {
                                (highlightContainer as HTMLElement).style.setProperty("opacity", `${ALT_OTHER_BACKGROUND_COLOR_OPACITY}`, "important");
                            }
                        }

                        if ((DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS)) {
                            let highlightContainerChild: Element | null = highlightContainer.firstElementChild;
                            while (highlightContainerChild) {
                                if (!USE_BLEND_MODE && highlightContainerChild.classList.contains(CLASS_HIGHLIGHT_BOUNDING_AREA_MARGIN)) {
                                    if (!foundElementHighlightBoundingMargin ||
                                        highlightContainerChild !== foundElementHighlightBoundingMargin) {
                                        resetHighlightBoundingMarginStyle(win, highlightContainerChild as HTMLElement);
                                    }
                                } else if (highlightContainerChild.classList.contains(CLASS_HIGHLIGHT_BOUNDING_AREA)) {
                                    if (!foundElementHighlightBounding ||
                                        highlightContainerChild !== foundElementHighlightBounding) {
                                        resetHighlightBoundingStyle(win, highlightContainerChild as HTMLElement);
                                    }
                                } else if (!USE_BLEND_MODE &&
                                    highlightContainerChild.classList.contains(CLASS_HIGHLIGHT_AREA)) {
                                    // if (foundElementHighlightAreas.indexOf(highlightContainerChild) < 0) {
                                    if (highlightContainerChild.parentNode !== foundElement) {
                                        // can also be SVGElement
                                        resetHighlightAreaStyle(win, highlightContainerChild as HTMLElement);
                                    }
                                }
                                highlightContainerChild = highlightContainerChild.nextElementSibling;
                            }
                        }

                        highlightContainer = highlightContainer.nextElementSibling;
                    }
                }

                if (USE_BLEND_MODE) {
                    foundElement.style.setProperty("opacity", `${ALT_BACKGROUND_COLOR_OPACITY}`, "important");
                } else {
                    const foundElementHighlightAreas = foundElement.querySelectorAll(`.${CLASS_HIGHLIGHT_AREA}`);

                    setHighlightAreaStyle(win, foundElementHighlightAreas, foundHighlight); // can also be SVGElement[]
                }

                // const allHighlightAreas = _highlightsContainer.querySelectorAll(`.${CLASS_HIGHLIGHT_AREA}`);
                // for (const highlightArea of allHighlightAreas) {
                // }
                // if (USE_BLEND_MODE) {
                //     const allHighlightContainers =
                //         _highlightsContainer.querySelectorAll(`.${CLASS_HIGHLIGHT_CONTAINER}`);
                //     for (const highlightContainer of allHighlightContainers) {
                //     }
                // }

                // const allHighlightBoundings = _highlightsContainer.querySelectorAll(`.${CLASS_HIGHLIGHT_BOUNDING_AREA}`);
                // for (const highlightBounding of allHighlightBoundings) {
                // }
            }
        } else if (ev.type === "mouseup" || ev.type === "click") {
            ev.preventDefault();
            ev.stopPropagation();

            // if (ev.altKey) {
            //     // recreateAllHighlights(win);
            //     const d = _drawMargin;
            //     _drawMargin = _drawMarginPrevious;
            //     _drawMarginPrevious = d;
            //     recreateAllHighlightsRaw(win);
            // } else {
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
            // }
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
        // _highlightsContainer.style.setProperty(
        //     "pointer-events",
        //     "none",
        //     "important");
        // if (USE_BLEND_MODE) {
        //     const opacity = DEFAULT_BACKGROUND_COLOR_OPACITY;
        //     _highlightsContainer.style.setProperty("mix-blend-mode", "multiply", "important");
        //     _highlightsContainer.style.opacity = `${opacity}`;
        // }
        documant.body.append(_highlightsContainer);
        // documant.documentElement.append(_highlightsContainer);
    }
    return _highlightsContainer;
}

export function hideAllhighlights(_documant: Document) {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- hideAllhighlights: " + _highlights.length);
    }
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
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- destroyAllhighlights: " + _highlights.length);
    }
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

    // tslint:disable-next-line:max-line-length
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
    // destroyHighlight(win.document, id);

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

    const opacity = DEFAULT_BACKGROUND_COLOR_OPACITY;

    const paginated = isPaginated(documant);
    const paginatedTwo = paginated && isTwoPageSpread();

    const rtl = isRTL();
    const vertical = isVerticalWritingMode();

    const doDrawMarginMarker = drawMarginMarker(highlight);

    // checkRangeFix(documant);

    // const highlightsContainer = ensureHighlightsContainer(win);

    const highlightParent = documant.createElement("div") as IHTMLDivElementWithRect;
    highlightParent.setAttribute("id", highlight.id);
    highlightParent.setAttribute("class", `${CLASS_HIGHLIGHT_CONTAINER} ${CLASS_HIGHLIGHT_COMMON}`);
    highlightParent.setAttribute("style",
        "width: 1px !important; " +
        "height: 1px !important; ");
    // highlightParent.style.setProperty(
    //     "pointer-events",
    //     "none",
    //     "important");
    if (highlight.pointerInteraction) {
        highlightParent.setAttribute("data-click", "1");
    }
    if (USE_BLEND_MODE && (!doDrawMarginMarker || !highlight.pointerInteraction)) {

        const styleAttr = win.document.documentElement.getAttribute("style");
        const isNight = styleAttr ? styleAttr.indexOf("readium-night-on") > 0 : false;
        // const isSepia = styleAttr ? styleAttr.indexOf("readium-sepia-on") > 0 : false;

        highlightParent.style.setProperty(
            "mix-blend-mode",
            isNight ? "difference" : "multiply",
            "important");

        highlightParent.style.setProperty("opacity", `${opacity}`, "important");
    }

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

    const useSVG = !(DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS) && USE_SVG;
    const drawUnderline = highlight.drawType === HighlightDrawTypeUnderline && !(DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS);
    const drawStrikeThrough = highlight.drawType === HighlightDrawTypeStrikethrough && !(DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS);

    const doNotMergeHorizontallyAlignedRects = drawUnderline || drawStrikeThrough;

    const ex = highlight.expand ? highlight.expand : 0;

    const rangeClientRects = range.getClientRects();
    // tslint:disable-next-line:max-line-length
    const clientRects =
        // (DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS) ?
        // rangeClientRects :
        getClientRectsNoOverlap_(rangeClientRects, doNotMergeHorizontallyAlignedRects, ex);

    let highlightAreaSVGDocFrag: DocumentFragment | undefined;

    const roundedCorner = 3;
    const underlineThickness = 3;
    const strikeThroughLineThickness = 3;

    const rangeBoundingClientRect = range.getBoundingClientRect();

    const highlightBounding = documant.createElement("div") as IHTMLDivElementWithRect;
    highlightBounding.setAttribute("class", `${CLASS_HIGHLIGHT_BOUNDING_AREA} ${CLASS_HIGHLIGHT_COMMON}`);
    if ((DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS)) {
        // tslint:disable-next-line:max-line-length
        highlightBounding.setAttribute("style",
            "outline-color: magenta !important; " +
            "outline-style: solid !important; " +
            "outline-width: 1px !important; " +
            "outline-offset: -1px !important;");
    }
    // highlightBounding.style.setProperty(
    //     "pointer-events",
    //     "none",
    //     "important");
    highlightBounding.style.setProperty("position", paginated ? "fixed" : "absolute", "important");
    highlightBounding.scale = scale;
    // highlightBounding.xOffset = xOffset;
    // highlightBounding.yOffset = yOffset;
    highlightBounding.rect = {
        height: rangeBoundingClientRect.height,
        left: rangeBoundingClientRect.left - xOffset,
        top: rangeBoundingClientRect.top - yOffset,
        width: rangeBoundingClientRect.width,
    };
    highlightBounding.style.setProperty("width", `${highlightBounding.rect.width * scale}px`, "important");
    highlightBounding.style.setProperty("height", `${highlightBounding.rect.height * scale}px`, "important");
    highlightBounding.style.setProperty("min-width", highlightBounding.style.width, "important");
    highlightBounding.style.setProperty("min-height", highlightBounding.style.height, "important");
    highlightBounding.style.setProperty("left", `${highlightBounding.rect.left * scale}px`, "important");
    highlightBounding.style.setProperty("top", `${highlightBounding.rect.top * scale}px`, "important");
    highlightParent.append(highlightBounding);

    if (doDrawMarginMarker && highlight.pointerInteraction) {
        const MARGIN_MARKER_THICKNESS = 18 / (win.READIUM2.isFixedLayout ? scale : 1);
        const MARGIN_MARKER_OFFSET = 4 / (win.READIUM2.isFixedLayout ? scale : 1);

        const highlightBoundingMargin = documant.createElement("div") as IHTMLDivElementWithRect;
        highlightBoundingMargin.setAttribute("class", `${CLASS_HIGHLIGHT_BOUNDING_AREA_MARGIN} ${CLASS_HIGHLIGHT_COMMON}`);
        const round = MARGIN_MARKER_THICKNESS / 2.5;
        highlightBoundingMargin.setAttribute("style",
            // `border-radius: ${round}px;` +
            `border-top-left-radius: ${vertical ? round : rtl ? 0 : round}px;` +
            `border-top-right-radius: ${vertical ? round : !rtl ? 0 : round}px;` +
            `border-bottom-right-radius: ${vertical ? 0 : !rtl ? 0 :round}px;` +
            `border-bottom-left-radius: ${vertical ? 0 : rtl ? 0 :round}px;` +
            "background-color: " +
                (USE_BLEND_MODE ?
                    // tslint:disable-next-line: max-line-length
                    `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important;` :
                    `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity}) !important;`
            ));

        // highlightBoundingMargin.style.setProperty(
        //     "pointer-events",
        //     "none",
        //     "important");
        highlightBoundingMargin.style.setProperty("position", paginated ? "fixed" : "absolute", "important");
        highlightBoundingMargin.scale = scale;
        // highlightBoundingMargin.xOffset = xOffset;
        // highlightBoundingMargin.yOffset = yOffset;

        const bodyWidth = parseInt(bodyComputedStyle.width, 10);

        const paginatedWidth = scrollElement.clientWidth / (paginatedTwo ? 2 : 1);

        const paginatedOffset = (paginatedWidth - bodyWidth) / 2 +
            parseInt(bodyComputedStyle.paddingLeft, 10) - MARGIN_MARKER_OFFSET - MARGIN_MARKER_THICKNESS;

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
                    -1 * paginatedOffset
                    :
                    paginatedOffset
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
    } else { // doDrawMarginMarker
        for (const clientRect of clientRects) {

            if (useSVG) {
                const borderThickness = 0;

                if (!highlightAreaSVGDocFrag) {
                    highlightAreaSVGDocFrag = documant.createDocumentFragment();
                }

                if (drawUnderline) {
                    // TODO isVerticalWritingMode()

                    // tslint:disable-next-line:max-line-length
                    const highlightAreaSVGLine = documant.createElementNS(SVG_XML_NAMESPACE, "line") as ISVGLineElementWithRect;
                    highlightAreaSVGLine.setAttribute("class", CLASS_HIGHLIGHT_AREA);

                    highlightAreaSVGLine.setAttribute("style",
                        "stroke-linecap: round !important; " +
                        `stroke-width: ${underlineThickness * scale} !important; ` +
                        // tslint:disable-next-line:max-line-length
                        `stroke: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important;` +
                        (USE_BLEND_MODE ? "" : ` stroke-opacity: ${opacity} !important`));
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

                    // if (USE_BLEND_MODE) {
                    //     highlightAreaSVGLine.style.setProperty("mix-blend-mode", "multiply", "important");
                    //     highlightAreaSVGLine.style.opacity = `${opacity}`;
                    // }

                    highlightAreaSVGDocFrag.appendChild(highlightAreaSVGLine);
                } else if (drawStrikeThrough) {
                    // tslint:disable-next-line:max-line-length
                    const highlightAreaSVGLine = documant.createElementNS(SVG_XML_NAMESPACE, "line") as ISVGLineElementWithRect;
                    highlightAreaSVGLine.setAttribute("class", CLASS_HIGHLIGHT_AREA);

                    highlightAreaSVGLine.setAttribute("style",
                        "stroke-linecap: butt !important; " +
                        `stroke-width: ${strikeThroughLineThickness * scale} !important; ` +
                        // tslint:disable-next-line:max-line-length
                        `stroke: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important;` +
                        (USE_BLEND_MODE ? "" : ` stroke-opacity: ${opacity} !important`));
                        // stroke-dasharray: ${lineThickness * 2},${lineThickness * 2};

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

                    // if (USE_BLEND_MODE) {
                    //     highlightAreaSVGLine.style.setProperty("mix-blend-mode", "multiply", "important");
                    //     highlightAreaSVGLine.style.opacity = `${opacity}`;
                    // }

                    highlightAreaSVGDocFrag.appendChild(highlightAreaSVGLine);
                } else {

                    const highlightAreaSVGRect =
                        documant.createElementNS(SVG_XML_NAMESPACE, "rect") as ISVGRectElementWithRect;
                    highlightAreaSVGRect.setAttribute("class", CLASS_HIGHLIGHT_AREA);

                    highlightAreaSVGRect.setAttribute("style",
                        // tslint:disable-next-line:max-line-length
                        `fill: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important; ` +
                        "stroke-width: 0;" +
                        (USE_BLEND_MODE ? "" : ` fill-opacity: ${opacity} !important;`));

                    // tslint:disable-next-line:max-line-length
                    // stroke-width: ${borderThickness}; stroke: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important; stroke-opacity: ${opacity} !important

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

                    // if (USE_BLEND_MODE) {
                    //     highlightAreaSVGRect.style.setProperty("mix-blend-mode", "multiply", "important");
                    //     highlightAreaSVGRect.style.opacity = `${opacity}`;
                    // }

                    highlightAreaSVGDocFrag.appendChild(highlightAreaSVGRect);
                }
            } else {
                if (drawStrikeThrough) {

                    const highlightAreaLine = documant.createElement("div") as IHTMLDivElementWithRect;
                    highlightAreaLine.setAttribute("class", `${CLASS_HIGHLIGHT_AREA} ${CLASS_HIGHLIGHT_COMMON}`);
                    // tslint:disable-next-line:max-line-length
                    highlightAreaLine.setAttribute("style",
                        (USE_BLEND_MODE ?
                            `background-color: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important;` :
                            `background-color: rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity}) !important;`),
                    );
                    // tslint:disable-next-line:max-line-length
                    // highlightArea.setAttribute("style", `outline-color: magenta; outline-style: solid; outline-width: 1px; outline-offset: -1px;`);
                    // highlightAreaLine.style.setProperty(
                    //     "pointer-events",
                    //     "none",
                    //     "important");
                    highlightAreaLine.style.setProperty("transform", "translate3d(0px, 0px, 0px)", "important");
                    highlightAreaLine.style.setProperty("position", paginated ? "fixed" : "absolute", "important");
                    highlightAreaLine.scale = scale;
                    // highlightAreaLine.xOffset = xOffset;
                    // highlightAreaLine.yOffset = yOffset;
                    highlightAreaLine.rect = {
                        height: clientRect.height,
                        left: clientRect.left - xOffset,
                        top: clientRect.top - yOffset,
                        width: clientRect.width,
                    };
                    highlightAreaLine.style.setProperty("width", `${highlightAreaLine.rect.width * scale}px`, "important");
                    highlightAreaLine.style.setProperty("height", `${strikeThroughLineThickness * scale}px`, "important");
                    highlightAreaLine.style.setProperty("min-width", highlightAreaLine.style.width, "important");
                    highlightAreaLine.style.setProperty("min-height", highlightAreaLine.style.height, "important");
                    highlightAreaLine.style.setProperty("left", `${highlightAreaLine.rect.left * scale}px`, "important");
                    // tslint:disable-next-line:max-line-length
                    highlightAreaLine.style.setProperty("top", `${(highlightAreaLine.rect.top + (highlightAreaLine.rect.height / 2) - (strikeThroughLineThickness / 2)) * scale}px`, "important");

                    // if (USE_BLEND_MODE) {
                    //     highlightAreaLine.style.setProperty("mix-blend-mode", "multiply", "important");
                    //     highlightAreaLine.style.opacity = `${opacity}`;
                    // }

                    highlightParent.append(highlightAreaLine);
                } else {

                    const highlightArea = documant.createElement("div") as IHTMLDivElementWithRect;
                    highlightArea.setAttribute("class", `${CLASS_HIGHLIGHT_AREA} ${CLASS_HIGHLIGHT_COMMON}`);
                    let extra = "";
                    if ((DEBUG_VISUALS || win.READIUM2.DEBUG_VISUALS)) {
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
                    } else if (drawUnderline) {
                        // tslint:disable-next-line:max-line-length
                        const side = isVerticalWritingMode() ? "left" : "bottom"; // isRTL()?
                        extra = `border-${side}: ${underlineThickness * scale}px solid ` +
                            (USE_BLEND_MODE ?
                            // tslint:disable-next-line: max-line-length
                            `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important` :
                            `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity}) !important`);
                    }
                    // tslint:disable-next-line:max-line-length
                    highlightArea.setAttribute("style",
                        (drawUnderline ?
                        "" : // background-color: transparent !important
                        ( // `border-radius: ${roundedCorner}px !important; ` +
                        "background-color: " +
                            (USE_BLEND_MODE ?
                                // tslint:disable-next-line: max-line-length
                                `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}) !important;` :
                                `rgba(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue}, ${opacity}) !important;`
                            )
                        )
                        ) + ` ${extra}`);
                    // tslint:disable-next-line:max-line-length
                    // highlightArea.setAttribute("style", `outline-color: magenta; outline-style: solid; outline-width: 1px; outline-offset: -1px;`);
                    // highlightArea.style.setProperty(
                    //     "pointer-events",
                    //     "none",
                    //     "important");
                    highlightArea.style.setProperty("transform", "translate3d(0px, 0px, 0px)", "important");
                    highlightArea.style.setProperty("position", paginated ? "fixed" : "absolute", "important");
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

                    // if (highlight.pointerInteraction) {
                    //     highlightArea.style.setProperty("pointer-events", "auto", "important");
                    // }

                    // if (USE_BLEND_MODE) {
                    //     highlightArea.style.setProperty("mix-blend-mode", "multiply", "important");
                    //     highlightArea.style.opacity = `${opacity}`;
                    // }

                    highlightParent.append(highlightArea);
                }
            }
        }

        if (useSVG && highlightAreaSVGDocFrag) {
            // const highlightAreaSVGG = documant.createElementNS(SVG_XML_NAMESPACE, "g");
            // highlightAreaSVGG.appendChild(highlightAreaSVGDocFrag);
            const highlightAreaSVG = documant.createElementNS(SVG_XML_NAMESPACE, "svg");
            highlightAreaSVG.setAttribute("class", CLASS_HIGHLIGHT_COMMON);
            // highlightAreaSVG.setAttribute("pointer-events", "none");
            highlightAreaSVG.style.setProperty("position", paginated ? "fixed" : "absolute", "important");
            highlightAreaSVG.append(highlightAreaSVGDocFrag);
            highlightParent.append(highlightAreaSVG);
        }
    }


    // highlightsContainer.append(highlightParent);
    return highlightParent;
}
