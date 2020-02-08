// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { debounce } from "debounce";
import { ipcRenderer } from "electron";

import {
    IEventPayload_R2_EVENT_PAGE_TURN, IEventPayload_R2_EVENT_READING_LOCATION,
    R2_EVENT_AUDIO_DO_PAUSE, R2_EVENT_AUDIO_DO_PLAY, R2_EVENT_PAGE_TURN_RES,
    R2_EVENT_READING_LOCATION,
} from "../../common/events";
import {
    AUDIO_COVER_ID, AUDIO_FORWARD_ID, AUDIO_ID, AUDIO_NEXT_ID, AUDIO_PERCENT_ID, AUDIO_PLAYPAUSE_ID,
    AUDIO_PREVIOUS_ID, AUDIO_PROGRESS_CLASS, AUDIO_REWIND_ID, AUDIO_SLIDER_ID, AUDIO_TIME_ID,
} from "../../common/styles";
import { IReadiumElectronWebviewWindow } from "./state";

// const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

const win = (global as any).window as IReadiumElectronWebviewWindow;

function throttle(fn: (...argz: any[]) => any, time: number) {
    let called = false;
    return (...args: any[]) => {
        if (!called) {
            fn(...args);
            called = true;
            setTimeout(() => {
                called = false;
            }, time);
        }
    };
}

