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

// import { isRTL } from './readium-css';

// const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

export const ID_HIGHLIGHTS_CONTAINER = "R2_ID_HIGHLIGHTS_CONTAINER";
export const CLASS_HIGHLIGHT_CONTAINER = "R2_CLASS_HIGHLIGHT_CONTAINER";
export const CLASS_HIGHLIGHT_AREA = "R2_CLASS_HIGHLIGHT_AREA";

const BACKGROUND_COLOR = "rgba(0, 0, 255, 0.60)";

interface IHighlight {
    id: string;
    selectionInfo: ISelectionInfo;
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

export function recreateAllHighlightsRaw(documant: Document) {
    for (const highlight of _highlights) {
        const highlightContainer = documant.getElementById(highlight.id);
        if (highlightContainer) {
            highlightContainer.remove();
        }
    }
    for (const highlight of _highlights) {
        createHighlightDom(documant, highlight);
    }
}

export const recreateAllHighlightsDebounced = debounce((documant: Document) => {
    recreateAllHighlightsRaw(documant);
}, 250);

export function createHighlight(documant: Document, selectionInfo: ISelectionInfo) {

    // const unique = new Buffer(JSON.stringify(selectionInfo.rangeInfo, null, "")).toString("base64");
    // tslint:disable-next-line:max-line-length
    const unique = new Buffer(`${selectionInfo.rangeInfo.cfi}${selectionInfo.rangeInfo.startContainerElementCssSelector}${selectionInfo.rangeInfo.startContainerChildTextNodeIndex}${selectionInfo.rangeInfo.startOffset}${selectionInfo.rangeInfo.endContainerElementCssSelector}${selectionInfo.rangeInfo.endContainerChildTextNodeIndex}${selectionInfo.rangeInfo.endOffset}`).toString("base64");
    const id = "R2_HIGHLIGHT_" + unique;

    destroyHighlight(documant, id);

    const highlight: IHighlight = {
        id,
        selectionInfo,
    };
    _highlights.push(highlight);

    createHighlightDom(documant, highlight);
}

function createHighlightDom(documant: Document, highlight: IHighlight) {

    const range = convertRangeInfo(highlight.selectionInfo.rangeInfo);
    if (!range) {
        return;
    }

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

    // console.log("documant.body.scrollLeft: " + documant.body.scrollLeft);
    // console.log("documant.body.scrollTop: " + documant.body.scrollTop);

    const rangeRect = range.getBoundingClientRect();
    // console.log("==== rangeRect:");
    // console.log("width: " + rangeRect.width);
    // console.log("height: " + rangeRect.height);
    // console.log("top: " + rangeRect.top);
    // console.log("bottom: " + rangeRect.bottom);
    // console.log("left: " + rangeRect.left);
    // console.log("right: " + rangeRect.right);

    const mainHighlightArea = documant.createElement("div");
    mainHighlightArea.setAttribute("class", CLASS_HIGHLIGHT_AREA);
    mainHighlightArea.setAttribute("style", "background-color: rgba(255, 0, 0, 0.60) !important");
    // mainHighlightArea.style.setProperty("background", "rgba(255, 0, 0, 0.60) !important");
    // mainHighlightArea.style.backgroundColor = "rgba(255, 0, 0, 0.60)";
    mainHighlightArea.style.position = paginated ? "fixed" : "absolute";
    mainHighlightArea.style.width = `${rangeRect.width}px`;
    mainHighlightArea.style.height = `${rangeRect.height}px`;
    mainHighlightArea.style.left = `${rangeRect.left - xOffset}px`;
    mainHighlightArea.style.top = `${rangeRect.top - yOffset}px`;
    highlightContainer.append(mainHighlightArea);

    const clientRects = range.getClientRects(); // ClientRectList | DOMRectList
    for (const clientRect of clientRects) {
        // console.log("==== clientRect:");
        // console.log("width: " + clientRect.width);
        // console.log("height: " + clientRect.height);
        // console.log("top: " + clientRect.top);
        // console.log("bottom: " + clientRect.bottom);
        // console.log("left: " + clientRect.left);
        // console.log("right: " + clientRect.right);
        const highlightArea = documant.createElement("div");
        highlightArea.setAttribute("class", CLASS_HIGHLIGHT_AREA);
        highlightArea.setAttribute("style", "background-color: " + BACKGROUND_COLOR + " !important");
        // highlightArea.style.setProperty("background", BACKGROUND_COLOR + " !important");
        // highlightArea.style.backgroundColor = BACKGROUND_COLOR;
        highlightArea.style.position = paginated ? "fixed" : "absolute";
        highlightArea.style.width = `${clientRect.width}px`;
        highlightArea.style.height = `${clientRect.height}px`;
        highlightArea.style.left = `${clientRect.left - xOffset}px`;
        highlightArea.style.top = `${clientRect.top - yOffset}px`;
        highlightContainer.append(highlightArea);
    }
}
