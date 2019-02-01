// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { debounce } from "debounce";
import { ipcRenderer } from "electron";

import {
    R2_EVENT_TTS_IS_PAUSED,
    R2_EVENT_TTS_IS_PLAYING,
    R2_EVENT_TTS_IS_STOPPED,
} from "../../common/events";
import {
    CSS_CLASS_NO_FOCUS_OUTLINE,
    TTS_CLASS_INJECTED_SPAN,
    TTS_CLASS_INJECTED_SUBSPAN,
    TTS_ID_ACTIVE_WORD,
    TTS_ID_CONTAINER,
    TTS_ID_INFO,
    TTS_ID_INJECTED_PARENT,
    TTS_ID_NEXT,
    TTS_ID_PREVIOUS,
    TTS_ID_SLIDER,
    TTS_ID_SPEAKING_DOC_ELEMENT,
    TTS_NAV_BUTTON_CLASS,
} from "../../common/styles";
import {
    ITtsQueueItem,
    ITtsQueueItemReference,
    findTtsQueueItemIndex,
    generateTtsQueue,
    getTtsQueueItemRef,
    getTtsQueueItemRefText,
    getTtsQueueLength,
    wrapHighlight,
} from "../common/dom-text-utils";
import { IHTMLDialogElementWithPopup, PopupDialog } from "../common/popup-dialog";
import { IElectronWebviewTagWindow } from "./state";

const win = (global as any).window as IElectronWebviewTagWindow;

interface IHTMLDialogElementWithTTSState extends IHTMLDialogElementWithPopup {

    domSlider: HTMLInputElement | undefined;
    domNext: HTMLButtonElement | undefined;
    domPrevious: HTMLButtonElement | undefined;
    domText: HTMLDivElement | undefined;
    domInfo: HTMLDivElement | undefined;

    ttsUtterance: SpeechSynthesisUtterance | undefined;
    ttsQueue: ITtsQueueItem[] | undefined;
    ttsQueueLength: number; // index by ITtsQueueItemReference.iGlobal
    ttsQueueItem: ITtsQueueItemReference | undefined;

    ttsRootElement: Element | undefined;

    focusScrollRaw: ((el: HTMLOrSVGElement, doFocus: boolean) => void )| undefined;
}

let _dialogState: IHTMLDialogElementWithTTSState | undefined;

function resetState() {
    _resumableState = undefined;

    if (_dialogState) {
        _dialogState.popDialog = undefined;
        _dialogState.focusScrollRaw = undefined;

        _dialogState.ttsRootElement = undefined;
        _dialogState.ttsQueue = undefined;
        _dialogState.ttsQueueLength = -1;
        _dialogState.ttsUtterance = undefined;
        _dialogState.ttsQueueItem = undefined;

        _dialogState.domSlider = undefined;
        _dialogState.domNext = undefined;
        _dialogState.domPrevious = undefined;
        _dialogState.domText = undefined;
        _dialogState.domInfo = undefined;

        _dialogState.remove();
    }
    _dialogState = undefined;

    ipcRenderer.sendToHost(R2_EVENT_TTS_IS_STOPPED);
}

export function ttsPlay(
    focusScrollRaw: (el: HTMLOrSVGElement, doFocus: boolean) => void,
    rootElem: Element | undefined,
    startElem: Element | undefined) {

    ttsStop();

    let rootEl = rootElem;

    if (!rootEl) {
        rootEl = win.document.body;
    }

    const ttsQueue = generateTtsQueue(rootEl);
    if (!ttsQueue.length) {
        return;
    }

    let ttsQueueIndex = -1;
    if (startElem) {
        const idx = findTtsQueueItemIndex(ttsQueue, startElem, rootEl);
        if (idx >= 0) {
            ttsQueueIndex = idx;
        }
    }
    if (ttsQueueIndex < 0) {
        ttsQueueIndex = 0;
    }
    setTimeout(() => {
        startTTSSession(rootEl as Element, ttsQueue, ttsQueueIndex, focusScrollRaw);
    }, 100);
}

export function ttsStop() {
    if (_dialogState) {
        if (_dialogState.hasAttribute("open")) {
            _dialogState.close(); // => onDialogClosed()
            return;
        }
    }
    ttsPause();
    resetState();
}