export function setupAudioBook(_docTitle: string | undefined) {

    win.document.documentElement.classList.add(AUDIO_PROGRESS_CLASS);

    const coverElement = win.document.getElementById(AUDIO_COVER_ID) as HTMLImageElement;
    const audioElement = win.document.getElementById(AUDIO_ID) as HTMLAudioElement;
    const sliderElement = win.document.getElementById(AUDIO_SLIDER_ID) as HTMLInputElement;
    const timeElement = win.document.getElementById(AUDIO_TIME_ID) as HTMLSpanElement;
    const percentElement = win.document.getElementById(AUDIO_PERCENT_ID) as HTMLSpanElement;
    const playPauseElement = win.document.getElementById(AUDIO_PLAYPAUSE_ID) as HTMLButtonElement;
    const previousElement = win.document.getElementById(AUDIO_PREVIOUS_ID) as HTMLButtonElement;
    const nextElement = win.document.getElementById(AUDIO_NEXT_ID) as HTMLButtonElement;
    const rewindElement = win.document.getElementById(AUDIO_REWIND_ID) as HTMLButtonElement;
    const forwardElement = win.document.getElementById(AUDIO_FORWARD_ID) as HTMLButtonElement;

    ipcRenderer.on(R2_EVENT_AUDIO_DO_PLAY, async (_event: any) => {
        await audioElement.play();
    });
    ipcRenderer.on(R2_EVENT_AUDIO_DO_PAUSE, (_event: any) => {
        audioElement.pause();
    });

    rewindElement.addEventListener("click", () => {
        const newTime = Math.max(0, audioElement.currentTime - 30);
        audioElement.currentTime = newTime;
        // if (newTime < 0.5) {
        //     const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
        //         direction: "LTR",
        //         go: "PREVIOUS",
        //     };
        //     ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
        // } else {
        //     audioElement.currentTime = newTime;
        // }
    });
    forwardElement.addEventListener("click", () => {
        const newTime = Math.min(audioElement.duration, audioElement.currentTime + 30);
        audioElement.currentTime = newTime;
        // if (newTime >= audioElement.duration - 0.5) {
        //     const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
        //         direction: "LTR",
        //         go: "NEXT",
        //     };
        //     ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
        // } else {
        //     audioElement.currentTime = newTime;
        // }
    });

    previousElement.addEventListener("click", () => {
        const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
            direction: "LTR",
            go: "PREVIOUS",
        };
        ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
    });
    nextElement.addEventListener("click", () => {
        const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
            direction: "LTR",
            go: "NEXT",
        };
        ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
    });

    // const debounceSlider = debounce((wasPlaying: boolean | undefined) => {
    //     const p = sliderElement.valueAsNumber / 100;
    //     audioElement.currentTime = audioElement.duration * p;
    //     if (wasPlaying) {
    //         setTimeout(async () => {
    //             await audioElement.play();
    //         }, 200);
    //     }
    // }, 500);
    sliderElement.addEventListener("input", () => {

        const p = sliderElement.valueAsNumber / 100;
        audioElement.currentTime = audioElement.duration * p;

        // const wasPlaying = win.READIUM2.locationHashOverrideInfo?.audioPlaybackInfo?.isPlaying;
        // audioElement.pause();
        // debounceSlider(wasPlaying);
    });
    function togglePlayPause() {
        if (win.READIUM2.locationHashOverrideInfo &&
            win.READIUM2.locationHashOverrideInfo.audioPlaybackInfo) {
            const isPlaying = win.READIUM2.locationHashOverrideInfo.audioPlaybackInfo.isPlaying;
            if (isPlaying) {
                audioElement.pause();
            } else {
                if (audioElement.currentTime >= audioElement.duration - 0.5) {
                    const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
                        direction: "LTR",
                        go: "NEXT",
                    };
                    ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
                } else {
                    setTimeout(async () => {
                        await audioElement.play();
                    }, 0);
                }
            }
        }
    }
    coverElement.addEventListener("mousedown", () => {
        togglePlayPause();
    });
    playPauseElement.addEventListener("click", () => {
        togglePlayPause();
    });

    function formatTime(seconds: number): string {
        const secondsPerMinute = 60;
        const minutesPerHours = 60;
        const secondsPerHour = minutesPerHours * secondsPerMinute;
        let remainingSeconds = seconds;
        const nHours = Math.floor(remainingSeconds / secondsPerHour);
        remainingSeconds -= (nHours * secondsPerHour);
        if (remainingSeconds < 0) {
            remainingSeconds = 0;
        }
        const nMinutes = Math.floor(remainingSeconds / secondsPerMinute);
        remainingSeconds -= (nMinutes * secondsPerMinute);
        if (remainingSeconds < 0) {
            remainingSeconds = 0;
        }
        remainingSeconds = Math.floor(remainingSeconds);
        return `${nHours > 0 ? (nHours.toString().padStart(2, "0") + ":") : ``}${nMinutes > 0 ? (nMinutes.toString().padStart(2, "0") + ":") : `00:`}${remainingSeconds > 0 ? (remainingSeconds.toString().padStart(2, "0")) : `00`}`;
    }

    function notifyPlaybackLocation() {
        const percent = audioElement.currentTime / audioElement.duration;
        const p = Math.round(percent * 100);
        // sliderElement.value = "" + p;
        sliderElement.valueAsNumber = p;

        percentElement.innerText = `${p}%`;

        const prettyTime = `${formatTime(audioElement.currentTime)} / ${formatTime(audioElement.duration)}`;
        timeElement.innerText = prettyTime;

        win.READIUM2.locationHashOverrideInfo = {
            audioPlaybackInfo: {
                globalDuration: undefined,
                globalProgression: undefined,
                globalTime: undefined,
                isPlaying: (audioElement as any).isPlaying,
                localDuration: audioElement.duration,
                localProgression: percent,
                localTime: audioElement.currentTime,
            },
            docInfo: {
                isFixedLayout: false,
                isRightToLeft: false,
                isVerticalWritingMode: false,
            },
            href: "", // filled-in from host index.js renderer
            locations: {
                cfi: undefined,
                cssSelector: undefined,
                    // calculated in host index.js renderer, where publication object is available
                position: undefined,
                progression: percent,
            },
            paginationInfo: undefined,
            selectionInfo: undefined,
            selectionIsNew: false,
            text: undefined,
            title: _docTitle,
        };
        const payload: IEventPayload_R2_EVENT_READING_LOCATION = win.READIUM2.locationHashOverrideInfo;
        ipcRenderer.sendToHost(R2_EVENT_READING_LOCATION, payload);
    }
    const notifyPlaybackLocationThrottled = throttle(() => {
        notifyPlaybackLocation();
    }, 1000);

    // const notifyPlaybackLocationDebounced = debounce(() => {
    //     notifyPlaybackLocation();
    // }, 200);

    const progressDebounced = debounce((progress: boolean) => {
        if (progress) {
            win.document.documentElement.classList.add(AUDIO_PROGRESS_CLASS);
        } else {
            win.document.documentElement.classList.remove(AUDIO_PROGRESS_CLASS);
        }
    }, 150);

    audioElement.addEventListener("play", () => {
        (audioElement as any).isPlaying = true;
        playPauseElement.classList.add("pause");
        notifyPlaybackLocation();
    });
    audioElement.addEventListener("pause", () => {
        (audioElement as any).isPlaying = false;
        playPauseElement.classList.remove("pause");
        notifyPlaybackLocation();
    });
    audioElement.addEventListener("seeking", () => {
        progressDebounced(true);
    });
    audioElement.addEventListener("canplay", () => {
        progressDebounced(false);
    });
    audioElement.addEventListener("ended", () => {
        (audioElement as any).isPlaying = false;
        playPauseElement.classList.remove("pause");
        notifyPlaybackLocation();
        const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
            direction: "LTR",
            go: "NEXT",
        };
        ipcRenderer.sendToHost(R2_EVENT_PAGE_TURN_RES, payload);
    });

    audioElement.addEventListener("timeupdate", () => {
        // (audioElement as any).isPlaying = true;
        notifyPlaybackLocationThrottled();
    });
}
