// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { debounce } from "debounce";
import { ipcRenderer } from "electron";

import {
    R2_EVENT_TTS_DOC_END, R2_EVENT_TTS_IS_PAUSED, R2_EVENT_TTS_IS_PLAYING, R2_EVENT_TTS_IS_STOPPED,
} from "../../common/events";
import {
    HighlightDrawTypeBackground, HighlightDrawTypeUnderline, IHighlight,
} from "../../common/highlight";
import {
    CSS_CLASS_NO_FOCUS_OUTLINE, POPUP_DIALOG_CLASS_COLLAPSE, ROOT_CLASS_REDUCE_MOTION,
    TTS_CLASS_IS_ACTIVE, TTS_CLASS_THEME1, TTS_CLASS_UTTERANCE, TTS_CLASS_UTTERANCE_HEADING1,
    TTS_CLASS_UTTERANCE_HEADING2, TTS_CLASS_UTTERANCE_HEADING3, TTS_CLASS_UTTERANCE_HEADING4,
    TTS_CLASS_UTTERANCE_HEADING5, TTS_ID_ACTIVE_UTTERANCE, TTS_ID_ACTIVE_WORD, TTS_ID_CONTAINER,
    TTS_ID_NEXT, TTS_ID_PREVIOUS, TTS_ID_SLIDER, TTS_ID_SPEAKING_DOC_ELEMENT, TTS_NAV_BUTTON_CLASS,
    TTS_POPUP_DIALOG_CLASS,
} from "../../common/styles";
import { IPropertyAnimationState, animateProperty } from "../common/animateProperty";
import { uniqueCssSelector } from "../common/cssselector2";
import {
    ITtsQueueItem, ITtsQueueItemReference, findTtsQueueItemIndex, generateTtsQueue,
    getTtsQueueItemRef, getTtsQueueItemRefText, getTtsQueueLength,
} from "../common/dom-text-utils";
import { easings } from "../common/easings";
import { IHTMLDialogElementWithPopup, PopupDialog } from "../common/popup-dialog";
import { createHighlights, destroyHighlight } from "./highlight";
import { isRTL } from "./readium-css";
import { convertRange } from "./selection";
import { IReadiumElectronWebviewWindow } from "./state";

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

const ENABLE_TTS_OVERLAY_VIEW = false;

const win = (global as any).window as IReadiumElectronWebviewWindow;

interface IHTMLDialogElementWithTTSState extends IHTMLDialogElementWithPopup {

    domSlider: HTMLInputElement | undefined;
    domNext: HTMLButtonElement | undefined;
    domPrevious: HTMLButtonElement | undefined;
    domText: HTMLDivElement | undefined;

    ttsUtterance: SpeechSynthesisUtterance | undefined;
    ttsQueue: ITtsQueueItem[] | undefined;
    ttsQueueLength: number; // index by ITtsQueueItemReference.iGlobal
    ttsQueueItem: ITtsQueueItemReference | undefined;

    ttsRootElement: Element | undefined;

    focusScrollRaw: ((el: HTMLOrSVGElement, doFocus: boolean, animate: boolean) => void) | undefined;

    ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable: (() => number) | undefined;
    ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable: ((val: number) => void) | undefined;
}

let _dialogState: IHTMLDialogElementWithTTSState | undefined;

function resetState() {
    _resumableState = undefined;

    if (_dialogState) {
        _dialogState.popDialog = undefined;
        _dialogState.focusScrollRaw = undefined;
        _dialogState.ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable = undefined;
        _dialogState.ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable = undefined;

        _dialogState.ttsRootElement = undefined;
        _dialogState.ttsQueue = undefined;
        _dialogState.ttsQueueLength = -1;
        _dialogState.ttsUtterance = undefined;
        _dialogState.ttsQueueItem = undefined;

        _dialogState.domSlider = undefined;
        _dialogState.domNext = undefined;
        _dialogState.domPrevious = undefined;
        _dialogState.domText = undefined;

        _dialogState.remove();
    }
    _dialogState = undefined;

    win.document.documentElement.classList.remove(TTS_CLASS_IS_ACTIVE);
    ipcRenderer.sendToHost(R2_EVENT_TTS_IS_STOPPED);
}

