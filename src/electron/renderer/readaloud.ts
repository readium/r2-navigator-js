// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import {
    IEventPayload_R2_EVENT_TTS_CLICK_ENABLE, IEventPayload_R2_EVENT_TTS_DO_PLAY,
    IEventPayload_R2_EVENT_TTS_PLAYBACK_RATE, R2_EVENT_READING_LOCATION, R2_EVENT_TTS_CLICK_ENABLE,
    R2_EVENT_TTS_DOC_END, R2_EVENT_TTS_DO_NEXT, R2_EVENT_TTS_DO_PAUSE, R2_EVENT_TTS_DO_PLAY,
    R2_EVENT_TTS_DO_PREVIOUS, R2_EVENT_TTS_DO_RESUME, R2_EVENT_TTS_DO_STOP, R2_EVENT_TTS_IS_PAUSED,
    R2_EVENT_TTS_IS_PLAYING, R2_EVENT_TTS_IS_STOPPED, R2_EVENT_TTS_PLAYBACK_RATE,
} from "../common/events";
import { getCurrentReadingLocation, navLeftOrRight } from "./location";
import { isRTL } from "./readium-css";
import { IReadiumElectronBrowserWindow, IReadiumElectronWebview } from "./webview/state";

// import * as debug_ from "debug";
// const debug = debug_("r2:navigator#electron/renderer/index");
// const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

const win = window as IReadiumElectronBrowserWindow;

let _lastTTSWebView: IReadiumElectronWebview | undefined;
let _lastTTSWebViewHref: string | undefined;
let _ttsAutoPlayTimeout: number | undefined;
export function checkTtsState(wv: IReadiumElectronWebview) {

    let wasStopped = false;
    if (_lastTTSWebView && _lastTTSWebViewHref) {

        if (win.READIUM2.ttsClickEnabled ||
            !win.READIUM2.getActiveWebViews().includes(_lastTTSWebView) ||
            !win.READIUM2.getActiveWebViews().find((webview) => webview.READIUM2.link?.Href === _lastTTSWebViewHref)) {

            wasStopped = true;

            setTimeout(() => {
                win.speechSynthesis.cancel();
            }, 0);

            _lastTTSWebView = undefined;
            _lastTTSWebViewHref = undefined;
            if (_ttsListener) {
                _ttsListener(TTSStateEnum.STOPPED);
            }
        }
    }

    if (wasStopped || win.READIUM2.ttsClickEnabled) {
        if (wv.READIUM2.link?.Href) {
            if (_ttsAutoPlayTimeout) {
                win.clearTimeout(_ttsAutoPlayTimeout);
                _ttsAutoPlayTimeout = undefined;
            }
            _ttsAutoPlayTimeout = win.setTimeout(() => {
                _ttsAutoPlayTimeout = undefined;

                if (!_lastTTSWebView && wv.READIUM2.link?.Href) {

                    _lastTTSWebView = wv;
                    _lastTTSWebViewHref = wv.READIUM2.link.Href;
                    playTtsOnReadingLocation(wv.READIUM2.link.Href);
                }
            }, 100);
        }
    }
}
export function playTtsOnReadingLocation(href: string) {
    const activeWebView = win.READIUM2.getActiveWebViews().find((webview) => {
        return webview.READIUM2.link?.Href === href;
    });
    if (activeWebView) {
        let done = false;
        const cb = (event: Electron.IpcMessageEvent) => {
            if (event.channel === R2_EVENT_READING_LOCATION) {
                const webview = event.currentTarget as IReadiumElectronWebview;
                if (webview !== activeWebView) {
                    console.log("Wrong navigator webview?!");
                    return;
                }
                done = true;
                activeWebView.removeEventListener("ipc-message", cb);
                if (activeWebView.READIUM2.link?.Href === href) {
                    ttsPlay(win.READIUM2.ttsPlaybackRate);
                }
            }
        };
        setTimeout(() => {
            if (done) {
                return;
            }
            try {
                activeWebView.removeEventListener("ipc-message", cb);
            } catch (err) {
                console.log(err);
            }
        }, 1000);
        activeWebView.addEventListener("ipc-message", cb);
    }
}
export function ttsHandleIpcMessage(
    eventChannel: string,
    _eventArgs: any[],
    eventCurrentTarget: IReadiumElectronWebview): boolean {

    if (eventChannel === R2_EVENT_TTS_IS_PAUSED) {
        _lastTTSWebView = eventCurrentTarget;
        _lastTTSWebViewHref = eventCurrentTarget.READIUM2.link?.Href;
        if (_ttsListener) {
            _ttsListener(TTSStateEnum.PAUSED);
        }
    } else if (eventChannel === R2_EVENT_TTS_IS_STOPPED) {
        _lastTTSWebView = undefined;
        _lastTTSWebViewHref = undefined;
        if (_ttsListener) {
            _ttsListener(TTSStateEnum.STOPPED);
        }
    } else if (eventChannel === R2_EVENT_TTS_IS_PLAYING) {
        _lastTTSWebView = eventCurrentTarget;
        _lastTTSWebViewHref = eventCurrentTarget.READIUM2.link?.Href;
        if (_ttsListener) {
            _ttsListener(TTSStateEnum.PLAYING);
        }
    } else if (eventChannel === R2_EVENT_TTS_DOC_END) {
        // _lastTTSWebView = undefined;
        // _lastTTSWebViewHref = undefined;
        // if (_ttsListener) {
        //     _ttsListener(TTSStateEnum.STOPPED);
        // }
        // const nextSpine =
        navLeftOrRight(isRTL(), true, true);
        // if (nextSpine) {
        //     setTimeout(() => {
        //         playTtsOnReadingLocation(nextSpine.Href);
        //     }, 200);
        // }
    } else {
        return false;
    }
    // else if (eventChannel === R2_EVENT_TTS_PLAYBACK_RATE) {
    //     // debug("R2_EVENT_TTS_PLAYBACK_RATE (webview.addEventListener('ipc-message')");
    //     const payload = eventArgs[0] as IEventPayload_R2_EVENT_TTS_PLAYBACK_RATE;
    //     setCurrentTTSPlaybackRate(payload.speed);
    // }
    return true;
}

