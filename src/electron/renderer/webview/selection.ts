// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { IRangeInfo, ISelectedTextInfo, ISelectionInfo } from "../../common/selection";
import { ReadiumElectronWebviewWindow } from "./state";
import { ipcRenderer } from "electron";

import { R2_EVENT_READING_LOCATION_CLEAR_SELECTION } from "../../common/events";

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

// https://developer.mozilla.org/en-US/docs/Web/API/Selection

// const win = global.window as ReadiumElectronWebviewWindow;

function dumpDebug(
    msg: string,
    startNode: Node, startOffset: number,
    endNode: Node, endOffset: number,
    getCssSelector: (element: Element) => string,
) {
    console.log("$$$$$$$$$$$$$$$$$ " + msg);
    console.log("**** START");
    console.log("Node type (1=element, 3=text): " + startNode.nodeType);
    if (startNode.nodeType === Node.ELEMENT_NODE) {
        console.log("CSS Selector: " + getCssSelector(startNode as Element));
        console.log("Element children count: " + startNode.childNodes.length);
        if (startOffset >= 0 && startOffset < startNode.childNodes.length) {
            console.log("Child node type (1=element, 3=text): " + startNode.childNodes[startOffset].nodeType);
            if (startNode.childNodes[endOffset].nodeType === Node.ELEMENT_NODE) {
                console.log("Child CSS Selector: " + getCssSelector(startNode.childNodes[endOffset] as Element));
            }
        } else {
            console.log("startOffset >= 0 && startOffset < startNode.childNodes.length ... " +
                startOffset + " // " + startNode.childNodes.length);
        }
    }
    if (startNode.parentNode && startNode.parentNode.nodeType === Node.ELEMENT_NODE) {
        console.log("- Parent CSS Selector: " + getCssSelector(startNode.parentNode as Element));
        console.log("- Parent element children count: " + startNode.parentNode.childNodes.length);
    }
    console.log("Offset: " + startOffset);
    console.log("**** END");
    console.log("Node type (1=element, 3=text): " + endNode.nodeType);
    if (endNode.nodeType === Node.ELEMENT_NODE) {
        console.log("CSS Selector: " + getCssSelector(endNode as Element));
        console.log("Element children count: " + endNode.childNodes.length);
        if (endOffset >= 0 && endOffset < endNode.childNodes.length) {
            console.log("Child node type (1=element, 3=text): " + endNode.childNodes[endOffset].nodeType);
            if (endNode.childNodes[endOffset].nodeType === Node.ELEMENT_NODE) {
                console.log("Child CSS Selector: " + getCssSelector(endNode.childNodes[endOffset] as Element));
            }
        } else {
            console.log("endOffset >= 0 && endOffset < endNode.childNodes.length ... " +
                endOffset + " // " + endNode.childNodes.length);
        }
    }
    if (endNode.parentNode && endNode.parentNode.nodeType === Node.ELEMENT_NODE) {
        console.log("- Parent CSS Selector: " + getCssSelector(endNode.parentNode as Element));
        console.log("- Parent element children count: " + endNode.parentNode.childNodes.length);
    }
    console.log("Offset: " + endOffset);
    console.log("$$$$$$$$$$$$$$$$$");
}

let _selectionChangeTimeout: number | undefined = undefined;
let _ignoreSelectionChangeEvent: boolean = false;
export const setSelectionChangeAction = (win: ReadiumElectronWebviewWindow, func: () => void) => {
    win.document?.addEventListener("selectionchange", (_ev: Event) => {
        if (_selectionChangeTimeout !== undefined) {
            win.clearTimeout(_selectionChangeTimeout);
        }
        if (_ignoreSelectionChangeEvent) {
            // console.log("############ selectionchange SKIP");
            _ignoreSelectionChangeEvent = false;
            return;
        }
        // console.log("############ selectionchange OK");
        func();
    });
};