export function ttsPlay(
    speed: number,
    focusScrollRaw: (el: HTMLOrSVGElement, doFocus: boolean, animate: boolean) => void,
    rootElem: Element | undefined,
    startElem: Element | undefined,
    ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable: () => number,
    ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable: (val: number) => void,
    ) {

    ttsStop();

    let rootEl = rootElem;

    if (!rootEl) {
        rootEl = win.document.body;
    }

    const ttsQueue = generateTtsQueue(rootEl, true); // ENABLE_TTS_OVERLAY_VIEW
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
        startTTSSession(
            speed,
            rootEl as Element,
            ttsQueue,
            ttsQueueIndex,
            focusScrollRaw,
            ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable,
            ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable);
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

        if (_dialogState && _dialogState.ttsUtterance) {
            (_dialogState.ttsUtterance as any).r2_cancel = true;
        }
        setTimeout(() => {
            win.speechSynthesis.cancel();
        }, 0);
    } else if (win.speechSynthesis.pending) {
        // we only queue a single utterance, so this isn't really needed.

        if (_dialogState && _dialogState.ttsUtterance) {
            (_dialogState.ttsUtterance as any).r2_cancel = true;
        }
        setTimeout(() => {
            win.speechSynthesis.cancel();
        }, 0);
    }

    win.document.documentElement.classList.add(TTS_CLASS_IS_ACTIVE);
    ipcRenderer.sendToHost(R2_EVENT_TTS_IS_PAUSED);
}

export function ttsPlaybackRate(speed: number) {
    win.READIUM2.ttsPlaybackRate = speed;
    ttsPause();
    if (_dialogState && _dialogState.ttsUtterance) {
        _dialogState.ttsUtterance.rate = speed;
    }
    setTimeout(() => {
        ttsResume();
    }, 60);
}

interface IResumableState {
    ttsRootElement: Element;
    ttsQueue: ITtsQueueItem[];
    ttsQueueIndex: number;
    focusScrollRaw: ((el: HTMLOrSVGElement, doFocus: boolean, animate: boolean) => void);
    ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable: (() => number);
    ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable: ((val: number) => void);
}
let _resumableState: IResumableState | undefined;