let _doNotProcessNextQueueItemOnUtteranceEnd = false;

export function ttsPause() {

    highlights(false);

    // can actually be in paused state!
    if (win.speechSynthesis.speaking) {
        // if (win.speechSynthesis.paused) {
        //     console.log("resume");
        //     win.speechSynthesis.resume();
        // } else {
        //     console.log("pause");
        //     win.speechSynthesis.pause(); // doesn't seem to work!
        // }

        // make sure the playback state machine doesn't move to the next utterance.
        _doNotProcessNextQueueItemOnUtteranceEnd = true; // add/removeEventListener("end") does not work.

        setTimeout(() => {
            win.speechSynthesis.cancel();
        }, 0);
    } else if (win.speechSynthesis.pending) {
        // we only queue a single utterance, so this isn't really needed.
        setTimeout(() => {
            win.speechSynthesis.cancel();
        }, 0);
    }

    ipcRenderer.sendToHost(R2_EVENT_TTS_IS_PAUSED);
}

interface IResumableState {
    ttsRootElement: Element;
    ttsQueue: ITtsQueueItem[];
    ttsQueueIndex: number;
    focusScrollRaw: (el: HTMLOrSVGElement, doFocus: boolean) => void;
}
let _resumableState: IResumableState | undefined;

export function ttsResume() {

    if (_dialogState &&
        _dialogState.ttsUtterance) {
        highlights(true);

        setTimeout(() => {
            if (_dialogState &&
                _dialogState.ttsUtterance) {
                win.speechSynthesis.speak(_dialogState.ttsUtterance);
            }
        }, 0);

        ipcRenderer.sendToHost(R2_EVENT_TTS_IS_PLAYING);
    } else if (_resumableState) {
        setTimeout(() => {
            if (_resumableState) {
                startTTSSession(
                    _resumableState.ttsRootElement,
                    _resumableState.ttsQueue,
                    _resumableState.ttsQueueIndex,
                    _resumableState.focusScrollRaw);
            }
        }, 100);
    }
}

export function isTtsPlaying() {
    return isTtsActive() && !win.speechSynthesis.paused;
}

export function isTtsActive() {
    if (_dialogState && _dialogState.hasAttribute("open") &&
        (win.speechSynthesis.speaking || win.speechSynthesis.pending)) {
        return true;
    }
    return false;
}

export function ttsPauseOrResume() {
    if (isTtsPlaying()) {
        ttsPause();
    } else {
        ttsResume();
    }
}

export function ttsQueueSize(): number {
    if (_dialogState && _dialogState.ttsQueue) {
        getTtsQueueLength(_dialogState.ttsQueue);
    }
    return -1;
}
export function ttsQueueCurrentIndex(): number {
    if (_dialogState && _dialogState.ttsQueueItem) {
        return _dialogState.ttsQueueItem.iGlobal;
    }
    return -1;
}
export function ttsQueueCurrentText(): string | undefined {
    if (_dialogState && _dialogState.ttsQueueItem) {
        return getTtsQueueItemRefText(_dialogState.ttsQueueItem);
    }
    return undefined;
}

export function ttsNext() {
    if (_dialogState && _dialogState.ttsQueueItem) {
        const j = _dialogState.ttsQueueItem.iGlobal + 1;
        if (j >= _dialogState.ttsQueueLength || j < 0) {
            return;
        }
        ttsPause();
        ttsPlayQueueIndexDebounced(j);
    }
}
export function ttsPrevious() {
    if (_dialogState && _dialogState.ttsQueueItem) {
        const j = _dialogState.ttsQueueItem.iGlobal - 1;
        if (j >= _dialogState.ttsQueueLength || j < 0) {
            return;
        }
        ttsPause();
        ttsPlayQueueIndexDebounced(j);
    }
}

export function ttsPreviewAndEventuallyPlayQueueIndex(n: number) {

    ttsPause();

    if (_dialogState && _dialogState.ttsQueue) {

        updateTTSInfo(getTtsQueueItemRef(_dialogState.ttsQueue, n));
    }

    ttsPlayQueueIndexDebouncedMore(n);
}

