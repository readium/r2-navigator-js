// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { debounce } from "debounce";
import { split } from "sentence-splitter";

import {
    TTS_ID_ACTIVE_WORD,
    TTS_ID_CONTAINER,
    TTS_ID_INFO,
    TTS_ID_SPEAKING_DOC_ELEMENT,
    TTS_NAV_BUTTON_CLASS,
} from "../../common/styles";
import { PopupDialog } from "../common/popup-dialog";
import { IElectronWebviewTagWindow } from "./state";

const win = (global as any).window as IElectronWebviewTagWindow;

const TTS_ID_DIALOG = "r2-tts-dialog";

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

function dump(i: ITextLangDir) {
    console.log("<<----");
    console.log(i.dir);
    console.log(i.lang);
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
function dumps(f: ITextLangDir[]) {
    for (const i of f) {
        dump(i);
    }
}

function normalizeText(str: string): string {
    // tslint:disable-next-line:max-line-length
    return str.replace(/\n/g, " ").replace(/\s\s+/g, " ").replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
}

function getLength(items: ITextLangDir[]) {
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

interface ITextLangDirItem {
    item: ITextLangDir;
    str: string;
    index: number;
    subindex: number;
}
function getItem(items: ITextLangDir[], index: number): ITextLangDirItem | undefined {
    let i = -1;
    for (const it of items) {
        if (it.combinedTextSentences) {
            let j = -1;
            for (const sent of it.combinedTextSentences) {
                j++;
                i++;
                if (index === i) {
                    return { str: sent, item: it, index: i, subindex: j };
                }
            }
        } else {
            i++;
            if (index === i) {
                return { str: it.combinedText, item: it, index: i, subindex: -1 };
            }
        }
    }
    return undefined;
}

export interface ITextLangDir {
    dir: string | undefined;
    lang: string | undefined;
    parentElement: Element;
    textNodes: Node[];
    combinedText: string;
    combinedTextSentences: string[] | undefined;
}
export function flattenDomText(rootElement: Element): ITextLangDir[] {

    const flattenedText: ITextLangDir[] = [];
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

        let current = flattenedText[flattenedText.length - 1];
        if (!current || current.parentElement !== parentElement || current.lang !== lang || current.dir !== dir) {
            current = {
                combinedText: "", // filled in later (see trySplitTexts())
                combinedTextSentences: undefined, // filled in later, if text is further chunkable
                dir,
                lang,
                parentElement,
                textNodes: [],
            };
            flattenedText.push(current);
        }
        current.textNodes.push(textNode);
    }

    let first = true;
    function processElement(element: Element) {
        if (element.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        // tslint:disable-next-line:max-line-length
        const isIncluded = first || element.matches("h1, h2, h3, h4, h5, h6, p, th, td, caption, li, blockquote, q, dt, dd, figcaption, div");
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

    function combineText(item: ITextLangDir): string {
        if (item.textNodes && item.textNodes.length) {
            let str = "";
            for (const textNode of item.textNodes) {
                str = str + (str.length ? " " : "") +
                    (textNode.nodeValue !== null ?
                    normalizeText(textNode.nodeValue) : "");
            }
            return str;
        }
        return "";
    }

    function trySplitText(item: ITextLangDir) {
        item.combinedText = combineText(item);
        try {
            const sentences = split(item.combinedText);
            // console.log(JSON.stringify(sentences, null, 4));
            item.combinedTextSentences = [];
            for (const sentence of sentences) {
                if (sentence.type === "Sentence") {
                    item.combinedTextSentences.push(sentence.raw);
                }
            }
            if (item.combinedTextSentences.length === 0 || item.combinedTextSentences.length === 1) {
                item.combinedTextSentences = undefined;
            } else {
                let total = item.combinedTextSentences.length - 1;
                item.combinedTextSentences.forEach((sent) => {
                    total += sent.length;
                });
                if (total !== item.combinedText.length) {
                    console.log("total !== item.combinedText.length");
                    console.log(total);
                    console.log(item.combinedText.length);
                    dumps([item]);
                }
            }
        } catch (err) {
            console.log(err);
        }
    }

    function trySplitTexts(items: ITextLangDir[]) {
        for (const it of items) {
            trySplitText(it);
        }
    }

    trySplitTexts(flattenedText);

    return flattenedText;
}

export function ttsPlayback(elem: Element, focusScrollRaw: (el: HTMLOrSVGElement, doFocus: boolean) => void) {

    // TODO: SSML?
    // https://github.com/guest271314/SpeechSynthesisSSMLParser
    // speechApiTxt = `<?xml version="1.0" encoding="utf-8"?>
    //     <speak version="1.1" xmlns="http://www.w3.org/2001/10/synthesis"
    //     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    //     xsi:schemaLocation="http://www.w3.org/2001/10/synthesis
    //                         http://www.w3.org/TR/speech-synthesis/synthesis.xsd"
    //     xml:lang="${language}">${txt}</speak>`;

    win.speechSynthesis.cancel();

    let existingDialog = win.document.getElementById(TTS_ID_DIALOG) as HTMLDialogElement;
    if (existingDialog) {
        if ((existingDialog as any).popDialog) {
            // ((dialog as any).popDialog as PopupDialog).hide();
            ((existingDialog as any).popDialog as PopupDialog).cancelRefocus();
            if (existingDialog.hasAttribute("open")) {
                (existingDialog as HTMLDialogElement).close();
            }
        }
        (existingDialog as any).ttsUtterance = undefined;
        (existingDialog as any).popDialog = undefined;
        existingDialog.remove();
    }

    // const innerText = (elem as HTMLElement).innerText; // triggers reflow

    // console.log("elem.textContent");
    // console.log(elem.textContent);
    // console.log("innerText");
    // console.log(innerText);

    // console.log("elem.innerHTML");
    // console.log(elem.innerHTML);
    // console.log("elem.outerHTML");
    // console.log(elem.outerHTML);

    const flattenedDomText = flattenDomText(elem);
    if (!flattenedDomText.length) {
        return;
    }
    // dumps(flattenedDomText);

    const TTS_ID_PREVIOUS = "r2-tts-previous";
    const TTS_ID_NEXT = "r2-tts-next";

    // tslint:disable-next-line:max-line-length
    // const outerHTML = `<textarea id="${idTtsTxt}" style="font-family: inherit; font-size: inherit; height: 400px; width: 600px; overflow: auto;">${txt}</textarea>`;
    // tslint:disable-next-line:max-line-length
    const outerHTML = `<div id="${TTS_ID_CONTAINER}" dir="${flattenedDomText[0].dir ? flattenedDomText[0].dir : "ltr"}" lang="${flattenedDomText[0].lang ? flattenedDomText[0].lang : ""}" xml:lang="${flattenedDomText[0].lang ? flattenedDomText[0].lang : ""}">${flattenedDomText[0].combinedText}</div>
    <div id="${TTS_ID_INFO}"> </div>
    <button id="${TTS_ID_PREVIOUS}" class="${TTS_NAV_BUTTON_CLASS}"
        style="position: absolute; left: 4px; bottom: 4px;">&#x21E0;</button>
    <button id="${TTS_ID_NEXT}" class="${TTS_NAV_BUTTON_CLASS}"
        style="position: absolute; right: 4px; bottom: 4px;">&#x21E2;</button>`;
    // console.log("outerHTML");
    // console.log(outerHTML);

    function endToScrollAndFocus(el: HTMLOrSVGElement | null, doFocus: boolean) {
        elem.classList.remove(TTS_ID_SPEAKING_DOC_ELEMENT);

        if (el) {
            focusScrollRaw(el, doFocus);
        }

        setTimeout(() => {
            // if (win.speechSynthesis.speaking) {
            //     win.speechSynthesis.pause();
            // }
            _ignoreEndEvent = true;
            win.speechSynthesis.cancel();
        }, 0);

        setTimeout(() => {
            const dialogEl_ = win.document.getElementById(TTS_ID_DIALOG) as HTMLDialogElement;
            if (dialogEl_) {
                (dialogEl_ as any).ttsUtterance = undefined;
                (dialogEl_ as any).popDialog = undefined;
                dialogEl_.remove();
            }
        }, 100);
    }
    const pop = new PopupDialog(win.document, outerHTML, TTS_ID_DIALOG, endToScrollAndFocus);
    pop.show(elem);

    let _ignoreEndEvent = false;

    const ttsPrevious = win.document.getElementById(TTS_ID_PREVIOUS) as HTMLElement;
    if (ttsPrevious) {
        ttsPrevious.addEventListener("click", (_ev: MouseEvent) => {

            const diag = win.document.getElementById(TTS_ID_DIALOG) as HTMLDialogElement;
            if (typeof ((diag as any).ttsQueueIndex) !== "undefined") {
                const j = (diag as any).ttsQueueIndex - 1;
                if (j >= getLength(flattenedDomText) || j < 0) {
                    return;
                }
                if (win.speechSynthesis.speaking) {
                    _ignoreEndEvent = true;
                    win.speechSynthesis.cancel();
                }
                (diag as any).ttsQueueIndex = j;
                processQueueDebounced(j);
            }
        });
    }
    const ttsNext = win.document.getElementById(TTS_ID_NEXT) as HTMLElement;
    if (ttsNext) {
        ttsNext.addEventListener("click", (_ev: MouseEvent) => {

            const diag = win.document.getElementById(TTS_ID_DIALOG) as HTMLDialogElement;
            if (typeof ((diag as any).ttsQueueIndex) !== "undefined") {
                const j = (diag as any).ttsQueueIndex + 1;
                if (j >= getLength(flattenedDomText) || j < 0) {
                    return;
                }
                if (win.speechSynthesis.speaking) {
                    _ignoreEndEvent = true;
                    win.speechSynthesis.cancel();
                }
                (diag as any).ttsQueueIndex = j;
                processQueueDebounced(j);
            }
        });
    }

    const textZone = win.document.getElementById(TTS_ID_CONTAINER) as HTMLElement;
    if (textZone) {
        textZone.addEventListener("click", (_ev: MouseEvent) => {

            if (win.speechSynthesis.speaking) {
                // if (win.speechSynthesis.paused) {
                //     console.log("resume");
                //     win.speechSynthesis.resume();
                // } else {
                //     console.log("pause");
                //     win.speechSynthesis.pause();
                // }
                _ignoreEndEvent = true; // add/removeEventListener("end") does not work
                win.speechSynthesis.cancel();
            } else {
                setTimeout(() => {
                    const dialogEl = win.document.getElementById(TTS_ID_DIALOG) as HTMLDialogElement;
                    if (dialogEl &&
                        (dialogEl as any).ttsUtterance) {
                        win.speechSynthesis.speak((dialogEl as any).ttsUtterance);
                    }
                }, 0);
            }
        });
    }

    const processQueueDebounced = debounce((i: number) => {
        processQueueRaw(i);
    }, 150);
    function processQueueRaw(i: number) {

        const dialogEl = win.document.getElementById(TTS_ID_DIALOG) as HTMLDialogElement;
        if (dialogEl && !dialogEl.hasAttribute("open")) {
            return;
        }
        if (i >= getLength(flattenedDomText) || i < 0) {
            if (dialogEl && dialogEl.hasAttribute("open")) {
                // if ((dialogEl as any).popDialog) {
                //     ((dialogEl as any).popDialog as PopupDialog).cancelRefocus();
                // }
                dialogEl.close();
            }
            return;
        }
        const textChunk = getItem(flattenedDomText, i);
        if (!textChunk) {
            if (dialogEl && dialogEl.hasAttribute("open")) {
                // if ((dialogEl as any).popDialog) {
                //     ((dialogEl as any).popDialog as PopupDialog).cancelRefocus();
                // }
                dialogEl.close();
            }
            return;
        }

        const textContainer = win.document.getElementById(TTS_ID_CONTAINER) as HTMLElement;
        if (textContainer) {
            textContainer.innerHTML = textChunk.str;
            if (textChunk.item.dir) {
                textContainer.setAttribute("dir", textChunk.item.dir as string);
            } else {
                textContainer.removeAttribute("dir");
            }
            if (textChunk.item.lang) {
                const str = textChunk.item.lang as string;
                textContainer.setAttribute("lang", str);
                textContainer.setAttribute("xml:lang", str);
                // textContainer.setAttributeNS("http://www.w3.org/XML/1998/", "lang", str);
            } else {
                textContainer.removeAttribute("lang");
            }
        }
        const info = win.document.getElementById(TTS_ID_INFO) as HTMLElement;
        if (info) {
            info.innerText = (i + 1) + "/" + getLength(flattenedDomText);
        }

        const utterance = new SpeechSynthesisUtterance(textChunk.str);
        // utterance.voice
        // utterance.rate
        // utterance.pitch
        // utterance.volume
        if (textChunk.item.lang) {
            utterance.lang = textChunk.item.lang as string;
        }

        existingDialog = win.document.getElementById(TTS_ID_DIALOG) as HTMLDialogElement;
        (existingDialog as any).ttsUtterance = utterance; // previous one gets garbage-collected
        (existingDialog as any).ttsQueueIndex = i;
        utterance.onboundary = (ev: SpeechSynthesisEvent) => {
            if (ev.name !== "word") {
                return;
            }
            const ttsDialog = win.document.getElementById(TTS_ID_DIALOG) as HTMLDialogElement;
            if (!ttsDialog.open) {
                return;
            }
            // const textarea = win.document.getElementById(idTtsTxt) as HTMLTextAreaElement;
            // if (!textarea || !textarea.value) {
            //     return;
            // }
            const textP = win.document.getElementById(TTS_ID_CONTAINER) as HTMLElement;
            if (!textP) {
                return;
            }

            const text = utterance.text;
            const start = text.slice(0, ev.charIndex + 1).search(/\S+$/);
            const right = text.slice(ev.charIndex).search(/\s/);
            const word = right < 0 ? text.slice(start) : text.slice(start, right + ev.charIndex);
            const end = start + word.length;
            // debug(word);

            const prefix = `<span id="${TTS_ID_ACTIVE_WORD}">`;
            const suffix = "</span>";

            const before = text.substr(0, start);
            const after = text.substr(end);
            const l = before.length + word.length + after.length;
            const fullTxt = (l === text.length) ? `${before}${prefix}${word}${suffix}${after}` : text;

            textP.innerHTML = fullTxt;

            setTimeout(() => {
                const span = win.document.getElementById(TTS_ID_ACTIVE_WORD) as HTMLElement;
                const textCont = win.document.getElementById(TTS_ID_CONTAINER) as HTMLElement;
                if (span && textCont) {
                    const rect = span.getBoundingClientRect();
                    const rect2 = textCont.getBoundingClientRect();
                    const scrollTopMax = textCont.scrollHeight - textCont.clientHeight;
                    let offset = textCont.scrollTop + (rect.top - rect2.top - (textCont.clientHeight / 2));
                    if (offset > scrollTopMax) {
                        offset = scrollTopMax;
                    } else if (offset < 0) {
                        offset = 0;
                    }
                    textCont.scrollTop = offset;

                    // span.focus();
                    // span.scrollIntoView({
                    //     // TypeScript lib.dom.d.ts difference in 3.2.1
                    //     // ScrollBehavior = "auto" | "instant" | "smooth" VS ScrollBehavior = "auto" | "smooth"
                    //     behavior: "auto",
                    //     // ScrollLogicalPosition = "start" | "center" | "end" | "nearest"
                    //     block: "center",
                    //     // ScrollLogicalPosition = "start" | "center" | "end" | "nearest"
                    //     inline: "nearest",
                    // } as ScrollIntoViewOptions);
                }
            }, 80);
        };
        utterance.onend = (_ev: SpeechSynthesisEvent) => {
            if (_ignoreEndEvent) {
                _ignoreEndEvent = false;
                return;
            }

            setTimeout(() => {
                processQueueRaw(++i);
            }, 100);
        };

        setTimeout(() => {
            win.speechSynthesis.speak(utterance);
        }, 0);
    }

    processQueueRaw(0);
    elem.classList.add(TTS_ID_SPEAKING_DOC_ELEMENT);
}