export function clearCurrentSelection(win: ReadiumElectronWebviewWindow) {
    const selection = win.getSelection();
    if (!selection) {
        return;
    }
    // if (!selection.isCollapsed) {
    //     _ignoreSelectionChangeEvent = true;
    // }
    _ignoreSelectionChangeEvent = true;
    _selectionChangeTimeout = win.setTimeout(() => {
        // console.log("############ selectionchange TIMEOUT");
        _ignoreSelectionChangeEvent = false;
        _selectionChangeTimeout = undefined;
    }, 200);
    selection.removeAllRanges();
    // selection.empty();
    // selection.collapseToStart();

    if (win.READIUM2.locationHashOverrideInfo?.selectionInfo) {
        win.READIUM2.locationHashOverrideInfo.selectionInfo = undefined;
    }

    ipcRenderer.sendToHost(R2_EVENT_READING_LOCATION_CLEAR_SELECTION);
}

export const collapseWhitespaces = (str: string) => {
    return str.replace(/[\r\n]/g, " ").replace(/\s\s+/g, " ");
};

export const cleanupStr = (str: string) => {
    return collapseWhitespaces(str).trim();
};

export function getCurrentSelectionInfo(
    win: ReadiumElectronWebviewWindow,
    getCssSelector: (element: Element) => string,
    computeElementCFI: (node: Node) => string | undefined,
):
    ISelectionInfo | undefined {

    const selection = win.getSelection();
    if (!selection) {
        return undefined;
    }
    if (selection.isCollapsed) {
        console.log("^^^ SELECTION COLLAPSED.");
        return undefined;
    }

    // rawText is in fact already clean! (Selection API does it)
    const rawText = selection.toString();
    const cleanText = collapseWhitespaces(rawText);
    if (cleanText.length === 0) {
        console.log("^^^ SELECTION TEXT EMPTY.");
        return undefined;
    }

    if (!selection.anchorNode || !selection.focusNode) {
        return undefined;
    }
    const r = selection.rangeCount === 1 ? selection.getRangeAt(0) :
        createOrderedRange(selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset);
    if (!r || r.collapsed) {
        console.log("$$$$$$$$$$$$$$$$$ CANNOT GET NON-COLLAPSED SELECTION RANGE?!");
        return undefined;
    }

    const range = normalizeRange(r);
    if (IS_DEV) {
        if (range.startContainer !== r.startContainer) {
            console.log(">>>>>>>>>>>>>>>>>>>>>>> SELECTION RANGE NORMALIZE diff: startContainer");
            console.log(range.startContainer);
            console.log(r.startContainer);
        }
        if (range.startOffset !== r.startOffset) {
            console.log(">>>>>>>>>>>>>>>>>>>>>>> SELECTION RANGE NORMALIZE diff: startOffset");
            console.log(`${range.startOffset} !== ${r.startOffset}`);
        }
        if (range.endContainer !== r.endContainer) {
            console.log(">>>>>>>>>>>>>>>>>>>>>>> SELECTION RANGE NORMALIZE diff: endContainer");
            console.log(range.endContainer);
            console.log(r.endContainer);
        }
        if (range.endOffset !== r.endOffset) {
            console.log(">>>>>>>>>>>>>>>>>>>>>>> SELECTION RANGE NORMALIZE diff: endOffset");
            console.log(`${range.endOffset} !== ${r.endOffset}`);
        }
    }

    const tuple = convertRange(range, getCssSelector, computeElementCFI);
    if (!tuple) {
        console.log("^^^ SELECTION RANGE INFO FAIL?!");
        return undefined;
    }
    const rangeInfo = tuple[0];
    const textInfo = tuple[1];

    if (IS_DEV) {
        if (textInfo.cleanText !== cleanText) {
            console.log(">>>>>>>>>>>>>>>>>>>>>>> SELECTION TEXT INFO diff: cleanText");
            console.log(`${textInfo.cleanText} !== ${cleanText}`);
        }
        if (textInfo.rawText !== rawText) {
            console.log(">>>>>>>>>>>>>>>>>>>>>>> SELECTION TEXT INFO diff: rawText");
            console.log(`${textInfo.rawText} !== ${rawText}`);
        }
    }

    // selection.removeAllRanges();
    if (IS_DEV && win.READIUM2.DEBUG_VISUALS) {
        const restoredRange = convertRangeInfo(win.document, rangeInfo);
        if (restoredRange) {
            if (restoredRange.startOffset === range.startOffset &&
                restoredRange.endOffset === range.endOffset &&
                restoredRange.startContainer === range.startContainer &&
                restoredRange.endContainer === range.endContainer) {
                console.log("SELECTION RANGE RESTORED OKAY (dev check).");
            } else {
                console.log("SELECTION RANGE RESTORE FAIL (dev check).");
                // tslint:disable-next-line:max-line-length
                dumpDebug("SELECTION", selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset, getCssSelector);
                // tslint:disable-next-line:max-line-length
                dumpDebug("ORDERED RANGE FROM SELECTION", range.startContainer, range.startOffset, range.endContainer, range.endOffset, getCssSelector);
                // tslint:disable-next-line:max-line-length
                dumpDebug("RESTORED RANGE", restoredRange.startContainer, restoredRange.startOffset, restoredRange.endContainer, restoredRange.endOffset, getCssSelector);
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

    return {
        rangeInfo,

        cleanBefore: textInfo.cleanBefore,
        cleanText: textInfo.cleanText,
        cleanAfter: textInfo.cleanAfter,

        rawBefore: textInfo.rawBefore,
        rawText: textInfo.rawText,
        rawAfter: textInfo.rawAfter,
    };
}

export function createOrderedRange(startNode: Node, startOffset: number, endNode: Node, endOffset: number):
    Range | undefined {

    const range = new Range(); // document.createRange()
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    if (!range.collapsed) {
        // console.log(">>> createOrderedRange RANGE OK");
        return range;
    }

    console.log(">>> createOrderedRange COLLAPSED ... RANGE REVERSE?");
    const rangeReverse = new Range(); // document.createRange()
    rangeReverse.setStart(endNode, endOffset);
    rangeReverse.setEnd(startNode, startOffset);
    if (!rangeReverse.collapsed) {
        console.log(">>> createOrderedRange RANGE REVERSE OK.");
        return range;
    }

    console.log(">>> createOrderedRange RANGE REVERSE ALSO COLLAPSED?!");
    return undefined;

    // let startNode = startNode_;
    // let startOffset = startOffset_;
    // if (startNode.nodeType === Node.ELEMENT_NODE) {
    //     if (startOffset >= 0 && startOffset < startNode.childNodes.length) {
    //         startNode = startNode.childNodes[startOffset];
    //     }
    //     startOffset = -1;
    // }

    // let endNode = endNode_;
    // let endOffset = endOffset_;
    // if (endNode.nodeType === Node.ELEMENT_NODE) {
    //     if (endOffset >= 0 && endOffset < endNode.childNodes.length) {
    //         endNode = endNode.childNodes[endOffset];
    //     }
    //     endOffset = -1;
    // }

    // const position = startNode.compareDocumentPosition(endNode);

    // const reverse1 = position === 0 && startOffset > endOffset;
    // // tslint:disable-next-line:no-bitwise
    // const reverse2 = position & Node.DOCUMENT_POSITION_PRECEDING;
    // const reverse = reverse1 || reverse2;
    // console.log("{{{{{{{{{{{ reverse: " + reverse + " (" + reverse1 + " // " + reverse2 + ")");

    // const range = new Range(); // document.createRange()
    // if (startOffset >= 0 && endOffset >= 0) {
    //     range.setStart(reverse ? endNode : startNode, reverse ? endOffset : startOffset);
    //     range.setEnd(reverse ? startNode : endNode, reverse ? startOffset : endOffset);
    // } else {
    //     if (reverse) {
    //         if (endOffset < 0) {
    //             range.setStartAfter(endNode);
    //         } else {
    //             range.setStart(endNode, endOffset);
    //         }
    //         if (startOffset < 0) {
    //             range.setEndBefore(startNode);
    //         } else {
    //             range.setEnd(startNode, startOffset);
    //         }
    //     } else {
    //         if (startOffset < 0) {
    //             range.setStartAfter(startNode);
    //         } else {
    //             range.setStart(startNode, startOffset);
    //         }
    //         if (endOffset < 0) {
    //             range.setEndBefore(endNode);
    //         } else {
    //             range.setEnd(endNode, endOffset);
    //         }
    //     }
    // }

    // return range;
}

export function convertRange(
    range: Range,
    getCssSelector: (element: Element) => string,
    computeElementCFI: (node: Node) => string | undefined,
):
    [IRangeInfo, ISelectedTextInfo] | undefined {

    // -----------------
    const startIsElement = range.startContainer.nodeType === Node.ELEMENT_NODE;
    const startContainerElement = startIsElement ?
        range.startContainer as Element :
        ((range.startContainer.parentNode && range.startContainer.parentNode.nodeType === Node.ELEMENT_NODE) ?
            range.startContainer.parentNode as Element : undefined);
    if (!startContainerElement) {
        return undefined;
    }
    const startContainerChildTextNodeIndex = startIsElement ? -1 :
        Array.from(startContainerElement.childNodes).indexOf(range.startContainer as ChildNode);
    if (startContainerChildTextNodeIndex < -1) {
        return undefined;
    }
    const startContainerElementCssSelector = getCssSelector(startContainerElement);
    // -----------------
    const endIsElement = range.endContainer.nodeType === Node.ELEMENT_NODE;
    const endContainerElement = endIsElement ?
        range.endContainer as Element :
        ((range.endContainer.parentNode && range.endContainer.parentNode.nodeType === Node.ELEMENT_NODE) ?
            range.endContainer.parentNode as Element : undefined);
    if (!endContainerElement) {
        return undefined;
    }
    const endContainerChildTextNodeIndex = endIsElement ? -1 :
        Array.from(endContainerElement.childNodes).indexOf(range.endContainer as ChildNode);
    if (endContainerChildTextNodeIndex < -1) {
        return undefined;
    }
    const endContainerElementCssSelector = getCssSelector(endContainerElement);
    // -----------------
    const commonElementAncestor = getCommonAncestorElement(range.startContainer, range.endContainer);
    if (!commonElementAncestor) {
        console.log("^^^ NO RANGE COMMON ANCESTOR?!");
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
    // -----------------
    const SELECTION_BEFORE_AFTER_TEXT_LENGTH = 30;

    let rawBefore = "";
    const rawText = range.toString();
    let rawAfter = "";

    let cleanBefore = "";
    const cleanText = collapseWhitespaces(rawText);
    let cleanAfter = "";

    let currentParent = commonElementAncestor;
    while (currentParent) {
        if (currentParent.tagName?.toLowerCase() === "html") {
            break;
        }

        const beforeNeedsToGrow = cleanBefore.length < SELECTION_BEFORE_AFTER_TEXT_LENGTH;
        const afterNeedsToGrow = cleanAfter.length < SELECTION_BEFORE_AFTER_TEXT_LENGTH;
        if (!beforeNeedsToGrow && !afterNeedsToGrow) {
            break;
        }

        if (beforeNeedsToGrow) {
            try {
                const rangeBefore = new Range(); // commonElementAncestor.ownerDocument.createRange()
                rangeBefore.setStartBefore(currentParent);
                // rangeBefore.setStart(currentParent, 0);
                // rangeBefore.setEndBefore(range.startContainer);
                rangeBefore.setEnd(range.startContainer, range.startOffset);
                rawBefore = rangeBefore.toString();
                cleanBefore = collapseWhitespaces(rawBefore);
                if (cleanBefore.length > SELECTION_BEFORE_AFTER_TEXT_LENGTH) {
                    cleanBefore = cleanBefore.substring(cleanBefore.length - SELECTION_BEFORE_AFTER_TEXT_LENGTH, cleanBefore.length);
                }
            } catch (ex1) {
                console.log(ex1);
            }
        }

        if (afterNeedsToGrow) {
            try {
                const rangeAfter = new Range(); // commonElementAncestor.ownerDocument.createRange()
                rangeAfter.setStart(range.endContainer, range.endOffset);
                rangeAfter.setEndAfter(currentParent);
                rawAfter = rangeAfter.toString();
                cleanAfter = collapseWhitespaces(rawAfter);
                if (cleanAfter.length > SELECTION_BEFORE_AFTER_TEXT_LENGTH) {
                    cleanAfter = cleanAfter.substring(0, SELECTION_BEFORE_AFTER_TEXT_LENGTH);
                }
            } catch (ex2) {
                console.log(ex2);
            }
        }

        if (currentParent.tagName?.toLowerCase() === "body") {
            break;
        }
        currentParent = currentParent.parentNode as Element;
    }
    if (cleanBefore.length) {
        let j = 0;
        let i = rawBefore.length - 1;
        let wasWhiteSpace = false;
        for (; i >= 0; i--) {
            const isWhiteSpace = /[\r\n\s]/.test(rawBefore[i]);
            if (isWhiteSpace && i !== 0 && i !== rawBefore.length - 1 && wasWhiteSpace) {
                wasWhiteSpace = isWhiteSpace;
                continue;
            }
            wasWhiteSpace = isWhiteSpace;
            j++;
            if (j >= cleanBefore.length) {
                break;
            }
        }
        rawBefore = rawBefore.substring(i, rawBefore.length);
    }
    if (cleanAfter.length) {
        let j = 0;
        let i = 0;
        let wasWhiteSpace = false;
        for (; i < rawAfter.length; i++) {
            const isWhiteSpace = /[\r\n\s]/.test(rawAfter[i]);
            if (isWhiteSpace && i !== 0 && i !== rawAfter.length - 1 && wasWhiteSpace) {
                wasWhiteSpace = isWhiteSpace;
                continue;
            }
            wasWhiteSpace = isWhiteSpace;
            j++;
            if (j >= cleanAfter.length) {
                break;
            }
        }
        rawAfter = rawAfter.substring(0, i + 1);
    }

    // -----------------
    const rootElementCfi = computeElementCFI(commonElementAncestor);
    // console.log(`ROOT CFI: ${rootElementCfi}`);
    // console.log(commonElementAncestor.outerHTML);

    const startElementCfi = computeElementCFI(startContainerElement);
    // console.log(`START CFI: ${startElementCfi}`);
    // console.log(startContainerElement.outerHTML);

    const endElementCfi = computeElementCFI(endContainerElement);
    // console.log(`END CFI: ${endElementCfi}`);
    // console.log(endContainerElement.outerHTML);

    let cfi: string | undefined;

    if (rootElementCfi && startElementCfi && endElementCfi) {
        let startElementOrTextCfi = startElementCfi;
        if (!startIsElement) {
            const startContainerChildTextNodeIndexForCfi =
                getChildTextNodeCfiIndex(startContainerElement, range.startContainer as Text);
            // startContainerChildTextNodeIndex ===
            // Array.from(startContainerElement.childNodes).indexOf(range.startContainer as ChildNode)
            startElementOrTextCfi = startElementCfi + "/" +
                startContainerChildTextNodeIndexForCfi + ":" + range.startOffset;
        } else {
            if (range.startOffset >= 0 && range.startOffset < startContainerElement.childNodes.length) {
                const childNode = startContainerElement.childNodes[range.startOffset];
                if (childNode.nodeType === Node.ELEMENT_NODE) {
                    startElementOrTextCfi = startElementCfi + "/" + ((range.startOffset + 1) * 2);
                } else {
                    const cfiTextNodeIndex = getChildTextNodeCfiIndex(startContainerElement, childNode as Text);
                    startElementOrTextCfi = startElementCfi + "/" + cfiTextNodeIndex; // + ":0";
                }
            } else {
                const cfiIndexOfLastElement = ((startContainerElement.childElementCount) * 2);
                const lastChildNode = startContainerElement.childNodes[startContainerElement.childNodes.length - 1];
                if (lastChildNode.nodeType === Node.ELEMENT_NODE) {
                    startElementOrTextCfi = startElementCfi + "/" + (cfiIndexOfLastElement + 1);
                } else {
                    startElementOrTextCfi = startElementCfi + "/" + (cfiIndexOfLastElement + 2);
                }
            }
        }
        // console.log(`START TEXT CFI: ${startTextCfi}`);

        let endElementOrTextCfi = endElementCfi;
        if (!endIsElement) {
            const endContainerChildTextNodeIndexForCfi =
                getChildTextNodeCfiIndex(endContainerElement, range.endContainer as Text);
            // endContainerChildTextNodeIndex ===
            // Array.from(endContainerElement.childNodes).indexOf(range.endContainer as ChildNode)
            endElementOrTextCfi = endElementCfi + "/" +
                endContainerChildTextNodeIndexForCfi + ":" + range.endOffset;
        } else {
            if (range.endOffset >= 0 && range.endOffset < endContainerElement.childNodes.length) {
                const childNode = endContainerElement.childNodes[range.endOffset];
                if (childNode.nodeType === Node.ELEMENT_NODE) {
                    endElementOrTextCfi = endElementCfi + "/" + ((range.endOffset + 1) * 2);
                } else {
                    const cfiTextNodeIndex = getChildTextNodeCfiIndex(endContainerElement, childNode as Text);
                    endElementOrTextCfi = endElementCfi + "/" + cfiTextNodeIndex; // + ":0";
                }
            } else {
                const cfiIndexOfLastElement = ((endContainerElement.childElementCount) * 2);
                const lastChildNode = endContainerElement.childNodes[endContainerElement.childNodes.length - 1];
                if (lastChildNode.nodeType === Node.ELEMENT_NODE) {
                    endElementOrTextCfi = endElementCfi + "/" + (cfiIndexOfLastElement + 1);
                } else {
                    endElementOrTextCfi = endElementCfi + "/" + (cfiIndexOfLastElement + 2);
                }
            }
        }
        // console.log(`END TEXT CFI: ${endTextCfi}`);

        cfi = rootElementCfi + "," +
            startElementOrTextCfi.replace(rootElementCfi, "") + "," +
            endElementOrTextCfi.replace(rootElementCfi, "");
    }
    // -----------------
    return [{
        cfi,

        endContainerChildTextNodeIndex,
        endContainerElementCFI: endElementCfi,
        endContainerElementCssSelector,
        endOffset: range.endOffset,

        startContainerChildTextNodeIndex,
        startContainerElementCFI: startElementCfi,
        startContainerElementCssSelector,
        startOffset: range.startOffset,
    }, {
        cleanBefore,
        cleanText,
        cleanAfter,

        rawBefore,
        rawText,
        rawAfter,
    }];
}

export function convertRangeInfo(documant: Document, rangeInfo: IRangeInfo):
    Range | undefined {

    const startElement = documant.querySelector(rangeInfo.startContainerElementCssSelector);
    if (!startElement) {
        console.log("^^^ convertRangeInfo NO START ELEMENT CSS SELECTOR?!", rangeInfo.startContainerElementCssSelector);
        return undefined;
    }
    let startContainer: Node = startElement;
    if (rangeInfo.startContainerChildTextNodeIndex >= 0) {
        if (rangeInfo.startContainerChildTextNodeIndex >= startElement.childNodes.length) {
            // tslint:disable-next-line:max-line-length
            console.log("^^^ convertRangeInfo rangeInfo.startContainerChildTextNodeIndex >= startElement.childNodes.length?!");
            return undefined;
        }
        startContainer = startElement.childNodes[rangeInfo.startContainerChildTextNodeIndex];
        if (startContainer.nodeType !== Node.TEXT_NODE) {
            console.log("^^^ convertRangeInfo startContainer.nodeType !== Node.TEXT_NODE?!");
            return undefined;
        }
    }
    const endElement = documant.querySelector(rangeInfo.endContainerElementCssSelector);
    if (!endElement) {
        console.log("^^^ convertRangeInfo NO END ELEMENT CSS SELECTOR?!", rangeInfo.endContainerElementCssSelector);
        return undefined;
    }
    let endContainer: Node = endElement;
    if (rangeInfo.endContainerChildTextNodeIndex >= 0) {
        if (rangeInfo.endContainerChildTextNodeIndex >= endElement.childNodes.length) {
            // tslint:disable-next-line:max-line-length
            console.log("^^^ convertRangeInfo rangeInfo.endContainerChildTextNodeIndex >= endElement.childNodes.length?!");
            return undefined;
        }
        endContainer = endElement.childNodes[rangeInfo.endContainerChildTextNodeIndex];
        if (endContainer.nodeType !== Node.TEXT_NODE) {
            console.log("^^^ convertRangeInfo endContainer.nodeType !== Node.TEXT_NODE?!");
            return undefined;
        }
    }

    return createOrderedRange(startContainer, rangeInfo.startOffset, endContainer, rangeInfo.endOffset);
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

function isCfiTextNode(node: Node) {
    return node.nodeType !== Node.ELEMENT_NODE;
    // return node.nodeType === Node.TEXT_NODE ||
    //     node.nodeType === Node.COMMENT_NODE ||
    //     node.nodeType === Node.CDATA_SECTION_NODE; // other?
}
function getChildTextNodeCfiIndex(element: Element, child: Text): number {
    let found = -1;
    let textNodeIndex = -1;
    let previousWasElement = false;
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < element.childNodes.length; i++) {
        const childNode = element.childNodes[i];
        const isText = isCfiTextNode(childNode);
        if (isText || previousWasElement) {
            textNodeIndex += 2;
        }
        if (isText) {
            if (childNode === child) {
                found = textNodeIndex;
                break;
            }
        }
        previousWasElement = childNode.nodeType === Node.ELEMENT_NODE;
    }
    return found;
}

// function getChildTextNode(element: Element, index: number): Text | undefined {

//     let i = -1;
//     for (const childNode of element.childNodes) {
//         if (i > index) {
//             return undefined;
//         }
//         if (childNode.nodeType === Node.TEXT_NODE) {
//             i++;
//             if (i === index) {
//                 return childNode as Text;
//             }
//         }
//     }

//     return undefined;
// }

// function getChildTextNodeIndex(element: Element, child: Text, forCfi: boolean): number {
//     let found = -1;
//     let textNodeIndex = -1;
//     let previousWasElement = false;
//     // tslint:disable-next-line:prefer-for-of
//     for (let i = 0; i < element.childNodes.length; i++) {
//         const childNode = element.childNodes[i];
//         if (childNode.nodeType !== Node.TEXT_NODE && childNode.nodeType !== Node.ELEMENT_NODE) {
//             continue;
//         }
//         if (forCfi) {
//             if (childNode.nodeType === Node.TEXT_NODE || previousWasElement) {
//                 textNodeIndex += 2;
//             }
//         }
//         if (childNode.nodeType === Node.TEXT_NODE) {
//             if (!forCfi) {
//                 textNodeIndex++;
//             }

//             if (childNode === child) {
//                 found = textNodeIndex;
//                 break;
//             }
//         }
//         previousWasElement = childNode.nodeType === Node.ELEMENT_NODE;
//     }
//     return found;
// }

//  https://github.com/webmodules/range-normalize/pull/2
// https://github.com/apache/incubator-annotator/blob/main/packages/dom/src/normalize-range.ts
//  "Normalizes" the DOM Range instance, such that slight variations in the start
//  and end containers end up being normalized to the same "base" representation.
//  The aim is to always have `startContainer` and `endContainer` pointing to
//  TextNode instances.
//  Pseudo-logic is as follows:
//  - Expand the boundaries if they fall between siblings.
//  - Narrow the boundaries until they point at leaf nodes.
//  - Is the start container excluded by its offset?
//    - Move it to the next leaf Node, but not past the end container.
//    - Is the start container a leaf Node but not a TextNode?
//      - Set the start boundary to be before the Node.
//  - Is the end container excluded by its offset?
//    - Move it to the previous leaf Node, but not past the start container.
//    - Is the end container a leaf Node but not a TextNode?
//      - Set the end boundary to be after the Node.
//  @param {Range} range - DOM Range instance to "normalize"
//  @return {Range} returns a "normalized" clone of `range`
export function normalizeRange(r: Range) {

    const range = r.cloneRange(); // new Range(); // document.createRange()

    let sc = range.startContainer;
    let so = range.startOffset;
    let ec = range.endContainer;
    let eo = range.endOffset;

    // Move the start container to the last leaf before any sibling boundary.
    if (sc.childNodes.length && so > 0) {
        sc = lastLeaf(sc.childNodes[so - 1]);
        so = (sc as CharacterData).length || 0;
    }

    // Move the end container to the first leaf after any sibling boundary.
    if (eo < ec.childNodes.length) {
        ec = firstLeaf(ec.childNodes[eo]);
        eo = 0;
    }

    // Move each container inward until it reaches a leaf Node.
    let start: Node | null = firstLeaf(sc);
    let end: Node | null = lastLeaf(ec);

    // Define a predicate to check if a Node is a leaf Node inside the Range.
    function isLeafNodeInRange(node: Node): boolean {
        if (node.childNodes.length) {
            return false;
        }

        const length = (node as CharacterData).length || 0;
        if (node === sc && so === length) {
            return false;
        }
        if (node === ec && eo === 0) {
            return false;
        }
        return true;
    }

    // Move the start container until it is included or collapses to the end.
    while (start && !isLeafNodeInRange(start) && start !== end) {
        start = documentForward(start);
    }

    if (start === sc) {
        range.setStart(sc, so);
    } else if (start !== null) {
        if (start.nodeType === 3) {
            range.setStart(start, 0);
        } else {
            range.setStartBefore(start);
        }
    }

    // Move the end container until it is included or collapses to the start.
    while (end && !isLeafNodeInRange(end) && end !== start) {
        end = documentReverse(end);
    }

    if (end === ec) {
        range.setEnd(ec, eo);
    } else if (end !== null) {
        if (end.nodeType === 3) {
            range.setEnd(end, (end as CharacterData).length);
        } else {
            range.setEndAfter(end);
        }
    }

    return range;
}

// Return the next Node in a document order traversal.
// This order is equivalent to a classic pre-order.
function documentForward(node: Node): Node | null {
    if (node.firstChild) {
        return node.firstChild;
    }

    let n: Node | null = node;
    while (!n.nextSibling) {
        n = n.parentNode;
        if (!n) {
            return null;
        }
    }

    return n.nextSibling;
}

// Return the next Node in a reverse document order traversal.
// This order is equivalent to pre-order with the child order reversed.
function documentReverse(node: Node): Node | null {
    if (node.lastChild) {
        return node.lastChild;
    }

    let n: Node | null = node;
    while (!n.previousSibling) {
        n = n.parentNode;
        if (!n) {
            return null;
        }
    }

    return n.previousSibling;
}

function firstLeaf(node: Node): Node {
    while (node.firstChild) {
        node = node.firstChild;
    }
    return node;
}

function lastLeaf(node: Node): Node {
    while (node.lastChild) {
        node = node.lastChild;
    }
    return node;
}