function highlights(doHighlight: boolean) {

    if (!_dialogState) {
        return;
    }
    if (typeof (_dialogState as any).FALSY_TO_DISABLE_HIGHLIGHTS === "undefined") {
        return;
    }
    if (doHighlight) {
        if (_dialogState.ttsQueueItem) {
            // tslint:disable-next-line:max-line-length
            wrapHighlight(true, _dialogState.ttsQueueItem, TTS_ID_INJECTED_PARENT, TTS_CLASS_INJECTED_SPAN, TTS_CLASS_INJECTED_SUBSPAN, undefined, -1, -1);
        }
        if (_dialogState.ttsRootElement) {
            _dialogState.ttsRootElement.classList.add(TTS_ID_SPEAKING_DOC_ELEMENT);
        }
    } else {
        if (_dialogState.ttsQueueItem) {
            // tslint:disable-next-line:max-line-length
            wrapHighlight(false, _dialogState.ttsQueueItem, TTS_ID_INJECTED_PARENT, TTS_CLASS_INJECTED_SPAN, TTS_CLASS_INJECTED_SUBSPAN, undefined, -1, -1);
        }
        if (_dialogState.ttsRootElement) {
            _dialogState.ttsRootElement.classList.remove(TTS_ID_SPEAKING_DOC_ELEMENT);
        }
    }
}

function handleWordBoundary(utteranceText: string, charIndex: number) {

    if (!_dialogState || !_dialogState.hasAttribute("open") || !_dialogState.domText || !_dialogState.ttsQueueItem) {
        return;
    }

    const text = utteranceText;
    const start = text.slice(0, charIndex + 1).search(/\S+$/);
    const right = text.slice(charIndex).search(/\s/);
    const word = right < 0 ? text.slice(start) : text.slice(start, right + charIndex);
    const end = start + word.length;
    // debug(word);

    const prefix = `<span id="${TTS_ID_ACTIVE_WORD}">`;
    const suffix = "</span>";

    const before = text.substr(0, start);
    const after = text.substr(end);
    const l = before.length + word.length + after.length;
    const innerHTML = (l === text.length) ? `${before}${prefix}${word}${suffix}${after}` : text;

    try {
        _dialogState.domText.innerHTML = innerHTML;
    } catch (err) {
        console.log(err);
        console.log(innerHTML);
        _dialogState.domText.innerHTML = "...";
    }

    // tslint:disable-next-line:max-line-length
    wrapHighlight(true, _dialogState.ttsQueueItem, TTS_ID_INJECTED_PARENT, TTS_CLASS_INJECTED_SPAN, TTS_CLASS_INJECTED_SUBSPAN, word, start, end);

    setTimeout(() => {
        scrollIntoViewSpokenText();
    }, 80);
}

