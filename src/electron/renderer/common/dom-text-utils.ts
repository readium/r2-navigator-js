// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { split } from "sentence-splitter";

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

function normalizeText(str: string): string {
    // tslint:disable-next-line:max-line-length
    return str.replace(/&/g, "&amp;").replace(/\n/g, " ").replace(/\s\s+/g, " ").replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
}

export interface ITextLangDir {
    dir: string | undefined;
    lang: string | undefined;
    parentElement: Element;
    textNodes: Node[];
    combinedText: string; // combineText(this.textNodes)
    combinedTextSentences: string[] | undefined;
}

export interface ITextLangDirReference {
    item: ITextLangDir;
    iArray: number; // ITextLangDir[]
    iSentence: number; // ITextLangDir.combinedTextSentences
    iGlobal: number; // ITextLangDir[] and ITextLangDir.combinedTextSentences
}

// import { uniqueCssSelector } from "../common/cssselector2";
// function dump(i: ITextLangDir) {
//     console.log("<<----");
//     console.log(i.dir);
//     console.log(i.lang);
//     const cssSelector = uniqueCssSelector(i.parentElement, i.parentElement.ownerDocument);
//     console.log(cssSelector);
//     console.log(i.parentElement.tagName);
//     console.log(i.combinedText);
//     if (i.combinedTextSentences) {
//         console.log(".......");
//         for (const j of i.combinedTextSentences) {
//             console.log(j);
//         }
//         console.log(".......");
//     }
//     console.log("---->>");
// }
// function dumps(f: ITextLangDir[]) {
//     for (const i of f) {
//         dump(i);
//     }
// }

export function getLength(items: ITextLangDir[]) {
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

export function getText(obj: ITextLangDirReference): string {
    if (obj.iSentence === -1) {
        return obj.item.combinedText;
    }
    if (obj.item.combinedTextSentences) {
        return obj.item.combinedTextSentences[obj.iSentence];
    }
    return "";
}

export function getItem(items: ITextLangDir[], index: number): ITextLangDirReference | undefined {
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

export function findItem(ttsQueue: ITextLangDir[], element: Element, rootElem: Element): number {
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

export function generateTtsQueue(rootElement: Element): ITextLangDir[] {

    const ttsQueue: ITextLangDir[] = [];
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

                    // tslint:disable-next-line:max-line-length
                    const isExcluded = (childNode as Element).matches("img, sup, sub, audio, video, source, button, canvas, del, dialog, embed, form, head, iframe, meter, noscript, object, s, script, select, style, textarea");
                    // code, nav, dl, figure, table, ul, ol
                    if (!isExcluded) {
                        processElement(childNode as Element);
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
                str = str + (str.length ? " " : "") +
                    (textNode.nodeValue !== null ?
                    normalizeText(textNode.nodeValue) : "");
            }
            return str;
        }
        return "";
    }

    function finalizeTextNodes(ttsQueueItem: ITextLangDir) {
        ttsQueueItem.combinedText = combineTextNodes(ttsQueueItem.textNodes);
        try {
            const sentences = split(ttsQueueItem.combinedText);
            // console.log(JSON.stringify(sentences, null, 4));
            ttsQueueItem.combinedTextSentences = [];
            for (const sentence of sentences) {
                if (sentence.type === "Sentence") {
                    ttsQueueItem.combinedTextSentences.push(sentence.raw);
                }
            }
            if (ttsQueueItem.combinedTextSentences.length === 0 || ttsQueueItem.combinedTextSentences.length === 1) {
                ttsQueueItem.combinedTextSentences = undefined;
            } else {
                // let total = item.combinedTextSentences.length - 1;
                // item.combinedTextSentences.forEach((sent) => {
                //     total += sent.length;
                // });
                // if (total !== item.combinedText.length) {
                //     console.log("total !== item.combinedText.length");
                //     console.log(total);
                //     console.log(item.combinedText.length);
                //     dumps([item]);
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
export function wrapHighlight(doHighlight: boolean, ttsQueueItem: ITextLangDir, cssClassParent: string, cssClassSpan: string) {
    if (ttsQueueItem.parentElement) {
        if (doHighlight) {
            if (ttsQueueItem.parentElement.classList.contains(cssClassParent)) {
                return;
            }
            ttsQueueItem.parentElement.classList.add(cssClassParent);
        } else {
            if (!ttsQueueItem.parentElement.classList.contains(cssClassParent)) {
                return;
            }
            ttsQueueItem.parentElement.classList.remove(cssClassParent);
        }
    }

    ttsQueueItem.textNodes.forEach((txtNode) => {
        if (txtNode.parentElement) {
            if (doHighlight) {
                if (txtNode.parentElement.tagName.toLowerCase() === "span" &&
                    txtNode.parentElement.classList.contains(cssClassSpan)) {
                    return;
                }
                const span = (txtNode.ownerDocument as Document).createElement("span");
                span.setAttribute("class", cssClassSpan);
                txtNode.parentElement.replaceChild(span, txtNode);
                span.appendChild(txtNode);
            } else {
                if (txtNode.parentElement.tagName.toLowerCase() !== "span" ||
                    !txtNode.parentElement.classList.contains(cssClassSpan)) {
                    return;
                }
                const span = txtNode.parentElement;
                span.removeChild(txtNode);
                if (span.parentElement) {
                    span.parentElement.replaceChild(txtNode, span);
                }
            }
        }
    });
}
