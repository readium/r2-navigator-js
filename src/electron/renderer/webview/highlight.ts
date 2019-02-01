// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { debounce } from "debounce";

import { ISelectionInfo } from "../../common/selection";
import { convertRangeInfo } from "./selection";

// const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

export const ID_HIGHLIGHTS_CONTAINER = "R2_ID_HIGHLIGHTS_CONTAINER";
export const CLASS_HIGHLIGHT_CONTAINER = "R2_CLASS_HIGHLIGHT_CONTAINER";
export const CLASS_HIGHLIGHT_AREA = "R2_CLASS_HIGHLIGHT_AREA";

const BACKGROUND_COLOR = "rgba(220, 255, 15, 0.40)";

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

    const bodyRect = documant.body.getBoundingClientRect();

    const clientRects = range.getClientRects(); // ClientRectList | DOMRectList
    for (const clientRect of clientRects) {
        const highlightArea = documant.createElement("div");
        highlightArea.setAttribute("class", CLASS_HIGHLIGHT_AREA);

        highlightArea.style.setProperty("background", BACKGROUND_COLOR);

        highlightArea.style.setProperty("position", "absolute");
        highlightArea.style.setProperty("width", `${clientRect.width}px`);
        highlightArea.style.setProperty("height", `${clientRect.height}px`);
        highlightArea.style.setProperty("left", `${clientRect.left - bodyRect.left}px`);
        highlightArea.style.setProperty("top", `${clientRect.top - bodyRect.top}px`);

        highlightContainer.append(highlightArea);
    }
}