function scrollIntoViewSpokenText() {

    const span = win.document.getElementById(TTS_ID_ACTIVE_WORD) as HTMLElement;
    if (span && _dialogState && _dialogState.domText) {
        const rect = span.getBoundingClientRect();
        const rect2 = _dialogState.domText.getBoundingClientRect();
        const scrollTopMax = _dialogState.domText.scrollHeight - _dialogState.domText.clientHeight;
        let offset = _dialogState.domText.scrollTop + (rect.top - rect2.top - (_dialogState.domText.clientHeight / 2));
        if (offset > scrollTopMax) {
            offset = scrollTopMax;
        } else if (offset < 0) {
            offset = 0;
        }
        _dialogState.domText.scrollTop = offset;

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
}

function updateTTSInfo(ttsQueueItem: ITtsQueueItemReference | undefined): string | undefined {

    if (!_dialogState || !ttsQueueItem) {
        return undefined;
    }

    if (_dialogState.focusScrollRaw && ttsQueueItem.item.parentElement) {
        _dialogState.focusScrollRaw(ttsQueueItem.item.parentElement as HTMLElement, false);
    }

    const ttsQueueItemText = getTtsQueueItemRefText(ttsQueueItem);

    if (_dialogState.domText) {
        try {
            // const prefix = `<span id="${TTS_ID_ACTIVE_WORD}">`;
            // const suffix = "</span>";
            // _dialogState.domText.innerHTML = prefix + ttsQueueItemText + suffix;
            _dialogState.domText.innerHTML = ttsQueueItemText;
        } catch (err) {
            console.log(err);
            console.log(ttsQueueItemText);
            _dialogState.domText.innerHTML = "...";
        }
        if (ttsQueueItem.item.dir) {
            _dialogState.domText.setAttribute("dir", ttsQueueItem.item.dir as string);
        } else {
            _dialogState.domText.removeAttribute("dir");
        }
        if (ttsQueueItem.item.lang) {
            const str = ttsQueueItem.item.lang as string;
            _dialogState.domText.setAttribute("lang", str);
            _dialogState.domText.setAttribute("xml:lang", str);
            // _dialogState.domText.setAttributeNS("http://www.w3.org/XML/1998/", "lang", str);
        } else {
            _dialogState.domText.removeAttribute("lang");
        }
    }
    if (_dialogState.domInfo) {
        _dialogState.domInfo.innerText = (ttsQueueItem.iGlobal + 1) + "/" + _dialogState.ttsQueueLength;
    }

    return ttsQueueItemText;
}

const ttsPlayQueueIndexDebounced = debounce((ttsQueueIndex: number) => {
    ttsPlayQueueIndex(ttsQueueIndex);
}, 150);

const ttsPlayQueueIndexDebouncedMore = debounce((ttsQueueIndex: number) => {
    ttsPlayQueueIndex(ttsQueueIndex);
}, 300);

export function ttsPlayQueueIndex(ttsQueueIndex: number) {

    if (!_dialogState ||
        !_dialogState.ttsRootElement ||
        !_dialogState.focusScrollRaw ||
        !_dialogState.ttsQueue ||
        !_dialogState.hasAttribute("open")) {
        ttsStop();
        return;
    }

    _dialogState.ttsQueueItem = undefined;
    _dialogState.ttsUtterance = undefined;

    if (_dialogState.domSlider) {
        _dialogState.domSlider.value = "" + ttsQueueIndex;
    }

    if (ttsQueueIndex >= _dialogState.ttsQueueLength || ttsQueueIndex < 0) {
        ttsStop();
        return;
    }
    const ttsQueueItem = getTtsQueueItemRef(_dialogState.ttsQueue, ttsQueueIndex);
    if (!ttsQueueItem) {
        ttsStop();
        return;
    }
    _dialogState.ttsQueueItem = ttsQueueItem;

    highlights(true);

    const txtStr = updateTTSInfo(_dialogState.ttsQueueItem);
    if (!txtStr) {
        ttsStop();
        return;
    }

    const utterance = new SpeechSynthesisUtterance(txtStr);
    _dialogState.ttsUtterance = utterance;

    // TODO:
    // utterance.voice
    // utterance.rate
    // utterance.pitch
    // utterance.volume
    if (_dialogState.ttsQueueItem.item.lang) {
        utterance.lang = _dialogState.ttsQueueItem.item.lang;
    }

    utterance.onboundary = (ev: SpeechSynthesisEvent) => {
        if (ev.name !== "word") {
            return;
        }
        handleWordBoundary(utterance.text, ev.charIndex);
    };

    utterance.onend = (_ev: SpeechSynthesisEvent) => {

        highlights(false);

        if (_doNotProcessNextQueueItemOnUtteranceEnd) {
            _doNotProcessNextQueueItemOnUtteranceEnd = false;
            return;
        }

        setTimeout(() => {
            ttsPlayQueueIndex(ttsQueueIndex + 1);
        }, 100);
    };

    _doNotProcessNextQueueItemOnUtteranceEnd = false;

    _resumableState = {
        focusScrollRaw: _dialogState.focusScrollRaw,
        ttsQueue: _dialogState.ttsQueue,
        ttsQueueIndex: _dialogState.ttsQueueItem.iGlobal,
        ttsRootElement: _dialogState.ttsRootElement,
    };

    setTimeout(() => {
        win.speechSynthesis.speak(utterance);
    }, 0);

    ipcRenderer.sendToHost(R2_EVENT_TTS_IS_PLAYING);
}

function startTTSSession(
    ttsRootElement: Element,
    ttsQueue: ITtsQueueItem[],
    ttsQueueIndexStart: number,
    focusScrollRaw: (el: HTMLOrSVGElement, doFocus: boolean) => void) {

    const ttsQueueItemStart = getTtsQueueItemRef(ttsQueue, ttsQueueIndexStart);
    if (!ttsQueueItemStart) {
        ttsStop();
        return;
    }
    const ttsQueueLength = getTtsQueueLength(ttsQueue);

    // TODO: SSML?
    // https://github.com/guest271314/SpeechSynthesisSSMLParser
    // speechApiTxt = `<?xml version="1.0" encoding="utf-8"?>
    //     <speak version="1.1" xmlns="http://www.w3.org/2001/10/synthesis"
    //     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    //     xsi:schemaLocation="http://www.w3.org/2001/10/synthesis
    //                         http://www.w3.org/TR/speech-synthesis/synthesis.xsd"
    //     xml:lang="${language}">${txt}</speak>`;

    function onDialogClosed(el: HTMLOrSVGElement | null) {

        ttsPause();

        if (_dialogState && _dialogState.focusScrollRaw) {
            let toScrollTo = el;
            if (_dialogState.ttsQueueItem && _dialogState.ttsQueueItem.item.parentElement) {
                toScrollTo = _dialogState.ttsQueueItem.item.parentElement as HTMLElement;
            }
            if (toScrollTo) {
                _dialogState.focusScrollRaw(toScrollTo, false);
            }
        }

        setTimeout(() => {
            resetState();
        }, 50);
    }

    // &#x21E0;
    // &#x21E2;
    const outerHTML =
    `<div id="${TTS_ID_CONTAINER}"
        class="${CSS_CLASS_NO_FOCUS_OUTLINE}"
        dir="ltr"
        lang="en"
        xml:lang="en"
        tabindex="0" autofocus="autofocus">...</div>
    <div id="${TTS_ID_INFO}"> </div>
    <button id="${TTS_ID_PREVIOUS}" class="${TTS_NAV_BUTTON_CLASS}"><span>&#9668;</span></button>
    <button id="${TTS_ID_NEXT}" class="${TTS_NAV_BUTTON_CLASS}"><span>&#9658;</span></button>
    <input id="${TTS_ID_SLIDER}" type="range" min="1" max="${ttsQueueLength}" value="1" />`;

    const pop = new PopupDialog(win.document, outerHTML, onDialogClosed);
    pop.show(ttsQueueItemStart.item.parentElement);

    _dialogState = pop.dialog as IHTMLDialogElementWithTTSState;
    if (!_dialogState) {
        return;
    }
    _dialogState.focusScrollRaw = focusScrollRaw;
    _dialogState.ttsRootElement = ttsRootElement;

    _dialogState.domSlider = win.document.getElementById(TTS_ID_SLIDER) as HTMLInputElement;
    _dialogState.domPrevious = win.document.getElementById(TTS_ID_PREVIOUS) as HTMLButtonElement;
    _dialogState.domNext = win.document.getElementById(TTS_ID_NEXT) as HTMLButtonElement;
    _dialogState.domText = win.document.getElementById(TTS_ID_CONTAINER) as HTMLDivElement;
    _dialogState.domInfo = win.document.getElementById(TTS_ID_INFO) as HTMLDivElement;

    _dialogState.ttsQueue = ttsQueue;
    _dialogState.ttsQueueLength = ttsQueueLength;

    if (_dialogState.domSlider) {
        _dialogState.domSlider.addEventListener("input", (_ev: Event) => {
            if (_dialogState && _dialogState.domSlider) {
                const n = parseInt(_dialogState.domSlider.value, 10);

                ttsPreviewAndEventuallyPlayQueueIndex(n);
            }
        });
    }

    if (_dialogState.domPrevious) {
        _dialogState.domPrevious.addEventListener("click", (_ev: MouseEvent) => {

            ttsPrevious();
        });
    }
    if (_dialogState.domNext) {
        _dialogState.domNext.addEventListener("click", (_ev: MouseEvent) => {

            ttsNext();
        });
    }

    if (_dialogState.domText) {
        _dialogState.domText.addEventListener("click", (_ev: MouseEvent) => {
            ttsPauseOrResume();
        });
    }

    ttsPlayQueueIndex(ttsQueueIndexStart);
}
