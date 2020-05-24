// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { split } from "sentence-splitter";

import { uniqueCssSelector } from "../common/cssselector2";

export function getLanguage(el: Element): string | undefined {

    let currentElement = el;

    while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {

        let lang = currentElement.getAttribute("xml:lang");
        if (!lang) {
            lang = currentElement.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang");
        }
        if (!lang) {
            lang = currentElement.getAttribute("lang");
        }
        if (lang) {
            return lang;
        }

        currentElement = currentElement.parentNode as Element;
    }

    return undefined;
}

export function getDirection(el: Element): string | undefined {

    let currentElement = el;

    while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {

        const dir = currentElement.getAttribute("dir");
        if (dir) {
            return dir;
        }

        currentElement = currentElement.parentNode as Element;
    }

    return undefined;
}

export function normalizeText(str: string): string {
    // tslint:disable-next-line:max-line-length
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, " ").replace(/\s\s+/g, " "); // no trim(), we collapse multiple whitespaces into single, preserving prefix and suffix (if any)
}

export interface ITtsQueueItem {
    dir: string | undefined;
    lang: string | undefined;
    parentElement: Element;
    textNodes: Node[];
    combinedText: string; // combineText(this.textNodes)
    combinedTextSentences: string[] | undefined;
}

export interface ITtsQueueItemReference {
    item: ITtsQueueItem;
    iArray: number; // ITtsQueueItem[]
    iSentence: number; // ITtsQueueItem.combinedTextSentences
    iGlobal: number; // ITtsQueueItem[] and ITtsQueueItem.combinedTextSentences
}

export function consoleLogTtsQueueItem(i: ITtsQueueItem) {
    console.log("<<----");
    console.log(i.dir);
    console.log(i.lang);
    const cssSelector = uniqueCssSelector(i.parentElement, i.parentElement.ownerDocument as Document);
    console.log(cssSelector);
    console.log(i.parentElement.tagName);
    console.log(i.combinedText);
    if (i.combinedTextSentences) {
        console.log(".......");
        for (const j of i.combinedTextSentences) {
            console.log(j);
        }
        console.log(".......");
    }
    console.log("---->>");
}
export function consoleLogTtsQueue(f: ITtsQueueItem[]) {
    for (const i of f) {
        consoleLogTtsQueueItem(i);
    }
}

export function getTtsQueueLength(items: ITtsQueueItem[]) {
    let l = 0;
    for (const it of items) {
        if (it.combinedTextSentences) {
            l += it.combinedTextSentences.length;
        } else {
            l++;
        }
    }
    return l;
}

export function getTtsQueueItemRefText(obj: ITtsQueueItemReference): string {
    if (obj.iSentence === -1) {
        return obj.item.combinedText;
    }
    if (obj.item.combinedTextSentences) {
        return obj.item.combinedTextSentences[obj.iSentence];
    }
    return "";
}

export function getTtsQueueItemRef(items: ITtsQueueItem[], index: number): ITtsQueueItemReference | undefined {
    let i = -1;
    let k = -1;
    for (const it of items) {
        k++;
        if (it.combinedTextSentences) {
            let j = -1;
            for (const _sent of it.combinedTextSentences) {
                j++;
                i++;
                if (index === i) {
                    return { item: it, iArray: k, iGlobal: i, iSentence: j };
                }
            }
        } else {
            i++;
            if (index === i) {
                return { item: it, iArray: k, iGlobal: i, iSentence: -1 };
            }
        }
    }
    return undefined;
}

export function findTtsQueueItemIndex(ttsQueue: ITtsQueueItem[], element: Element, rootElem: Element): number {
    let i = 0;
    for (const ttsQueueItem of ttsQueue) {
        if (element === ttsQueueItem.parentElement ||
            (ttsQueueItem.parentElement !== (element.ownerDocument as Document).body &&
                ttsQueueItem.parentElement !== rootElem &&
                ttsQueueItem.parentElement.contains(element)) ||
            element.contains(ttsQueueItem.parentElement)) {
            return i;
        }
        if (ttsQueueItem.combinedTextSentences) {
            i += ttsQueueItem.combinedTextSentences.length;
        } else {
            i++;
        }
    }
    return -1;
}