export enum TTSStateEnum {
    PAUSED = "PAUSED",
    PLAYING = "PLAYING",
    STOPPED = "STOPPED",
}
let _ttsListener: ((ttsState: TTSStateEnum) => void) | undefined;
export function ttsListen(ttsListener: (ttsState: TTSStateEnum) => void) {
    _ttsListener = ttsListener;
}

export function ttsPlay(speed: number) {
    if (win.READIUM2) {
        win.READIUM2.ttsPlaybackRate = speed;
    }

    let startElementCSSSelector: string | undefined;
    const loc = getCurrentReadingLocation();

    let activeWebView = win.READIUM2.getActiveWebViews().find((webview) => {
        return loc && loc.locator.href && loc.locator.href === webview.READIUM2.link?.Href;
    });
    if (loc && activeWebView) {
        startElementCSSSelector = loc.locator.locations.cssSelector;
    }
    if (!activeWebView) {
        activeWebView = win.READIUM2.getFirstWebView();
    }
    _lastTTSWebView = activeWebView;
    _lastTTSWebViewHref = undefined;
    if (!activeWebView) {
        return;
    }
    _lastTTSWebViewHref = activeWebView.READIUM2.link?.Href;

    const payload: IEventPayload_R2_EVENT_TTS_DO_PLAY = {
        rootElement: "html > body", // window.document.body
        speed,
        startElement: startElementCSSSelector,
    };

    setTimeout(async () => {
        if (activeWebView) {
            await activeWebView.send(R2_EVENT_TTS_DO_PLAY, payload);
        }
    }, 0);
}

export function ttsPause() {
    const activeWebViews = win.READIUM2.getActiveWebViews();
    for (const activeWebView of activeWebViews) {
        if (_lastTTSWebView && _lastTTSWebView !== activeWebView) {
            continue;
        }
        setTimeout(async () => {
            await activeWebView.send(R2_EVENT_TTS_DO_PAUSE);
        }, 0);
    }
}
export function ttsStop() {
    const activeWebViews = win.READIUM2.getActiveWebViews();
    for (const activeWebView of activeWebViews) {
        if (_lastTTSWebView && _lastTTSWebView !== activeWebView) {
            continue;
        }
        _lastTTSWebView = undefined;
        _lastTTSWebViewHref = undefined;
        setTimeout(async () => {
            await activeWebView.send(R2_EVENT_TTS_DO_STOP);
        }, 0);
    }
}
export function ttsResume() {
    const activeWebViews = win.READIUM2.getActiveWebViews();
    for (const activeWebView of activeWebViews) {
        if (_lastTTSWebView && _lastTTSWebView !== activeWebView) {
            continue;
        }
        setTimeout(async () => {
            await activeWebView.send(R2_EVENT_TTS_DO_RESUME);
        }, 0);
    }
}
export function ttsPrevious() {
    const activeWebViews = win.READIUM2.getActiveWebViews();
    for (const activeWebView of activeWebViews) {
        if (_lastTTSWebView && _lastTTSWebView !== activeWebView) {
            continue;
        }
        setTimeout(async () => {
            await activeWebView.send(R2_EVENT_TTS_DO_PREVIOUS);
        }, 0);
    }
}
export function ttsNext() {
    const activeWebViews = win.READIUM2.getActiveWebViews();
    for (const activeWebView of activeWebViews) {
        if (_lastTTSWebView && _lastTTSWebView !== activeWebView) {
            continue;
        }
        setTimeout(async () => {
            await activeWebView.send(R2_EVENT_TTS_DO_NEXT);
        }, 0);
    }
}

export function ttsClickEnable(doEnable: boolean) {
    if (win.READIUM2) {
        win.READIUM2.ttsClickEnabled = doEnable;
    }

    const activeWebViews = win.READIUM2.getActiveWebViews();
    for (const activeWebView of activeWebViews) {
        setTimeout(async () => {
            const payload: IEventPayload_R2_EVENT_TTS_CLICK_ENABLE = {
                doEnable,
            };

            setTimeout(async () => {
                await activeWebView.send(R2_EVENT_TTS_CLICK_ENABLE, payload);
            }, 0);
        }, 0);
    }
}

export function ttsPlaybackRate(speed: number) {
    if (win.READIUM2) {
        win.READIUM2.ttsPlaybackRate = speed;
    }

    const activeWebViews = win.READIUM2.getActiveWebViews();
    for (const activeWebView of activeWebViews) {
        const payload: IEventPayload_R2_EVENT_TTS_PLAYBACK_RATE = {
            speed,
        };
        setTimeout(async () => {
            await activeWebView.send(R2_EVENT_TTS_PLAYBACK_RATE, payload);
        }, 0);
    }
}
