// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { IRangeInfo, ISelectionInfo } from "../../common/selection";
import { IElectronWebviewTagWindow } from "./state";

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

export function getCurrentSelectionInfo(
    win: IElectronWebviewTagWindow,
    getCssSelector: (element: Element) => string,
    computeElementCFI: (node: Node) => string | undefined,
    ):
    ISelectionInfo | undefined {

    const selection = win.getSelection();
    if (selection.isCollapsed) {
        return undefined;
    }

    const text = selection.toString().trim();

    if (text.length === 0) {
        return undefined;
    }

    let range = createOrderedRange(
        selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset);

    if (range.collapsed) {
        console.log("$$$$$$$$$$$$$$$$$ RANGE COLLAPSED ?!");
        console.log("$$$$$$$$$$$$$$$$$");
        console.log(selection.anchorNode.nodeType); // 3 Node.TEXT_NODE
        if (selection.anchorNode.nodeType === Node.ELEMENT_NODE) { // 1
            console.log(getCssSelector(selection.anchorNode as Element));
        }
        console.log(selection.anchorOffset);
        console.log(selection.focusNode.nodeType);
        if (selection.focusNode.nodeType === Node.ELEMENT_NODE) {
            console.log(getCssSelector(selection.focusNode as Element));
        }
        console.log(selection.focusOffset);
        console.log(selection.isCollapsed);
        console.log("$$$$$$$$$$$$$$$$$");
        console.log(range.startContainer.nodeType);
        if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
            console.log(getCssSelector(range.startContainer as Element));
        }
        console.log(range.startOffset);
        console.log(range.endContainer.nodeType);
        if (range.endContainer.nodeType === Node.ELEMENT_NODE) {
            console.log(getCssSelector(range.endContainer as Element));
        }
        console.log(range.endOffset);
        console.log(range.collapsed);
        console.log("$$$$$$$$$$$$$$$$$");
        if (selection.rangeCount === 1) {
            range = selection.getRangeAt(0); // may not be ordered
            console.log("#############");
            console.log(range.startContainer.nodeType);
            if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
                console.log(getCssSelector(range.startContainer as Element));
            }
            console.log(range.startOffset);
            console.log(range.endContainer.nodeType);
            if (range.endContainer.nodeType === Node.ELEMENT_NODE) {
                console.log(getCssSelector(range.endContainer as Element));
            }
            console.log(range.endOffset);
            console.log(range.collapsed);
            console.log("#############");
            if (range.collapsed) {
                return undefined;
            }
            const orderedRange = createOrderedRange(
                range.startContainer, range.startOffset,
                range.endContainer, range.endOffset);
            console.log("|||||||||||");
            console.log(orderedRange.startContainer.nodeType);
            if (orderedRange.startContainer.nodeType === Node.ELEMENT_NODE) {
                console.log(getCssSelector(orderedRange.startContainer as Element));
            }
            console.log(orderedRange.startOffset);
            console.log(orderedRange.endContainer.nodeType);
            if (orderedRange.endContainer.nodeType === Node.ELEMENT_NODE) {
                console.log(getCssSelector(orderedRange.endContainer as Element));
            }
            console.log(orderedRange.endOffset);
            console.log(orderedRange.collapsed);
            console.log("|||||||||||");
            if (!orderedRange.collapsed) {
                range = orderedRange;
            }
        }
    }

    const rangeInfo = convertRange(range, getCssSelector, computeElementCFI);
    if (!rangeInfo) {
        return undefined;
    }

    // selection.removeAllRanges();
    if (IS_DEV && win.READIUM2.DEBUG_VISUALS) {
        const restoredRange = convertRangeInfo(rangeInfo);
        if (restoredRange) {

            let okay = true;
            if (restoredRange.startOffset !== range.startOffset) {
                okay = false;
                console.log(`RANGE START DIFF! ${restoredRange.startOffset} != ${range.startOffset}`);
            }
            if (restoredRange.endOffset !== range.endOffset) {
                okay = false;
                console.log(`RANGE END DIFF! ${restoredRange.endOffset} != ${range.endOffset}`);
            }
            if (restoredRange.startContainer !== range.startContainer) {
                okay = false;
                console.log(`RANGE START NODE DIFF!`);
            }
            if (restoredRange.endContainer !== range.endContainer) {
                okay = false;
                console.log(`RANGE END NODE DIFF!`);
            }

            if (okay) {
                console.log("SELECTION RANGE RESTORED OKAY (dev check).");
            }

            // setTimeout(() => {
            //     selection.addRange(restoredRange);
            // }, 500);
        } else {
            console.log("CANNOT RESTORE SELECTION RANGE ??!");

            // setTimeout(() => {
            //     selection.addRange(range);
            // }, 500);
        }
    } else {
        // selection.addRange(range);
    }

    return { rangeInfo, text };
}

