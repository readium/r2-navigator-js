// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { split } from "sentence-splitter";

import { SKIP_LINK_ID } from "../../common/styles";
import { uniqueCssSelector } from "../common/cssselector2-3";
import { ReadiumElectronWebviewWindow } from "../webview/state";

// const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

const win = global.window as ReadiumElectronWebviewWindow;

export function combineTextNodes(textNodes: Node[], skipNormalize?: boolean): string {
    if (textNodes && textNodes.length) {
        let str = "";
        for (const textNode of textNodes) {
            if (textNode.nodeValue) { // excludes purely-whitespace text nodes
                // normalizeText() preserves prefix/suffix whitespace (collapsed to single)
                // if (str.length) {
                //     str += " ";
                // }
                str += (skipNormalize ? textNode.nodeValue : normalizeText(textNode.nodeValue));
            }
        }
        return str;
    }
    return "";
}

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

export function normalizeHtmlText(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function normalizeText(str: string): string {
    // tslint:disable-next-line:max-line-length
    return normalizeHtmlText(str).replace(/\n/g, " ").replace(/\s\s+/g, " "); // no trim(), we collapse multiple whitespaces into single, preserving prefix and suffix (if any)
}

export interface ITtsQueueItem {
    dir: string | undefined;
    lang: string | undefined;
    parentElement: Element;
    textNodes: Node[];
    combinedText: string; // combineText(this.textNodes)
    combinedTextSentences: string[] | undefined;
    combinedTextSentencesRangeBegin: number[] | undefined;
    combinedTextSentencesRangeEnd: number[] | undefined;
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

export function findTtsQueueItemIndex(
    ttsQueue: ITtsQueueItem[],
    element: Element,
    startTextNode: Node | undefined,
    startTextNodeOffset: number,
    rootElem: Element): number {

    let i = 0;
    for (const ttsQueueItem of ttsQueue) {
        if (startTextNode) {
            if (ttsQueueItem.textNodes?.includes(startTextNode)) { // NOTE SECOND PASS!
                if (ttsQueueItem.combinedTextSentences &&
                    ttsQueueItem.combinedTextSentencesRangeBegin &&
                    ttsQueueItem.combinedTextSentencesRangeEnd) {
                    let offset = 0;
                    for (const txtNode of ttsQueueItem.textNodes) {
                        if (!txtNode.nodeValue && txtNode.nodeValue !== "") {
                            continue;
                        }
                        if (txtNode === startTextNode) {
                            offset += startTextNodeOffset;
                            break;
                        }
                        offset += txtNode.nodeValue.length;
                    }
                    let j = i - 1;
                    // let iSent = -1;
                    for (const end of ttsQueueItem.combinedTextSentencesRangeEnd) {
                        // iSent++;
                        j++;
                        if (end < offset) {
                            continue;
                        }
                        return j;
                    }
                    return i;
                } else { // ttsQueueItem.combinedText
                    return i;
                }
            }
        } else if ( // (!startTextNode || !ttsQueueItem.textNodes?.length) && // NOTE SECOND PASS!
            (
            element === ttsQueueItem.parentElement
            ||
            (ttsQueueItem.parentElement !== (element.ownerDocument as Document).body &&
                ttsQueueItem.parentElement !== rootElem &&
                ttsQueueItem.parentElement.contains(element))
            ||
            element.contains(ttsQueueItem.parentElement))
            ) {

            return i;
        }
        if (ttsQueueItem.combinedTextSentences) {
            i += ttsQueueItem.combinedTextSentences.length;
        } else { // ttsQueueItem.combinedText
            i++;
        }
    }

    // SECOND PASS, e.g. text nodes descendants of MathML
    i = 0;
    for (const ttsQueueItem of ttsQueue) {
        if (startTextNode && ttsQueueItem.textNodes?.includes(startTextNode)) { // DIFF SECOND PASS!
            if (ttsQueueItem.combinedTextSentences &&
                ttsQueueItem.combinedTextSentencesRangeBegin &&
                ttsQueueItem.combinedTextSentencesRangeEnd) {
                let offset = 0;
                for (const txtNode of ttsQueueItem.textNodes) {
                    if (!txtNode.nodeValue && txtNode.nodeValue !== "") {
                        continue;
                    }
                    if (txtNode === startTextNode) {
                        offset += startTextNodeOffset;
                        break;
                    }
                    offset += txtNode.nodeValue.length;
                }
                let j = i - 1;
                // let iSent = -1;
                for (const end of ttsQueueItem.combinedTextSentencesRangeEnd) {
                    // iSent++;
                    j++;
                    if (end < offset) {
                        continue;
                    }
                    return j;
                }
                return i;
            } else { // ttsQueueItem.combinedText
                return i;
            }
        } else if ((!startTextNode || !ttsQueueItem.textNodes?.length) && // DIFF SECOND PASS!
            (
            element === ttsQueueItem.parentElement
            ||
            (ttsQueueItem.parentElement !== (element.ownerDocument as Document).body &&
                ttsQueueItem.parentElement !== rootElem &&
                ttsQueueItem.parentElement.contains(element))
            ||
            element.contains(ttsQueueItem.parentElement))
            ) {

            return i;
        }
        if (ttsQueueItem.combinedTextSentences) {
            i += ttsQueueItem.combinedTextSentences.length;
        } else { // ttsQueueItem.combinedText
            i++;
        }
    }

    return -1;
}

export function generateTtsQueue(rootElement: Element, splitSentences: boolean): ITtsQueueItem[] {

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
                combinedTextSentencesRangeBegin: undefined,
                combinedTextSentencesRangeEnd: undefined,
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
            first = false;
            return;
        }

        // const documant = element.ownerDocument as Document;

        function isHidden(el: Element): boolean {

            if (el.getAttribute("id") === SKIP_LINK_ID) {
                return true;
            }
            if (el.tagName?.toLowerCase() === "rt") { // ruby child
                return true;
            }

            let curEl = el;
            do {
                if (curEl.nodeType === Node.ELEMENT_NODE &&
                    curEl.tagName?.toLowerCase() === "details" &&

                    // curEl.getAttribute("open")
                    //  === "open" or  === "true" ... it's in fact a "boolean attr"
                    // (much like 'hidden' below),
                    // so only its non-existence means "not open"
                    !(curEl as HTMLDetailsElement).open) {
                    return true;
                }
            } while (curEl.parentNode && curEl.parentNode.nodeType === Node.ELEMENT_NODE &&
                (curEl = curEl.parentNode as Element));

            const elStyle = win.getComputedStyle(el);
            if (elStyle) {
                const display = elStyle.getPropertyValue("display");
                if (display === "none") {
                    return true;
                } else {
                    const opacity = elStyle.getPropertyValue("opacity");
                    if (opacity === "0") {
                        return true;
                    }
                }

                // Cannot be relied upon, because web browser engine reports
                // invisible when out of view in scrolled columns!!
                // const visibility = elStyle.getPropertyValue("visibility");
                // if (visibility === "hidden") {
                //     return true;
                // }
            }

            //  === "hidden" or  === "true" ... it's a "boolean attr"
            // (much like details.open above),
            // so only its non-existence means "not hidden"
            if (el.getAttribute("hidden") ||
                el.getAttribute("aria-hidden") === "true") {
                return true;
            }

            return false;
        }

        const hidden = isHidden(element);
        if (hidden) {
            first = false;
            return;
        }

        const tagNameLow = element.tagName ? element.tagName.toLowerCase() : undefined;
        const putInElementStackTagNames = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "th", "td", "caption", "li", "blockquote", "q", "dt", "dd", "figcaption", "div", "pre"];

        const putInElementStack = first ||
            tagNameLow && putInElementStackTagNames.includes(tagNameLow)
            // tslint:disable-next-line:max-line-length
            // element.matches("h1, h2, h3, h4, h5, h6, p, th, td, caption, li, blockquote, q, dt, dd, figcaption, div, pre")
            ;
        

        first = false;

        if (putInElementStack) {
            elementStack.push(element);
        }

        for (const childNode of element.childNodes) {
            switch (childNode.nodeType) {
                case Node.ELEMENT_NODE:
                    const childElement = childNode as Element;
                    const childTagNameLow = childElement.tagName ? childElement.tagName.toLowerCase() : undefined;

                    const hidden = isHidden(childElement);

                    let epubType = childElement.getAttribute("epub:type");
                    if (!epubType) {
                        epubType = childElement.getAttributeNS("http://www.idpf.org/2007/ops", "type");
                        if (!epubType) {
                            epubType = childElement.getAttribute("role");
                        }
                    }
                    const isPageBreak = epubType ? epubType.indexOf("pagebreak") >= 0 : false; // this includes doc-*
                    let pageBreakNeedsDeepDive = isPageBreak && !hidden;
                    if (pageBreakNeedsDeepDive) {
                        let altAttr = childElement.getAttribute("title");
                        if (altAttr) {
                            const txt = altAttr.trim();
                            if (txt) {
                                pageBreakNeedsDeepDive = false;
                                const lang = getLanguage(childElement);
                                const dir = undefined;
                                ttsQueue.push({
                                    combinedText: txt,
                                    combinedTextSentences: undefined,
                                    combinedTextSentencesRangeBegin: undefined,
                                    combinedTextSentencesRangeEnd: undefined,
                                    dir,
                                    lang,
                                    parentElement: childElement,
                                    textNodes: [],
                                });
                            }
                        } else {
                            altAttr = childElement.getAttribute("aria-label");
                            if (altAttr) {
                                const txt = altAttr.trim();
                                if (txt) {
                                    pageBreakNeedsDeepDive = false;
                                    const lang = getLanguage(childElement);
                                    const dir = undefined;
                                    ttsQueue.push({
                                        combinedText: txt,
                                        combinedTextSentences: undefined,
                                        combinedTextSentencesRangeBegin: undefined,
                                        combinedTextSentencesRangeEnd: undefined,
                                        dir,
                                        lang,
                                        parentElement: childElement,
                                        textNodes: [],
                                    });
                                }
                            }
                        }
                    }

                    const isLink = childTagNameLow === "a" && (childElement as HTMLLinkElement).href; // excludes anchors
                    let linkNeedsDeepDive = isLink && !hidden;
                    if (linkNeedsDeepDive) {
                        let altAttr = childElement.getAttribute("title");
                        if (altAttr) {
                            const txt = altAttr.trim();
                            if (txt) {
                                linkNeedsDeepDive = false;
                                const lang = getLanguage(childElement);
                                const dir = undefined;
                                ttsQueue.push({
                                    combinedText: txt,
                                    combinedTextSentences: undefined,
                                    combinedTextSentencesRangeBegin: undefined,
                                    combinedTextSentencesRangeEnd: undefined,
                                    dir,
                                    lang,
                                    parentElement: childElement,
                                    textNodes: [],
                                });
                            }
                        } else {
                            altAttr = childElement.getAttribute("aria-label");
                            if (altAttr) {
                                const txt = altAttr.trim();
                                if (txt) {
                                    linkNeedsDeepDive = false;
                                    const lang = getLanguage(childElement);
                                    const dir = undefined;
                                    ttsQueue.push({
                                        combinedText: txt,
                                        combinedTextSentences: undefined,
                                        combinedTextSentencesRangeBegin: undefined,
                                        combinedTextSentencesRangeEnd: undefined,
                                        dir,
                                        lang,
                                        parentElement: childElement,
                                        textNodes: [],
                                    });
                                }
                            }
                        }
                    }

                    const isMathJax = childTagNameLow && childTagNameLow.startsWith("mjx-");
                    const isMathML = childTagNameLow === "math";

                    const dataSSMLAttr = childElement.getAttribute("data-ssml");
                    let dataSSMLJSON;
                    try {
                        dataSSMLJSON = dataSSMLAttr ? JSON.parse(dataSSMLAttr) : undefined;
                    } catch (e) {
                        console.log(dataSSMLAttr, e);
                    }
                    const dataSSMLSubAliasAttr = childElement.getAttribute("data-ssml-sub-alias");
                    let ssmlSubstitution = typeof dataSSMLJSON?.sub?.alias === "string" ? (dataSSMLJSON.sub.alias as string) :
                        (dataSSMLSubAliasAttr ? dataSSMLSubAliasAttr : undefined);
                    if (ssmlSubstitution) {
                        ssmlSubstitution = ssmlSubstitution.trim();
                    }

                    // tslint:disable-next-line:max-line-length
                    const doNotProcessDeepChildTagNames = ["svg", "img", "sup", "sub", "audio", "video", "source", "button", "canvas", "del", "dialog", "embed", "form", "head", "iframe", "meter", "noscript", "object", "s", "script", "select", "style", "textarea"]; // "code", "nav", "dl", "figure", "table", "ul", "ol"

                    const processDeepChild =
                        pageBreakNeedsDeepDive ||
                        linkNeedsDeepDive ||
                        (
                        !ssmlSubstitution &&
                        !isPageBreak &&
                        !isLink &&
                        !isMathJax &&
                        !isMathML &&
                        childTagNameLow && !doNotProcessDeepChildTagNames.includes(childTagNameLow)
                        // tslint:disable-next-line:max-line-length
                        // !childElement.matches("svg, img, sup, sub, audio, video, source, button, canvas, del, dialog, embed, form, head, iframe, meter, noscript, object, s, script, select, style, textarea")
                        // code, nav, dl, figure, table, ul, ol
                        )
                    ;

                    if (processDeepChild) {
                        processElement(childElement);
                    } else if (!hidden) {
                        if (isPageBreak || isLink) {
                            // do nothing, already dealt with above (either shallow or deep)
                        } else if (isMathML) {
                            const altAttr = childElement.getAttribute("alttext");
                            if (altAttr) {
                                const txt = altAttr.trim();
                                if (txt) {
                                    const lang = getLanguage(childElement);
                                    const dir = undefined;
                                    ttsQueue.push({
                                        combinedText: txt,
                                        combinedTextSentences: undefined,
                                        combinedTextSentencesRangeBegin: undefined,
                                        combinedTextSentencesRangeEnd: undefined,
                                        dir,
                                        lang,
                                        parentElement: childElement,
                                        textNodes: [],
                                    });
                                }
                            } else {
                                const txt = childElement.textContent?.trim();
                                if (txt) {
                                    const lang = getLanguage(childElement);
                                    const dir = getDirection(childElement);
                                    ttsQueue.push({
                                        combinedText: txt,
                                        combinedTextSentences: undefined,
                                        combinedTextSentencesRangeBegin: undefined,
                                        combinedTextSentencesRangeEnd: undefined,
                                        dir,
                                        lang,
                                        parentElement: childElement,
                                        textNodes: [],
                                    });
                                }
                            }
                        } else if (isMathJax) {
                            if (childTagNameLow === "mjx-container") {

                                let mathJaxEl: Element | undefined;
                                let mathJaxElMathML: Element | undefined;
                                const mathJaxContainerChildren = Array.from(childElement.children);
                                for (const mathJaxContainerChild of mathJaxContainerChildren) {
                                    if (mathJaxContainerChild.tagName?.toLowerCase() === "mjx-math") {
                                        mathJaxEl = mathJaxContainerChild;
                                    } else if (mathJaxContainerChild.tagName?.toLowerCase() === "mjx-assistive-mml") {
                                        const mathJaxAMMLChildren = Array.from(mathJaxContainerChild.children);
                                        for (const mathJaxAMMLChild of mathJaxAMMLChildren) {
                                            if (mathJaxAMMLChild.tagName?.toLowerCase() === "math") {
                                                mathJaxElMathML = mathJaxAMMLChild;
                                                break;
                                            }
                                        }
                                    }
                                }

                                const altAttr = childElement.getAttribute("aria-label");
                                if (altAttr) {
                                    const txt = altAttr.trim();
                                    if (txt) {
                                        const lang = getLanguage(childElement);
                                        const dir = undefined;
                                        ttsQueue.push({
                                            combinedText: txt,
                                            combinedTextSentences: undefined,
                                            combinedTextSentencesRangeBegin: undefined,
                                            combinedTextSentencesRangeEnd: undefined,
                                            dir,
                                            lang,
                                            parentElement: mathJaxEl ?? childElement,
                                            textNodes: [],
                                        });
                                    }
                                } else if (mathJaxElMathML) {
                                    const altAttr = mathJaxElMathML.getAttribute("alttext");
                                    if (altAttr) {
                                        const txt = altAttr.trim();
                                        if (txt) {
                                            const lang = getLanguage(mathJaxElMathML);
                                            const dir = undefined;
                                            ttsQueue.push({
                                                combinedText: txt,
                                                combinedTextSentences: undefined,
                                                combinedTextSentencesRangeBegin: undefined,
                                                combinedTextSentencesRangeEnd: undefined,
                                                dir,
                                                lang,
                                                parentElement: mathJaxEl ?? childElement,
                                                textNodes: [],
                                            });
                                        }
                                    } else {
                                        const txt = mathJaxElMathML.textContent?.trim();
                                        if (txt) {
                                            const lang = getLanguage(mathJaxElMathML);
                                            const dir = getDirection(mathJaxElMathML);
                                            ttsQueue.push({
                                                combinedText: txt,
                                                combinedTextSentences: undefined,
                                                combinedTextSentencesRangeBegin: undefined,
                                                combinedTextSentencesRangeEnd: undefined,
                                                dir,
                                                lang,
                                                parentElement: mathJaxEl ?? childElement,
                                                textNodes: [],
                                            });
                                        }
                                    }
                                    break;
                                }
                            }
                        } else if (ssmlSubstitution) {
                            const lang = getLanguage(childElement);
                            const dir = undefined;
                            ttsQueue.push({
                                combinedText: ssmlSubstitution,
                                combinedTextSentences: undefined,
                                combinedTextSentencesRangeBegin: undefined,
                                combinedTextSentencesRangeEnd: undefined,
                                dir,
                                lang,
                                parentElement: childElement,
                                textNodes: [],
                            });
                        } else if (childTagNameLow === "img" &&
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
                                        combinedTextSentencesRangeBegin: undefined,
                                        combinedTextSentencesRangeEnd: undefined,
                                        dir,
                                        lang,
                                        parentElement: childElement,
                                        textNodes: [],
                                    });
                                }
                            }
                        } else if (childTagNameLow === "img" &&
                            (childElement as HTMLImageElement).src) {
                            let altAttr = childElement.getAttribute("alt");
                            if (altAttr) {
                                const txt = altAttr.trim();
                                if (txt) {
                                    const lang = getLanguage(childElement);
                                    const dir = undefined;
                                    ttsQueue.push({
                                        combinedText: txt,
                                        combinedTextSentences: undefined,
                                        combinedTextSentencesRangeBegin: undefined,
                                        combinedTextSentencesRangeEnd: undefined,
                                        dir,
                                        lang,
                                        parentElement: childElement,
                                        textNodes: [],
                                    });
                                }
                            } else {
                                altAttr = childElement.getAttribute("aria-label");
                                if (altAttr) {
                                    const txt = altAttr.trim();
                                    if (txt) {
                                        const lang = getLanguage(childElement);
                                        const dir = undefined;
                                        ttsQueue.push({
                                            combinedText: txt,
                                            combinedTextSentences: undefined,
                                            combinedTextSentencesRangeBegin: undefined,
                                            combinedTextSentencesRangeEnd: undefined,
                                            dir,
                                            lang,
                                            parentElement: childElement,
                                            textNodes: [],
                                        });
                                    }
                                }
                            }
                        } else if (childTagNameLow === "svg") {
                            const altAttr = childElement.getAttribute("aria-label");
                            if (altAttr) {
                                const txt = altAttr.trim();
                                if (txt) {
                                    const lang = getLanguage(childElement);
                                    const dir = undefined;
                                    ttsQueue.push({
                                        combinedText: txt,
                                        combinedTextSentences: undefined,
                                        combinedTextSentencesRangeBegin: undefined,
                                        combinedTextSentencesRangeEnd: undefined,
                                        dir,
                                        lang,
                                        parentElement: childElement,
                                        textNodes: [],
                                    });
                                }
                            } else {
                                const svgChildren = Array.from(childElement.children);
                                for (const svgChild of svgChildren) {
                                    if (svgChild.tagName?.toLowerCase() === "title") {
                                        const txt = svgChild.textContent?.trim();
                                        if (txt) {
                                            const lang = getLanguage(svgChild);
                                            const dir = getDirection(svgChild);
                                            ttsQueue.push({
                                                combinedText: txt,
                                                combinedTextSentences: undefined,
                                                combinedTextSentencesRangeBegin: undefined,
                                                combinedTextSentencesRangeEnd: undefined,
                                                dir,
                                                lang,
                                                parentElement: childElement,
                                                textNodes: [],
                                            });
                                        }
                                        break;
                                    }
                                }
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

        if (putInElementStack) {
            elementStack.pop();
        }
    }

    processElement(rootElement);

    function finalizeTextNodes(ttsQueueItem: ITtsQueueItem) {
        if (!ttsQueueItem.textNodes || !ttsQueueItem.textNodes.length) {
            // img@alt can set combinedText (no text nodes)
            if (!ttsQueueItem.combinedText || !ttsQueueItem.combinedText.length) {
                ttsQueueItem.combinedText = "";
            }
            ttsQueueItem.combinedTextSentences = undefined;
            return;
        }

        ttsQueueItem.combinedText = combineTextNodes(ttsQueueItem.textNodes, true).replace(/[\r\n]/g, " ");
        // ttsQueueItem.combinedText = ttsQueueItem.combinedTextSentences ?
        //     combineTextNodes(ttsQueueItem.textNodes, false).trim() :
        //     combineTextNodes(ttsQueueItem.textNodes, true);
        let skipSplitSentences = false;
        let parent: Element | null = ttsQueueItem.parentElement;
        while (parent) {
            if (parent.tagName) {
                const tag = parent.tagName.toLowerCase();

                if (tag === "pre" || tag === "code" ||
                    tag === "video" || tag === "audio" ||
                    tag === "img" || tag === "svg" ||
                    tag === "math" || tag.startsWith("mjx-")) {
                    skipSplitSentences = true;
                    break;
                }
            }
            parent = parent.parentElement;
        }
        if (splitSentences && !skipSplitSentences) {
            try {
                const txt = ttsQueueItem.combinedText; // no further transforms?
                ttsQueueItem.combinedTextSentences = undefined;
                const sentences = split(txt);
                ttsQueueItem.combinedTextSentences = [];
                ttsQueueItem.combinedTextSentencesRangeBegin = [];
                ttsQueueItem.combinedTextSentencesRangeEnd = [];
                for (const sentence of sentences) {
                    if (sentence.type === "Sentence") {
                        // console.log(sentence.raw, JSON.stringify(sentence.range, null, 2));

                        ttsQueueItem.combinedTextSentences.push(sentence.raw);
                        ttsQueueItem.combinedTextSentencesRangeBegin.push(sentence.range[0]);
                        ttsQueueItem.combinedTextSentencesRangeEnd.push(sentence.range[1]);
                    }
                    // else {
                    //     console.log(sentence.type);
                    // }
                }
                if (ttsQueueItem.combinedTextSentences.length === 0 ||
                    ttsQueueItem.combinedTextSentences.length === 1) {
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
        } else {
            ttsQueueItem.combinedTextSentences = undefined;
        }
    }

    for (const ttsQueueItem of ttsQueue) {
        finalizeTextNodes(ttsQueueItem);
    }

    return ttsQueue;
}