export function generateTtsQueue(rootElement: Element): ITtsQueueItem[] {

    const ttsQueue: ITtsQueueItem[] = [];
    const elementStack: Element[] = [];

    function processTextNode(textNode: Node) {

        if (textNode.nodeType !== Node.TEXT_NODE) {
            return;
        }
        // test for word regexp?  || !/\w/.test(textNode.nodeValue)
        if (!textNode.nodeValue || !textNode.nodeValue.trim().length) {
            return;
        }
        const parentElement = elementStack[elementStack.length - 1];
        if (!parentElement) {
            return;
        }

        const lang = textNode.parentElement ? getLanguage(textNode.parentElement) : undefined;
        const dir = textNode.parentElement ? getDirection(textNode.parentElement) : undefined;

        let current = ttsQueue[ttsQueue.length - 1];
        if (!current || current.parentElement !== parentElement || current.lang !== lang || current.dir !== dir) {
            current = {
                combinedText: "", // filled in later (see trySplitTexts())
                combinedTextSentences: undefined, // filled in later, if text is further chunkable
                dir,
                lang,
                parentElement,
                textNodes: [],
            };
            ttsQueue.push(current);
        }
        current.textNodes.push(textNode);
    }

    let first = true;
    function processElement(element: Element) {
        if (element.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        // tslint:disable-next-line:max-line-length
        const isIncluded = first || element.matches("h1, h2, h3, h4, h5, h6, p, th, td, caption, li, blockquote, q, dt, dd, figcaption, div, pre");
        first = false;
        if (isIncluded) {
            elementStack.push(element);
        }

        for (const childNode of element.childNodes) {
            switch (childNode.nodeType) {
                case Node.ELEMENT_NODE:
                    const childElement = childNode as Element;
                    // tslint:disable-next-line:max-line-length
                    const isExcluded = childElement.matches("img, sup, sub, audio, video, source, button, canvas, del, dialog, embed, form, head, iframe, meter, noscript, object, s, script, select, style, textarea");
                    // code, nav, dl, figure, table, ul, ol
                    if (!isExcluded) {
                        processElement(childElement);
                    } else if (childElement.tagName
                        && childElement.tagName.toLowerCase() === "img" &&
                        (childElement as HTMLImageElement).src) {
                        const altAttr = childElement.getAttribute("alt");
                        if (altAttr) {
                            const txt = altAttr.trim();
                            if (txt) {
                                const lang = getLanguage(childElement);
                                const dir = undefined;
                                ttsQueue.push({
                                    combinedText: txt,
                                    combinedTextSentences: undefined,
                                    dir,
                                    lang,
                                    parentElement: childElement,
                                    textNodes: [],
                                });
                            }
                        }
                    }
                    break;
                case Node.TEXT_NODE:
                    if (elementStack.length !== 0) {
                        processTextNode(childNode);
                    }
                    break;
                default:
                    break;
            }
        }

        if (isIncluded) {
            elementStack.pop();
        }
    }

    processElement(rootElement);

    function combineTextNodes(textNodes: Node[]): string {
        if (textNodes && textNodes.length) {
            let str = "";
            for (const textNode of textNodes) {
                if (textNode.nodeValue) { // excludes purely-whitespace text nodes
                    // normalizeText() preserves prefix/suffix whitespace (collapsed to single)
                    // if (str.length) {
                    //     str += " ";
                    // }
                    str += normalizeText(textNode.nodeValue);
                }
            }
            return str;
        }
        return "";
    }

    function finalizeTextNodes(ttsQueueItem: ITtsQueueItem) {
        if (!ttsQueueItem.textNodes || !ttsQueueItem.textNodes.length) {
            // img@alt can set combinedText (no text nodes)
            if (!ttsQueueItem.combinedText || !ttsQueueItem.combinedText.length) {
                ttsQueueItem.combinedText = "";
            }
            ttsQueueItem.combinedTextSentences = undefined;
            return;
        }
        ttsQueueItem.combinedText = combineTextNodes(ttsQueueItem.textNodes).trim();
        try {
            ttsQueueItem.combinedTextSentences = undefined;
            const sentences = split(ttsQueueItem.combinedText);
            ttsQueueItem.combinedTextSentences = [];
            for (const sentence of sentences) {
                if (sentence.type === "Sentence") {
                    ttsQueueItem.combinedTextSentences.push(sentence.raw);
                }
            }
            if (ttsQueueItem.combinedTextSentences.length === 0 || ttsQueueItem.combinedTextSentences.length === 1) {
                ttsQueueItem.combinedTextSentences = undefined;
            } else {
                // let total = 0;
                // ttsQueueItem.combinedTextSentences.forEach((sent) => {
                //     total += sent.length;
                // });
                // const expectedWhiteSpacesSeparators = ttsQueueItem.combinedTextSentences.length - 1;
                // if (total !== ttsQueueItem.combinedText.length &&
                //     ((ttsQueueItem.combinedText.length - total) !== expectedWhiteSpacesSeparators)) {
                //     console.log("sentences total !== item.combinedText.length");
                //     console.log(total + " !== " + ttsQueueItem.combinedText.length);
                //     consoleLogTtsQueueItem(ttsQueueItem);
                //     console.log(JSON.stringify(sentences, null, 4));
                // }
            }
        } catch (err) {
            console.log(err);
            ttsQueueItem.combinedTextSentences = undefined;
        }
    }

    for (const ttsQueueItem of ttsQueue) {
        finalizeTextNodes(ttsQueueItem);
    }

    return ttsQueue;
}

// tslint:disable-next-line:max-line-length
export function wrapHighlight(doHighlight: boolean, ttsQueueItemRef: ITtsQueueItemReference, cssClassParent: string, cssClassSpan: string, _cssClassSubSpan: string, word: string | undefined, _start: number, _end: number) {

    // TODO
    if (typeof word !== "undefined") {
        // console.log(word);
        // console.log(start);
        // console.log(end);
        // console.log(cssClassSubSpan);

        // ttsQueueItem.textNodes.forEach((txtNode) ...
        // check that txtNode already has cssClassSpan parent (otherwise, abort)
        // txt = normalizeText(txtNode.nodeValue)
        // (remember: combineText() inserted " " space between each txtNode)
        // match txt inside ttsQueueItemRef.item.combinedTextSentences (if ttsQueueItemRef.iSentence)
        // or inside ttsQueueItemRef.item.combinedText
        // if match then locate word/start/end
        // if located then split txtNode (if needed) in order to insert span for word (cssClassSubSpan)
        // attach new nodes to txtNode, so they can be restored (un-highlight)
        // TXT_SPAN_TXT or TXT_SPAN or SPAN_TXT or SPAN (no split, whole word)
        return;
    }

    const ttsQueueItem = ttsQueueItemRef.item;

    if (ttsQueueItem.parentElement) {
        if (doHighlight) {
            if (!ttsQueueItem.parentElement.classList.contains(cssClassParent)) {
                ttsQueueItem.parentElement.classList.add(cssClassParent);
            }
        } else {
            if (ttsQueueItem.parentElement.classList.contains(cssClassParent)) {
                ttsQueueItem.parentElement.classList.remove(cssClassParent);
            }
        }
    }

    ttsQueueItem.textNodes.forEach((txtNode) => {
        if (!txtNode.parentElement) {
            return; // continue
        }
        if (doHighlight) {
            if (txtNode.parentElement.tagName.toLowerCase() !== "span" ||
                !txtNode.parentElement.classList.contains(cssClassSpan)) {

                const span = (txtNode.ownerDocument as Document).createElement("span");
                span.setAttribute("class", cssClassSpan);
                txtNode.parentElement.replaceChild(span, txtNode);
                span.appendChild(txtNode);
            }
        } else {
            if (txtNode.parentElement.tagName.toLowerCase() === "span" &&
                txtNode.parentElement.classList.contains(cssClassSpan)) {

                const span = txtNode.parentElement;
                span.removeChild(txtNode);
                if (span.parentElement) {
                    span.parentElement.replaceChild(txtNode, span);
                }
            }
        }
    });
}
