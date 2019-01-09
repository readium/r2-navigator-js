// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import {
    TTS_ID_ACTIVE_WORD,
    TTS_ID_CONTAINER,
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

    const innerText = (elem as HTMLElement).innerText; // triggers reflow

    console.log("elem.textContent");
    console.log(elem.textContent);
    console.log("innerText");
    console.log(innerText);

    console.log("elem.innerHTML");
    console.log(elem.innerHTML);
    console.log("elem.outerHTML");
    console.log(elem.outerHTML);

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
    txt = txt.replace(/\n/g, " "); // TTS without line breaks
    txt = txt.replace(/&/g, "&amp;"); // edge-case with some badly-formatted HTML

    // textContent can return markup! (e.g. video fallback / noscript)
    // innerText takes into account CSS
    // https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent
    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/innerText
    txt = txt.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    win.speechSynthesis.cancel();

    const dir = getDirection(elem);
    const language = getLanguage(elem);

    // tslint:disable-next-line:max-line-length
    // const outerHTML = `<textarea id="${idTtsTxt}" style="font-family: inherit; font-size: inherit; height: 400px; width: 600px; overflow: auto;">${txt}</textarea>`;
    // tslint:disable-next-line:max-line-length
    const outerHTML = `<div id="${TTS_ID_CONTAINER}" dir="${dir ? dir : "ltr"}" lang="${language ? language : ""}" xml:lang="${language ? language : ""}">${txt}</div>`;
    console.log("outerHTML");
    console.log(outerHTML);

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

    function endToScrollAndFocus(el: HTMLOrSVGElement | null, doFocus: boolean) {
        if (el) {
            focusScrollRaw(el, doFocus);
        }

        setTimeout(() => {
            // if (win.speechSynthesis.speaking) {
            //     win.speechSynthesis.pause();
            // }
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

    // const txtarea = win.document.getElementById(idTtsTxt) as HTMLTextAreaElement;
    // txtarea.readOnly = true;
    // // txtarea.disabled = true;

    const speechApiTxt = txt;
    if (language) {
        // console.log("TTS LANG SSML: " + language);

        // TODO: break markup down into queued sequence of utterances, each with their own language
        // https://github.com/guest271314/SpeechSynthesisSSMLParser
        // speechApiTxt = `<?xml version="1.0" encoding="utf-8"?>
        //     <speak version="1.1" xmlns="http://www.w3.org/2001/10/synthesis"
        //     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        //     xsi:schemaLocation="http://www.w3.org/2001/10/synthesis
        //                         http://www.w3.org/TR/speech-synthesis/synthesis.xsd"
        //     xml:lang="${language}">${txt}</speak>`;
    }
    const utterance = new SpeechSynthesisUtterance(speechApiTxt);
    // utterance.voice
    // utterance.rate
    // utterance.pitch
    // utterance.volume
    if (language) {
        utterance.lang = language;
    }

    existingDialog = win.document.getElementById(TTS_ID_DIALOG) as HTMLDialogElement;
    (existingDialog as any).ttsUtterance = utterance;
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
        // textarea.value = fullTxt.substring(0, end);
        // textarea.scrollTop = textarea.scrollHeight;
        // textarea.value = fullTxt;
        // textarea.focus();
        // const offset = prefix.length;
        // textarea.setSelectionRange(start + offset, end + offset);
        textP.innerHTML = fullTxt;
        setTimeout(() => {
            const span = win.document.getElementById(TTS_ID_ACTIVE_WORD) as HTMLElement;
            if (span) {
                const rect = span.getBoundingClientRect();
                const rect2 = textP.getBoundingClientRect();
                const scrollTopMax = textP.scrollHeight - textP.clientHeight;
                let offset = textP.scrollTop + (rect.top - rect2.top - (textP.clientHeight / 2));
                if (offset > scrollTopMax) {
                    offset = scrollTopMax;
                } else if (offset < 0) {
                    offset = 0;
                }
                textP.scrollTop = offset;

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
        }, 100);
    };
    let _ignoreEndEvent = false;
    utterance.onend = (ev: SpeechSynthesisEvent) => {
        if (_ignoreEndEvent) {
            _ignoreEndEvent = false;
            return;
        }
        const dialogEl = win.document.getElementById(TTS_ID_DIALOG) as HTMLDialogElement;
        if (dialogEl &&
            dialogEl.hasAttribute("open") &&
            (dialogEl as any).ttsUtterance === ev.utterance) {
            // if ((dialogEl as any).popDialog) {
            //     ((dialogEl as any).popDialog as PopupDialog).cancelRefocus();
            // }
            dialogEl.close();
        }
    };

    const textZone = win.document.getElementById(TTS_ID_CONTAINER) as HTMLElement;
    if (textZone) {
        textZone.addEventListener("mouseup", (_ev: MouseEvent) => {
            console.log("mouseup");
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

    setTimeout(() => {
        win.speechSynthesis.speak(utterance);
    }, 0);
}
