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

function getLanguage(el: Element): string | undefined {

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

function getDirection(el: Element): string | undefined {

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

// interface ITextLang {
//     lang: string;
//     text: string;
// }

export function ttsPlayback(elem: Element, focusScrollRaw: (el: HTMLOrSVGElement, doFocus: boolean) => void) {

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

    const innerText = (elem as HTMLElement).innerText; // triggers reflow

    // console.log("elem.textContent");
    // console.log(elem.textContent);
    // console.log("innerText");
    // console.log(innerText);

    // console.log("elem.innerHTML");
    // console.log(elem.innerHTML);
    // console.log("elem.outerHTML");
    // console.log(elem.outerHTML);

    if (/(xml:)?lang=["'][^"']+["']/g.test(elem.innerHTML)) {

        // const clone = elem.cloneNode(true).normalize();
    }

    // Paragraphs split:
    // .split(/(?:\s*\r?\n\s*){2,}/)
    const txtSelection = win.getSelection().toString().trim();
    let txt: string | null = txtSelection;
    if (!txt) {
        if (typeof innerText === "undefined" || innerText === null) {
            txt = elem.textContent;
        } else {
            txt = innerText;
        }
        if (!txt) {
            return;
        }
    }

    txt = txt.trim();
    if (txt.length === 0) {
        return;
    }

    txt = txt.replace(/\n/g, " "); // TTS without line breaks
    txt = txt.replace(/&/g, "&amp;"); // edge-case with some badly-formatted HTML

    // textContent can return markup! (e.g. video fallback / noscript)
    // innerText takes into account CSS
    // https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent
    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/innerText
    txt = txt.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // TODO: break markup down into queued sequence of utterances, each with their own language
    // https://github.com/guest271314/SpeechSynthesisSSMLParser
    // speechApiTxt = `<?xml version="1.0" encoding="utf-8"?>
    //     <speak version="1.1" xmlns="http://www.w3.org/2001/10/synthesis"
    //     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    //     xsi:schemaLocation="http://www.w3.org/2001/10/synthesis
    //                         http://www.w3.org/TR/speech-synthesis/synthesis.xsd"
    //     xml:lang="${language}">${txt}</speak>`;

    let queue: string[] = [];

    try {
        const sentences = split(txt);
        // console.log(JSON.stringify(sentences, null, 4));
        for (const sentence of sentences) {
            if (sentence.type === "Sentence") {
                queue.push(sentence.raw);
            }
        }
    } catch (err) {
        console.log(err);
    }

    if (!queue.length) {
        queue = txt.split(/\. /).map((q, i, arr) => {
            const trimmed = q.trim();
            if (trimmed.length === 0) {
                return trimmed;
            }
            if (i < (arr.length - 1) && !trimmed.endsWith(".")) {
                return trimmed + ".";
            }
            return trimmed;
        });
        console.log("############");
        console.log(queue.join(". \n\n"));
        console.log("############ -----");
    }

    let iq = 0;
    while (queue[iq].length === 0) {
        iq++;
    }
    if (iq > queue.length) {
        return;
    }

    const dir = getDirection(elem);
    const language = getLanguage(elem);

    const TTS_ID_PREVIOUS = "r2-tts-previous";
    const TTS_ID_NEXT = "r2-tts-next";

    // tslint:disable-next-line:max-line-length
    // const outerHTML = `<textarea id="${idTtsTxt}" style="font-family: inherit; font-size: inherit; height: 400px; width: 600px; overflow: auto;">${txt}</textarea>`;
    // tslint:disable-next-line:max-line-length
    const outerHTML = `<div id="${TTS_ID_CONTAINER}" dir="${dir ? dir : "ltr"}" lang="${language ? language : ""}" xml:lang="${language ? language : ""}">${queue[iq]}</div>
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
                if (j >= queue.length || j < 0) {
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
                if (j >= queue.length || j < 0) {
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
        if (i >= queue.length || i < 0) {
            if (dialogEl && dialogEl.hasAttribute("open")) {
                // if ((dialogEl as any).popDialog) {
                //     ((dialogEl as any).popDialog as PopupDialog).cancelRefocus();
                // }
                dialogEl.close();
            }
            return;
        }
        const q = queue[i];

        const textContainer = win.document.getElementById(TTS_ID_CONTAINER) as HTMLElement;
        if (textContainer) {
            textContainer.innerHTML = q;
        }
        const info = win.document.getElementById(TTS_ID_INFO) as HTMLElement;
        if (info) {
            info.innerText = (i + 1) + "/" + queue.length;
        }

        const utterance = new SpeechSynthesisUtterance(q);
        // utterance.voice
        // utterance.rate
        // utterance.pitch
        // utterance.volume
        if (language) {
            utterance.lang = language;
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
    processQueueRaw(iq);
    elem.classList.add(TTS_ID_SPEAKING_DOC_ELEMENT);
}