export function createOrderedRange(startNode: Node, startOffset: number, endNode: Node, endOffset: number):
    Range {

    if (startNode.nodeType === Node.ELEMENT_NODE) {
        if (startOffset >= 0 && startOffset < startNode.childNodes.length) {
            startNode = startNode.childNodes[startOffset];
        }
        startOffset = -1;
    }
    if (endNode.nodeType === Node.ELEMENT_NODE) {
        if (endOffset >= 0 && endOffset < endNode.childNodes.length) {
            endNode = endNode.childNodes[endOffset];
        }
        endOffset = -1;
    }

    const position = startNode.compareDocumentPosition(endNode);

    const reverse = (position === 0 && startOffset > endOffset) ||
        // tslint:disable-next-line:no-bitwise
        (position & Node.DOCUMENT_POSITION_PRECEDING);

    const range = new Range();
    if (startOffset >= 0 && endOffset >= 0) {
        range.setStart(reverse ? endNode : startNode, reverse ? endOffset : startOffset);
        range.setEnd(reverse ? startNode : endNode, reverse ? startOffset : endOffset);
    } else {
        if (reverse) {
            if (endOffset < 0) {
                range.setStartAfter(endNode);
            } else {
                range.setStart(endNode, endOffset);
            }
            if (startOffset < 0) {
                range.setEndBefore(startNode);
            } else {
                range.setEnd(startNode, startOffset);
            }
        } else {
            if (startOffset < 0) {
                range.setStartAfter(startNode);
            } else {
                range.setStart(startNode, startOffset);
            }
            if (endOffset < 0) {
                range.setEndBefore(endNode);
            } else {
                range.setEnd(endNode, endOffset);
            }
        }
    }

    return range;
}

