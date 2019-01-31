// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { IRangeInfo, ISelectionInfo } from "../../common/selection";
import { IElectronWebviewTagWindow } from "./state";

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

export function getCurrentSelectionInfo(win: IElectronWebviewTagWindow, getCssSelector: (element: Element) => string):
    ISelectionInfo | undefined {

    const selection = win.getSelection();
    const text = selection.toString().trim();

    if (text.length === 0) {
        return undefined;
    }

    const range = createSingleOrderedRange(
        selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset);

    const rangeInfo = convertRange(range, getCssSelector);
    if (!rangeInfo) {
        return undefined;
    }

    selection.removeAllRanges();
    if (IS_DEV && win.READIUM2.DEBUG_VISUALS) {
        const restoredRange = convertRangeInfo(rangeInfo);
        if (restoredRange) {
            console.log("RESTORING SELECTION RANGE ... ");
            if (restoredRange.startOffset !== range.startOffset) {
                console.log(`RANGE START DIFF! ${restoredRange.startOffset} != ${range.startOffset}`);
            }
            if (restoredRange.endOffset !== range.endOffset) {
                console.log(`RANGE END DIFF! ${restoredRange.endOffset} != ${range.endOffset}`);
            }
            if (restoredRange.startContainer !== range.startContainer) {
                console.log(`RANGE START NODE DIFF!`);
            }
            if (restoredRange.endContainer !== range.endContainer) {
                console.log(`RANGE END NODE DIFF!`);
            }

            setTimeout(() => {
                selection.addRange(restoredRange);
            }, 500);
        } else {
            console.log("CANNOT RESTORE SELECTION RANGE ??!");

            setTimeout(() => {
                selection.addRange(range);
            }, 500);
        }
    } else {
        selection.addRange(range);
    }

    return { rangeInfo, text };
}

export function createSingleOrderedRange(startNode: Node, startOffset: number, endNode: Node, endOffset: number):
    Range {

    const position = startNode.compareDocumentPosition(endNode);

    const reverse = (position === 0 && startOffset > endOffset) ||
        // tslint:disable-next-line:no-bitwise
        (position & Node.DOCUMENT_POSITION_PRECEDING);

    const range = new Range();
    range.setStart(reverse ? endNode : startNode, reverse ? endOffset : startOffset);
    range.setEnd(reverse ? startNode : endNode, reverse ? startOffset : endOffset);
    return range;
}

export function convertRange(range: Range, getCssSelector: (element: Element) => string):
    IRangeInfo | undefined {

    if (!range.startContainer) {
        return undefined;
    }
    let startElement: Element | undefined;
    let startChildTextNodeIndex: number = -1;
    if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
        startElement = range.startContainer as Element;
    } else if (range.startContainer.nodeType === Node.TEXT_NODE &&
        range.startContainer.parentElement) {

        const childIndex = getChildTextNodeIndex(range.startContainer.parentElement, range.startContainer);
        if (childIndex >= 0) {
            startElement = range.startContainer.parentElement;
            startChildTextNodeIndex = childIndex;
        }
    }
    if (!startElement) {
        return undefined;
    }
    const startElementCssSelector = getCssSelector(startElement as Element);

    if (!range.endContainer) {
        return undefined;
    }
    let endElement: Element | undefined;
    let endChildTextNodeIndex: number = -1;
    if (range.endContainer.nodeType === Node.ELEMENT_NODE) {
        endElement = range.endContainer as Element;
    } else if (range.endContainer.nodeType === Node.TEXT_NODE &&
        range.endContainer.parentElement) {

        const childIndex = getChildTextNodeIndex(range.endContainer.parentElement, range.endContainer);
        if (childIndex >= 0) {
            endElement = range.endContainer.parentElement;
            endChildTextNodeIndex = childIndex;
        }
    }
    if (!endElement) {
        return undefined;
    }
    const endElementCssSelector = getCssSelector(endElement as Element);

    return {
        endChildTextNodeIndex,
        endElementCssSelector,
        endTextOffset: range.endOffset,
        startChildTextNodeIndex,
        startElementCssSelector,
        startTextOffset: range.startOffset,
    };
}

export function convertRangeInfo(rangeInfo: IRangeInfo):
    Range | undefined {

    const startElement = document.querySelector(rangeInfo.startElementCssSelector);
    if (!startElement) {
        return undefined;
    }
    const startTextNode = getChildTextNode(startElement, rangeInfo.startChildTextNodeIndex);
    if (!startTextNode) {
        return undefined;
    }

    const endElement = document.querySelector(rangeInfo.endElementCssSelector);
    if (!endElement) {
        return undefined;
    }
    const endTextNode = getChildTextNode(endElement, rangeInfo.endChildTextNodeIndex);
    if (!endTextNode) {
        return undefined;
    }

    return createSingleOrderedRange(startTextNode, rangeInfo.startTextOffset, endTextNode, rangeInfo.endTextOffset);
}

function getChildTextNode(element: Element, index: number): Node | undefined {

    let i = -1;
    for (const childNode of element.childNodes) {
        if (childNode.nodeType === Node.TEXT_NODE) {
            i++;
            if (i === index) {
                return childNode;
            }
        }
    }

    return undefined;
}

function getChildTextNodeIndex(element: Element, child: Node): number {
    let found = -1;
    let textNodeIndex = -1;
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < element.childNodes.length; i++) {
        const childNode = element.childNodes[i];

        if (childNode.nodeType === Node.TEXT_NODE) {
            textNodeIndex++;

            if (childNode === child) {
                found = textNodeIndex;
                break;
            }
        }
    }
    return found;
}