export function ttsResume() {

    if (_dialogState &&
        _dialogState.ttsUtterance) {
        highlights(true);

        setTimeout(() => {
            if (_dialogState &&
                _dialogState.ttsUtterance) {

                (_dialogState.ttsUtterance as any).r2_cancel = false;
                win.speechSynthesis.speak(_dialogState.ttsUtterance);
            }
        }, 0);

        win.document.documentElement.classList.add(TTS_CLASS_IS_ACTIVE);
        ipcRenderer.sendToHost(R2_EVENT_TTS_IS_PLAYING);
    } else if (_resumableState) {
        setTimeout(() => {
            if (_resumableState) {
                startTTSSession(
                    win.READIUM2.ttsPlaybackRate,
                    _resumableState.ttsRootElement,
                    _resumableState.ttsQueue,
                    _resumableState.ttsQueueIndex,
                    _resumableState.focusScrollRaw,
                    _resumableState.ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable,
                    _resumableState.ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable);
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

    // if (_dialogState && _dialogState.ttsQueue) {
    //     updateTTSInfo(getTtsQueueItemRef(_dialogState.ttsQueue, n), -1, undefined);
    // }

    ttsPlayQueueIndexDebounced(n);
}

const _getCssSelectorOptions = {
    className: (_str: string) => {
        return true;
    },
    idName: (_str: string) => {
        return true;
    },
    tagName: (_str: string) => {
        return true;
    },
};
function getCssSelector(element: Element): string {
    try {
        return uniqueCssSelector(element, win.document, _getCssSelectorOptions);
    } catch (err) {
        console.log("uniqueCssSelector:");
        console.log(err);
        return "";
    }
}

let _ttsQueueItemHighlightsSentence: Array<IHighlight | null> | undefined;
let _ttsQueueItemHighlightsWord: Array<IHighlight | null> | undefined;

function wrapHighlightWord(
    ttsQueueItemRef: ITtsQueueItemReference,
    utteranceText: string,
    charIndex: number,
    charLength: number,
    word: string,
    start: number,
    end: number) {

    if (ENABLE_TTS_OVERLAY_VIEW) {
        return;
    }

    if (_ttsQueueItemHighlightsWord) {
        _ttsQueueItemHighlightsWord.forEach((highlight) => {
            if (highlight) {
                destroyHighlight(win.document, highlight.id);
            }
        });
        _ttsQueueItemHighlightsWord = undefined;
    }

    const ttsQueueItem = ttsQueueItemRef.item;
    let txtToCheck = ttsQueueItemRef.item.combinedText;
    let charIndexAdjusted = charIndex;
    if (ttsQueueItem.combinedTextSentences &&
        ttsQueueItem.combinedTextSentencesRangeBegin &&
        ttsQueueItem.combinedTextSentencesRangeEnd &&
        ttsQueueItemRef.iSentence >= 0) {
        const sentOffset = ttsQueueItem.combinedTextSentencesRangeBegin[ttsQueueItemRef.iSentence];
        charIndexAdjusted += sentOffset;
        txtToCheck = ttsQueueItem.combinedTextSentences[ttsQueueItemRef.iSentence];
    }

    if (IS_DEV) {
        if (utteranceText !== txtToCheck) {
            console.log("TTS utteranceText DIFF?? ",
                `[[${utteranceText}]]`, `[[${txtToCheck}]]`);
        }
        const ttsWord = utteranceText.substr(charIndex, charLength);
        if (ttsWord !== word) {
            console.log("TTS word DIFF?? ",
                `[[${ttsWord}]]`, `[[${word}]]`,
                `${charIndex}--${charLength}`, `${start}--${end - start}`);
        }
        // console.log("HIGHLIGHT WORD DATA:");
        // console.log(utteranceText);
        // console.log(txtToCheck);
        // console.log(ttsWord);
        // console.log(word);
        // console.log(charIndex);
        // console.log(charLength);
        // console.log(start);
        // console.log(end - start);
    }

    let acc = 0;
    let rangeStartNode: Node | undefined;
    let rangeStartOffset = -1;
    let rangeEndNode: Node | undefined;
    let rangeEndOffset = -1;
    const charIndexEnd = charIndexAdjusted + charLength;
    for (const txtNode of ttsQueueItem.textNodes) {
        if (!txtNode.nodeValue && txtNode.nodeValue !== "") {
            continue;
        }
        const l = txtNode.nodeValue.length;
        acc += l;
        if (!rangeStartNode) {
            if (charIndexAdjusted < acc) {
                rangeStartNode = txtNode;
                rangeStartOffset = l - (acc - charIndexAdjusted);
            }
        }
        if (rangeStartNode && charIndexEnd <= acc) {
            rangeEndNode = txtNode;
            rangeEndOffset = l - (acc - charIndexEnd);
            break;
        }
    }

    if (rangeStartNode && rangeEndNode) {
        // console.log("HIGHLIGHT WORD");
        // console.log(rangeStartOffset);
        // console.log(rangeEndOffset);

        const range = new Range(); // document.createRange()
        range.setStart(rangeStartNode, rangeStartOffset);
        range.setEnd(rangeEndNode, rangeEndOffset);

        const rangeInfo = convertRange(
            range,
            getCssSelector,
            (_node: Node) => ""); // computeElementCFI
        if (!rangeInfo) {
            return;
        }

        const highlightDefinitions = [
            {
                // https://htmlcolorcodes.com/
                color: {
                    blue: 0,
                    green: 0,
                    red: 200,
                },
                drawType: HighlightDrawTypeUnderline,
                expand: 2,
                selectionInfo: {
                    cleanText: "",
                    rangeInfo,
                    rawText: "",
                },
            },
        ];
        _ttsQueueItemHighlightsWord = createHighlights(
            win,
            highlightDefinitions,
            false, // mouse / pointer interaction
        );
    }
}
function wrapHighlight(
    doHighlight: boolean,
    ttsQueueItemRef: ITtsQueueItemReference) {

    if (ENABLE_TTS_OVERLAY_VIEW) {
        return;
    }

    if (_ttsQueueItemHighlightsWord) {
        _ttsQueueItemHighlightsWord.forEach((highlight) => {
            if (highlight) {
                destroyHighlight(win.document, highlight.id);
            }
        });
        _ttsQueueItemHighlightsWord = undefined;
    }
    if (_ttsQueueItemHighlightsSentence) {
        _ttsQueueItemHighlightsSentence.forEach((highlight) => {
            if (highlight) {
                destroyHighlight(win.document, highlight.id);
            }
        });
        _ttsQueueItemHighlightsSentence = undefined;
    }

    const ttsQueueItem = ttsQueueItemRef.item;
    if (doHighlight &&
        ttsQueueItem.parentElement &&
        ttsQueueItem.textNodes && ttsQueueItem.textNodes.length) {

        let range: Range | undefined;
        if (ttsQueueItem.combinedTextSentences &&
            ttsQueueItem.combinedTextSentencesRangeBegin &&
            ttsQueueItem.combinedTextSentencesRangeEnd &&
            ttsQueueItemRef.iSentence >= 0) {

            const sentBegin = ttsQueueItem.combinedTextSentencesRangeBegin[ttsQueueItemRef.iSentence];
            const sentEnd = ttsQueueItem.combinedTextSentencesRangeEnd[ttsQueueItemRef.iSentence];

            let acc = 0;
            let rangeStartNode: Node | undefined;
            let rangeStartOffset = -1;
            let rangeEndNode: Node | undefined;
            let rangeEndOffset = -1;
            for (const txtNode of ttsQueueItemRef.item.textNodes) {
                if (!txtNode.nodeValue && txtNode.nodeValue !== "") {
                    continue;
                }
                const l = txtNode.nodeValue.length;
                acc += l;
                if (!rangeStartNode) {
                    if (sentBegin < acc) {
                        rangeStartNode = txtNode;
                        rangeStartOffset = l - (acc - sentBegin);
                    }
                }
                if (rangeStartNode && sentEnd <= acc) {
                    rangeEndNode = txtNode;
                    rangeEndOffset = l - (acc - sentEnd);
                    break;
                }
            }

            if (rangeStartNode && rangeEndNode) {
                // console.log("HIGHLIGHT WORD");
                // console.log(rangeStartOffset);
                // console.log(rangeEndOffset);

                range = new Range(); // document.createRange()
                range.setStart(rangeStartNode, rangeStartOffset);
                range.setEnd(rangeEndNode, rangeEndOffset);
            }
        } else { // ttsQueueItem.combinedText

            range = new Range(); // document.createRange()

            const firstTextNode = ttsQueueItem.textNodes[0];
            if (!firstTextNode.nodeValue && firstTextNode.nodeValue !== "") {
                return;
            }
            range.setStart(firstTextNode, 0);

            const lastTextNode = ttsQueueItem.textNodes[ttsQueueItem.textNodes.length - 1];
            if (!lastTextNode.nodeValue && lastTextNode.nodeValue !== "") {
                return;
            }
            range.setEnd(lastTextNode, lastTextNode.nodeValue.length);
        }

        if (range) {
            const rangeInfo = convertRange(
                range,
                getCssSelector,
                (_node: Node) => ""); // computeElementCFI
            if (!rangeInfo) {
                return;
            }

            const highlightDefinitions = [
                {
                    // https://htmlcolorcodes.com/
                    color: {
                        blue: 116, // 204,
                        green: 248, // 218,
                        red: 248, // 255,
                    },
                    drawType: HighlightDrawTypeBackground,
                    expand: 4,
                    selectionInfo: {
                        cleanText: "",
                        rangeInfo,
                        rawText: "",
                    },
                },
            ];
            _ttsQueueItemHighlightsSentence = createHighlights(
                win,
                highlightDefinitions,
                false, // mouse / pointer interaction
            );
        }
    }
}

function highlights(doHighlight: boolean) {

    if (ENABLE_TTS_OVERLAY_VIEW) {
        return;
    }
    if (!_dialogState) {
        return;
    }
    if (doHighlight) {
        if (_dialogState.ttsQueueItem) {
            wrapHighlight(true, _dialogState.ttsQueueItem);
        }
        if (win.READIUM2.DEBUG_VISUALS &&
            _dialogState.ttsRootElement) {
            _dialogState.ttsRootElement.classList.add(TTS_ID_SPEAKING_DOC_ELEMENT);
        }
    } else {
        if (_dialogState.ttsQueueItem) {
            wrapHighlight(false, _dialogState.ttsQueueItem);
        }
        if (// win.READIUM2.DEBUG_VISUALS &&
            _dialogState.ttsRootElement) {
            _dialogState.ttsRootElement.classList.remove(TTS_ID_SPEAKING_DOC_ELEMENT);
        }
    }
}

let _lastAnimState: IPropertyAnimationState | undefined;
const animationTime = 400;

const scrollIntoViewSpokenTextDebounced = debounce((id: string) => {
    scrollIntoViewSpokenText(id);
}, 200);
function scrollIntoViewSpokenText(id: string) {

    const reduceMotion = win.document.documentElement.classList.contains(ROOT_CLASS_REDUCE_MOTION);

    const span = win.document.getElementById(id) as HTMLElement;
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
        const diff = Math.abs(_dialogState.domText.scrollTop - offset);
        if (diff < 20) {
            return; // prevents jankiness due to CSS bug
        }

        if (_lastAnimState && _lastAnimState.animating) {
            win.cancelAnimationFrame(_lastAnimState.id);
            _lastAnimState.object[_lastAnimState.property] = _lastAnimState.destVal;
        }

        // _dialogState.domText.scrollTop = offset;
        const targetObj = _dialogState.domText;
        const targetProp = "scrollTop";
        if (reduceMotion) {
            _lastAnimState = undefined;
            targetObj[targetProp] = offset;
        } else {
            // _lastAnimState = undefined;
            // (targetObj as HTMLElement).style.transition = "";
            // (targetObj as HTMLElement).style.transform = "none";
            // (targetObj as HTMLElement).style.transition =
            //     `transform ${animationTime}ms ease-in-out 0s`;
            // (targetObj as HTMLElement).style.transform =
            //     isVerticalWritingMode() ?
            //     `translateY(${unit}px)` :
            //     `translateX(${(isRTL() ? -1 : 1) * unit}px)`;
            // setTimeout(() => {
            //     (targetObj as HTMLElement).style.transition = "";
            //     (targetObj as HTMLElement).style.transform = "none";
            //     targetObj[targetProp] = offset;
            // }, animationTime);
            _lastAnimState = animateProperty(
                win.cancelAnimationFrame,
                undefined,
                // (cancelled: boolean) => {
                //     debug(cancelled);
                // },
                targetProp,
                animationTime,
                targetObj,
                offset,
                win.requestAnimationFrame,
                easings.easeInOutQuad,
            );
        }
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

const R2_DATA_ATTR_UTTERANCE_INDEX = "data-r2-tts-utterance-index";

function updateTTSInfo(
    // ttsQueueItemPreview: ITtsQueueItemReference | undefined,
    charIndex: number,
    charLength: number,
    utteranceText: string | undefined): string | undefined {

    if (!_dialogState || !_dialogState.hasAttribute("open") || !_dialogState.domText ||
        !_dialogState.ttsQueue || !_dialogState.ttsQueueItem) {
        return undefined;
    }

    const ttsQueueItem = _dialogState.ttsQueueItem;
    if (!ttsQueueItem) {
        return undefined;
    }

    const isWordBoundary = charIndex >= 0 && utteranceText;

    if (!isWordBoundary && _dialogState.focusScrollRaw && ttsQueueItem.item.parentElement) {
        _dialogState.focusScrollRaw(ttsQueueItem.item.parentElement as HTMLElement, false, true);
    }

    const ttsQueueItemText = utteranceText ? utteranceText : getTtsQueueItemRefText(ttsQueueItem);

    let ttsQueueItemMarkup = ttsQueueItemText;

    if (charIndex >= 0 && utteranceText) { // isWordBoundary
        const start = utteranceText.slice(0, charIndex + 1).search(/\S+$/);
        const right = utteranceText.slice(charIndex).search(/\s/);
        const word = right < 0 ? utteranceText.slice(start) : utteranceText.slice(start, right + charIndex);
        const end = start + word.length;
        // debug(word);

        if (ENABLE_TTS_OVERLAY_VIEW) {
            const prefix = `<span id="${TTS_ID_ACTIVE_WORD}">`;
            const suffix = "</span>";

            const before = utteranceText.substr(0, start);
            const after = utteranceText.substr(end);
            const l = before.length + word.length + after.length;
            ttsQueueItemMarkup = (l === utteranceText.length) ?
                `${before}${prefix}${word}${suffix}${after}` : utteranceText;
        } else {
            // tslint:disable-next-line:max-line-length
            wrapHighlightWord(ttsQueueItem, utteranceText, charIndex, charLength, word, start, end);
        }
    }

    if (!ENABLE_TTS_OVERLAY_VIEW) {
        return ttsQueueItemText;
    }

    let activeUtteranceElem = _dialogState.domText.ownerDocument ?
        _dialogState.domText.ownerDocument.getElementById(TTS_ID_ACTIVE_UTTERANCE) :
        _dialogState.domText.querySelector(`#${TTS_ID_ACTIVE_UTTERANCE}`);
    if (activeUtteranceElem) {
        const indexStr = activeUtteranceElem.getAttribute(R2_DATA_ATTR_UTTERANCE_INDEX);
        if (indexStr && indexStr !== `${ttsQueueItem.iGlobal}`) {
            activeUtteranceElem.removeAttribute("id");
            const activeWordElem = activeUtteranceElem.ownerDocument ?
                activeUtteranceElem.ownerDocument.getElementById(TTS_ID_ACTIVE_WORD) :
                activeUtteranceElem.querySelector(`#${TTS_ID_ACTIVE_WORD}`);
            if (activeWordElem) {
                const index = parseInt(indexStr, 10);
                if (!isNaN(index)) {
                    const ttsQItem = getTtsQueueItemRef(_dialogState.ttsQueue, index);
                    if (ttsQItem) {
                        const txt = getTtsQueueItemRefText(ttsQItem);
                        try {
                            activeUtteranceElem.innerHTML = txt;
                        } catch (err) {
                            console.log(err);
                            console.log(txt);
                            activeUtteranceElem.innerHTML = "txt";
                        }
                    }
                }
            }

            activeUtteranceElem = _dialogState.domText.querySelector(
                `[${R2_DATA_ATTR_UTTERANCE_INDEX}="${ttsQueueItem.iGlobal}"]`);
            if (activeUtteranceElem) {
                activeUtteranceElem.setAttribute("id", TTS_ID_ACTIVE_UTTERANCE);
            }
        }
        if (activeUtteranceElem) {
            try {
                activeUtteranceElem.innerHTML = ttsQueueItemMarkup;
            } catch (err) {
                console.log(err);
                console.log(ttsQueueItemMarkup);
                activeUtteranceElem.innerHTML = "ttsQueueItemMarkup";
            }
        }
    } else {
        let fullMarkup = "";
        for (let i = 0; i < _dialogState.ttsQueueLength; i++) {
            const ttsQItem = getTtsQueueItemRef(_dialogState.ttsQueue, i);
            if (!ttsQItem) {
                continue;
            }
            let ttsQItemMarkup = ttsQueueItemMarkup;

            let isHeadingLevel1 = false;
            let isHeadingLevel2 = false;
            let isHeadingLevel3 = false;
            let isHeadingLevel4 = false;
            let isHeadingLevel5 = false;
            let p: Element | null = ttsQItem.item.parentElement;
            while (p && p.tagName) {
                const tagName = p.tagName.toLowerCase();
                if (tagName === "h1") {
                    isHeadingLevel1 = true;
                    break;
                } else if (tagName === "h2") {
                    isHeadingLevel2 = true;
                    break;
                } else if (tagName === "h3") {
                    isHeadingLevel3 = true;
                    break;
                } else if (tagName === "h4") {
                    isHeadingLevel4 = true;
                    break;
                } else if (tagName === "h5") {
                    isHeadingLevel5 = true;
                    break;
                }
                p = p.parentNode as (Element | null);
            }
            const classes = TTS_CLASS_UTTERANCE +
                (isHeadingLevel1 ? ` ${TTS_CLASS_UTTERANCE_HEADING1}` :
                (isHeadingLevel2 ? ` ${TTS_CLASS_UTTERANCE_HEADING2}` :
                (isHeadingLevel3 ? ` ${TTS_CLASS_UTTERANCE_HEADING3}` :
                (isHeadingLevel4 ? ` ${TTS_CLASS_UTTERANCE_HEADING4}` :
                (isHeadingLevel5 ? ` ${TTS_CLASS_UTTERANCE_HEADING5}` : "")))));

            // tslint:disable-next-line:max-line-length
            let ttsQItemMarkupAttributes = `${R2_DATA_ATTR_UTTERANCE_INDEX}="${ttsQItem.iGlobal}" class="${classes}"`;
            if (ttsQItem.iGlobal === ttsQueueItem.iGlobal) {
                ttsQItemMarkupAttributes += ` id="${TTS_ID_ACTIVE_UTTERANCE}" `;
            } else {
                ttsQItemMarkup = getTtsQueueItemRefText(ttsQItem);
            }
            let imageMarkup = "";
            if (ttsQItem.item.parentElement && ttsQItem.item.parentElement.tagName &&
                ttsQItem.item.parentElement.tagName.toLowerCase() === "img" &&
                (ttsQItem.item.parentElement as HTMLImageElement).src) {

                imageMarkup = `<img src="${(ttsQItem.item.parentElement as HTMLImageElement).src}" />`;
            }
            if (ttsQItem.item.dir) {
                ttsQItemMarkupAttributes += ` dir="${ttsQItem.item.dir}" `;
            }
            if (ttsQItem.item.lang) {
                ttsQItemMarkupAttributes += ` lang="${ttsQItem.item.lang}" xml:lang="${ttsQItem.item.lang}" `;
            }
            fullMarkup += `${imageMarkup}<div ${ttsQItemMarkupAttributes}>${ttsQItemMarkup}</div>`;
        }

        try {
            _dialogState.domText.insertAdjacentHTML("beforeend", fullMarkup);
        } catch (err) {
            console.log(err);
            console.log(fullMarkup);
            try {
                _dialogState.domText.innerHTML = fullMarkup;
            } catch (err) {
                console.log(err);
                console.log(fullMarkup);
                _dialogState.domText.innerHTML = "fullMarkup";
            }
        }
    }

    // if (!isWordBoundary) {
    //     if (_dialogState.domInfo) {
    //         _dialogState.domInfo.innerText = (ttsQueueItem.iGlobal + 1) + "/" + _dialogState.ttsQueueLength;
    //     }
    // }

    scrollIntoViewSpokenTextDebounced(isWordBoundary ? TTS_ID_ACTIVE_WORD : TTS_ID_ACTIVE_UTTERANCE);

    return ttsQueueItemText;
}

const ttsPlayQueueIndexDebounced = debounce((ttsQueueIndex: number) => {
    ttsPlayQueueIndex(ttsQueueIndex);
}, 150);

export function ttsPlayQueueIndex(ttsQueueIndex: number) {

    if (!_dialogState ||
        !_dialogState.ttsRootElement ||
        !_dialogState.focusScrollRaw ||
        !_dialogState.ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable ||
        !_dialogState.ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable ||
        !_dialogState.ttsQueue ||
        !_dialogState.hasAttribute("open")) {
        ttsStop();
        return;
    }

    _dialogState.ttsQueueItem = undefined;
    _dialogState.ttsUtterance = undefined;

    if (_dialogState.domSlider) {
        // _dialogState.domSlider.value = "" + ttsQueueIndex;
        _dialogState.domSlider.valueAsNumber = ttsQueueIndex;
    }

    if (ttsQueueIndex < 0) {
        ttsStop();
        return;
    }
    if (ttsQueueIndex >= _dialogState.ttsQueueLength) {
        ttsStop();

        setTimeout(() => {
            ipcRenderer.sendToHost(R2_EVENT_TTS_DOC_END);
            // const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
            //     direction: "LTR",
            //     go: "NEXT",
            // };
            // ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
        }, 400);

        return;
    }
    const ttsQueueItem = getTtsQueueItemRef(_dialogState.ttsQueue, ttsQueueIndex);
    if (!ttsQueueItem) {
        ttsStop();
        return;
    }
    _dialogState.ttsQueueItem = ttsQueueItem;

    highlights(true);

    const txtStr = updateTTSInfo(-1, -1, undefined);
    if (!txtStr) {
        ttsStop();
        return;
    }

    const utterance = new SpeechSynthesisUtterance(txtStr);
    _dialogState.ttsUtterance = utterance;
    (utterance as any).r2_ttsQueueIndex = ttsQueueIndex;

    // TODO:
    // utterance.voice
    // utterance.rate
    // utterance.pitch
    // utterance.volume
    if (_dialogState.ttsQueueItem.item.lang) {
        utterance.lang = _dialogState.ttsQueueItem.item.lang;
    }
    if (win.READIUM2.ttsPlaybackRate >= 0.1 && win.READIUM2.ttsPlaybackRate <= 10) {
        utterance.rate = win.READIUM2.ttsPlaybackRate;
    }

    utterance.onboundary = (ev: SpeechSynthesisEvent) => {
        if ((utterance as any).r2_cancel) {
            return;
        }
        if (!_dialogState || !_dialogState.ttsQueueItem) {
            return;
        }
        if ((utterance as any).r2_ttsQueueIndex !== _dialogState.ttsQueueItem.iGlobal) {
            return;
        }

        if (ev.name !== "word") {
            return;
        }

        updateTTSInfo(ev.charIndex, ev.charLength, utterance.text);
    };

    utterance.onend = (_ev: SpeechSynthesisEvent) => {
        if ((utterance as any).r2_cancel) {
            return;
        }
        if (!_dialogState || !_dialogState.ttsQueueItem) {
            return;
        }
        if ((utterance as any).r2_ttsQueueIndex !== _dialogState.ttsQueueItem.iGlobal) {
            return;
        }

        highlights(false);

        ttsPlayQueueIndexDebounced(ttsQueueIndex + 1);
    };

    _resumableState = {
        ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable:
            _dialogState.ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable,
        ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable:
            _dialogState.ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable,
        focusScrollRaw: _dialogState.focusScrollRaw,
        ttsQueue: _dialogState.ttsQueue,
        ttsQueueIndex: _dialogState.ttsQueueItem.iGlobal, // ttsQueueIndex
        ttsRootElement: _dialogState.ttsRootElement,
    };

    (utterance as any).r2_cancel = false;
    setTimeout(() => {
        win.speechSynthesis.speak(utterance);
    }, 0);

    win.document.documentElement.classList.add(TTS_CLASS_IS_ACTIVE);
    ipcRenderer.sendToHost(R2_EVENT_TTS_IS_PLAYING);
}

function startTTSSession(
    speed: number,
    ttsRootElement: Element,
    ttsQueue: ITtsQueueItem[],
    ttsQueueIndexStart: number,
    focusScrollRaw: (el: HTMLOrSVGElement, doFocus: boolean, animate: boolean) => void,
    ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable: () => number,
    ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable: (val: number) => void,
    ) {
    win.READIUM2.ttsPlaybackRate = speed;

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

    const val = ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable();

    function onDialogClosed(el: HTMLOrSVGElement | null) {
        ttsPause();

        if (_dialogState && _dialogState.focusScrollRaw) {
            let toScrollTo = el;
            if (_dialogState.ttsQueueItem && _dialogState.ttsQueueItem.item.parentElement) {
                toScrollTo = _dialogState.ttsQueueItem.item.parentElement as HTMLElement;
            }
            if (toScrollTo && ENABLE_TTS_OVERLAY_VIEW) {
                _dialogState.focusScrollRaw(toScrollTo, false, true);
            } else {
                ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable(val);
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
        class="${CSS_CLASS_NO_FOCUS_OUTLINE} ${TTS_CLASS_THEME1}"
        dir="ltr"
        lang="en"
        xml:lang="en"
        tabindex="0" autofocus="autofocus"></div>
    <button id="${TTS_ID_PREVIOUS}" class="${TTS_NAV_BUTTON_CLASS}" title="previous"><span>&#9668;</span></button>
    <button id="${TTS_ID_NEXT}" class="${TTS_NAV_BUTTON_CLASS}" title="next"><span>&#9658;</span></button>
    <input id="${TTS_ID_SLIDER}" type="range" min="0" max="${ttsQueueLength - 1}" value="0"
        ${isRTL() ? `dir="rtl"` : `dir="ltr"`}  title="progress"/>`;

    const pop = new PopupDialog(
        win.document,
        outerHTML,
        onDialogClosed,
        `${TTS_POPUP_DIALOG_CLASS}${ENABLE_TTS_OVERLAY_VIEW ? "" : ` ${POPUP_DIALOG_CLASS_COLLAPSE}`}`,
        true);
    pop.show(ttsQueueItemStart.item.parentElement);

    _dialogState = pop.dialog as IHTMLDialogElementWithTTSState;
    if (!_dialogState) {
        return;
    }

    _dialogState.focusScrollRaw = focusScrollRaw;
    _dialogState.ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable =
        ensureTwoPageSpreadWithOddColumnsIsOffsetTempDisable;
    _dialogState.ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable =
        ensureTwoPageSpreadWithOddColumnsIsOffsetReEnable;

    _dialogState.ttsRootElement = ttsRootElement;

    _dialogState.domSlider = win.document.getElementById(TTS_ID_SLIDER) as HTMLInputElement;
    _dialogState.domPrevious = win.document.getElementById(TTS_ID_PREVIOUS) as HTMLButtonElement;
    _dialogState.domNext = win.document.getElementById(TTS_ID_NEXT) as HTMLButtonElement;
    _dialogState.domText = win.document.getElementById(TTS_ID_CONTAINER) as HTMLDivElement;

    _dialogState.ttsQueue = ttsQueue;
    _dialogState.ttsQueueLength = ttsQueueLength;

    if (_dialogState.domSlider) {
        _dialogState.domSlider.addEventListener("input", (_ev: Event) => {
            if (_dialogState && _dialogState.domSlider) {
                // const n = parseInt(_dialogState.domSlider.value, 10);
                const n = _dialogState.domSlider.valueAsNumber;

                ttsPreviewAndEventuallyPlayQueueIndex(n);
            }
        });
    }

    if (_dialogState.domPrevious) {
        _dialogState.domPrevious.addEventListener("click", (_ev: MouseEvent) => {

            if (isRTL()) {
                ttsNext();
            } else {
                ttsPrevious();
            }
        });
    }
    if (_dialogState.domNext) {
        _dialogState.domNext.addEventListener("click", (_ev: MouseEvent) => {

            if (!isRTL()) {
                ttsNext();
            } else {
                ttsPrevious();
            }
        });
    }

    if (_dialogState.domText) {
        _dialogState.domText.addEventListener("click", (ev: MouseEvent) => {
            if (ev.target && _dialogState && _dialogState.ttsQueue && _dialogState.ttsQueueItem) {
                const indexStr = (ev.target as Element).getAttribute(R2_DATA_ATTR_UTTERANCE_INDEX);
                if (indexStr) {
                    const index = parseInt(indexStr, 10);
                    if (!isNaN(index)) {
                        const ttsQItem = getTtsQueueItemRef(_dialogState.ttsQueue, index);
                        if (ttsQItem) {
                            if (ttsQItem.iGlobal !== _dialogState.ttsQueueItem.iGlobal) {
                                ttsPause();
                                ttsPlayQueueIndexDebounced(index);
                                return;
                            }
                        }
                    }
                }
            }

            ttsPauseOrResume();
        });
    }

    ttsPlayQueueIndexDebounced(ttsQueueIndexStart);
}