export function convertRange(
    range: Range,
    getCssSelector: (element: Element) => string,
    computeElementCFI: (node: Node) => string | undefined,
    ):
    IRangeInfo | undefined {

    // -----------------
    if (!range.startContainer) {
        return undefined;
    }
    let startElement: Element | undefined;
    let startChildTextNodeIndex: number = -2;
    if (range.startContainer.nodeType === Node.ELEMENT_NODE
        && range.startOffset >= 0 && range.startOffset < range.startContainer.childNodes.length) {
        const startNode = range.startContainer.childNodes[range.startOffset];
        if (startNode && startNode.nodeType === Node.ELEMENT_NODE) {
            startElement = startNode as Element;
            startChildTextNodeIndex = -1;
        }
    } else if (range.startContainer.nodeType === Node.TEXT_NODE &&
        range.startContainer.parentElement) {

        const childIndex =
            getChildTextNodeIndex(range.startContainer.parentElement, range.startContainer as Text, false);
        if (childIndex >= 0) {
            startElement = range.startContainer.parentElement;
            startChildTextNodeIndex = childIndex;
        }
    }
    if (!startElement || startChildTextNodeIndex === -2) {
        return undefined;
    }
    const startElementCssSelector = getCssSelector(startElement);
    // -----------------
    if (!range.endContainer) {
        return undefined;
    }
    let endElement: Element | undefined;
    let endChildTextNodeIndex: number = -2;
    if (range.endContainer.nodeType === Node.ELEMENT_NODE
        && range.endOffset >= 0 && range.endOffset < range.endContainer.childNodes.length) {
        const endNode = range.endContainer.childNodes[range.endOffset];
        if (endNode && endNode.nodeType === Node.ELEMENT_NODE) {
            endElement = endNode as Element;
            endChildTextNodeIndex = -1;
        }
    } else if (range.endContainer.nodeType === Node.TEXT_NODE &&
        range.endContainer.parentElement) {

        const childIndex =
            getChildTextNodeIndex(range.endContainer.parentElement, range.endContainer as Text, false);
        if (childIndex >= 0) {
            endElement = range.endContainer.parentElement;
            endChildTextNodeIndex = childIndex;
        }
    }
    if (!endElement || endChildTextNodeIndex === -2) {
        return undefined;
    }
    const endElementCssSelector = getCssSelector(endElement);
    // -----------------
    let cfi: string | undefined;

    const startElementCfi = computeElementCFI(startElement);
    // console.log(`START CFI: ${startElementCfi}`);
    // console.log(startElement.outerHTML);

    const endElementCfi = computeElementCFI(endElement);
    // console.log(`END CFI: ${endElementCfi}`);
    // console.log(endElement.outerHTML);

    const commonElementAncestor = getCommonAncestorElement(startElement, endElement);
    if (!commonElementAncestor) {
        return undefined;
    }
    if (range.commonAncestorContainer) {
        const rangeCommonAncestorElement = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ?
            range.commonAncestorContainer : range.commonAncestorContainer.parentNode;
        if (rangeCommonAncestorElement && rangeCommonAncestorElement.nodeType === Node.ELEMENT_NODE) {
            if (commonElementAncestor !== rangeCommonAncestorElement) {
                console.log(">>>>>> COMMON ANCESTOR CONTAINER DIFF??!");
                console.log(getCssSelector(commonElementAncestor));
                console.log(getCssSelector(rangeCommonAncestorElement as Element));
            }
        }
    }

    const rootElementCfi = computeElementCFI(commonElementAncestor);
    // console.log(`ROOT CFI: ${rootElementCfi}`);
    // console.log(commonElementAncestor.outerHTML);

    if (rootElementCfi && startElementCfi && endElementCfi) {
        let startElementOrTextCfi = startElementCfi;
        if (startChildTextNodeIndex >= 0) {
            const startChildTextNodeIndexForCfi  =
                getChildTextNodeIndex(startElement, range.startContainer as Text, true);
            startElementOrTextCfi = startElementCfi + "/" + startChildTextNodeIndexForCfi + ":" + range.startOffset;
            // console.log(`START TEXT CFI: ${startTextCfi}`);
        }

        let endElementOrTextCfi = endElementCfi;
        if (endChildTextNodeIndex >= 0) {
            const endChildTextNodeIndexForCfi  =
                getChildTextNodeIndex(endElement, range.endContainer as Text, true);
            endElementOrTextCfi = endElementCfi + "/" + endChildTextNodeIndexForCfi + ":" + range.endOffset;
            // console.log(`END TEXT CFI: ${endTextCfi}`);
        }

        cfi = rootElementCfi + "," +
            startElementOrTextCfi.replace(rootElementCfi, "") + "," +
            endElementOrTextCfi.replace(rootElementCfi, "");
    }

    return {
        cfi,

        endChildTextNodeIndex,
        endElementCssSelector,
        endTextOffset: endChildTextNodeIndex === -1 ? -1 : range.endOffset,

        startChildTextNodeIndex,
        startElementCssSelector,
        startTextOffset: startChildTextNodeIndex === -1 ? -1 : range.startOffset,
    };
}

export function convertRangeInfo(rangeInfo: IRangeInfo):
    Range | undefined {

    const startElement = document.querySelector(rangeInfo.startElementCssSelector);
    if (!startElement) {
        return undefined;
    }
    const endElement = document.querySelector(rangeInfo.endElementCssSelector);
    if (!endElement) {
        return undefined;
    }

    // -------------
    let startNode: Node | undefined | null;
    if (rangeInfo.startChildTextNodeIndex >= 0) {
        startNode = getChildTextNode(startElement, rangeInfo.startChildTextNodeIndex);
        if (!startNode) {
            return undefined;
        }
    } else {
        startNode = startElement.parentNode;
        if (!startNode || startNode.nodeType !== Node.ELEMENT_NODE) {
            return undefined;
        }
    }
    let startOffset = rangeInfo.startTextOffset;
    if (startOffset >= 0) {
        if (startNode.nodeType !== Node.TEXT_NODE) {
            return undefined;
        }
    } else {
        if (startNode.nodeType !== Node.ELEMENT_NODE) {
            return undefined;
        }
        let index = -1;
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < startNode.childNodes.length; i++) {
            const childNode = startNode.childNodes[i];
            if (childNode === startElement) {
                index = i;
                break;
            }
        }
        if (index >= 0) {
            startOffset = index;
        } else {
            return undefined;
        }
    }
    // -------------
    let endNode: Node | undefined | null;
    if (rangeInfo.endChildTextNodeIndex >= 0) {
        endNode = getChildTextNode(endElement, rangeInfo.endChildTextNodeIndex);
        if (!endNode) {
            return undefined;
        }
    } else {
        endNode = endElement.parentNode;
        if (!endNode || endNode.nodeType !== Node.ELEMENT_NODE) {
            return undefined;
        }
    }
    let endOffset = rangeInfo.endTextOffset;
    if (endOffset >= 0) {
        if (endNode.nodeType !== Node.TEXT_NODE) {
            return undefined;
        }
    } else {
        if (endNode.nodeType !== Node.ELEMENT_NODE) {
            return undefined;
        }
        let index = -1;
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < endNode.childNodes.length; i++) {
            const childNode = endNode.childNodes[i];
            if (childNode === endElement) {
                index = i;
                break;
            }
        }
        if (index >= 0) {
            endOffset = index;
        } else {
            return undefined;
        }
    }
    return createOrderedRange(startNode, startOffset, endNode, endOffset);
}

function getChildTextNode(element: Element, index: number): Text | undefined {

    let i = -1;
    for (const childNode of element.childNodes) {
        if (i > index) {
            return undefined;
        }
        if (childNode.nodeType === Node.TEXT_NODE) {
            i++;
            if (i === index) {
                return childNode as Text;
            }
        }
    }

    return undefined;
}

function getChildTextNodeIndex(element: Element, child: Text, forCfi: boolean): number {
    let found = -1;
    let textNodeIndex = -1;
    let previousWasElement = false;
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < element.childNodes.length; i++) {
        const childNode = element.childNodes[i];
        if (childNode.nodeType !== Node.TEXT_NODE && childNode.nodeType !== Node.ELEMENT_NODE) {
            continue;
        }
        if (forCfi) {
            if (childNode.nodeType === Node.TEXT_NODE || previousWasElement) {
                textNodeIndex += 2;
            }
        }
        if (childNode.nodeType === Node.TEXT_NODE) {
            if (!forCfi) {
                textNodeIndex++;
            }

            if (childNode === child) {
                found = textNodeIndex;
                break;
            }
        }
        previousWasElement = childNode.nodeType === Node.ELEMENT_NODE;
    }
    return found;
}

function getCommonAncestorElement(node1: Node, node2: Node): Element | undefined {
    if (node1.nodeType === Node.ELEMENT_NODE && node1 === node2) {
        return node1 as Element;
    }

    if (node1.nodeType === Node.ELEMENT_NODE && node1.contains(node2)) {
        return node1 as Element;
    }

    if (node2.nodeType === Node.ELEMENT_NODE && node2.contains(node1)) {
        return node2 as Element;
    }

    const node1ElementAncestorChain: Element[] = [];
    let parent: Node | null = node1.parentNode;
    while (parent && parent.nodeType === Node.ELEMENT_NODE) {
        node1ElementAncestorChain.push(parent as Element);
        parent = parent.parentNode;
    }

    const node2ElementAncestorChain: Element[] = [];
    parent = node2.parentNode;
    while (parent && parent.nodeType === Node.ELEMENT_NODE) {
        node2ElementAncestorChain.push(parent as Element);
        parent = parent.parentNode;
    }

    let commonAncestor = node1ElementAncestorChain.find((node1ElementAncestor) => {
        return node2ElementAncestorChain.indexOf(node1ElementAncestor) >= 0;
    });
    if (!commonAncestor) {
        commonAncestor = node2ElementAncestorChain.find((node2ElementAncestor) => {
            return node1ElementAncestorChain.indexOf(node2ElementAncestor) >= 0;
        });
    }

    return commonAncestor;
}
