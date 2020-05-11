// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debug_ from "debug";
import * as util from "util";

import { TaJsonDeserialize } from "@r2-lcp-js/serializable";
import { MediaOverlayNode } from "@r2-shared-js/models/media-overlay";
import { Publication } from "@r2-shared-js/models/publication";
import { Link } from "@r2-shared-js/models/publication-link";

import { DEBUG_AUDIO } from "../common/audiobook";
import {
    IEventPayload_R2_EVENT_MEDIA_OVERLAY_CLICK, IEventPayload_R2_EVENT_MEDIA_OVERLAY_HIGHLIGHT,
    R2_EVENT_MEDIA_OVERLAY_CLICK, R2_EVENT_MEDIA_OVERLAY_HIGHLIGHT,
} from "../common/events";
import { READIUM2_ELECTRON_HTTP_PROTOCOL, convertCustomSchemeToHttpUrl } from "../common/sessions";
import { navLeftOrRight } from "./location";
import { isRTL } from "./readium-css";
import { IReadiumElectronBrowserWindow, IReadiumElectronWebview } from "./webview/state";

const debug = debug_("r2:navigator#electron/renderer/location");

const IS_DEV = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev";

const win = window as IReadiumElectronBrowserWindow;

const AUDIO_MO_ID = "R2_AUDIO_MO_ID";

// URL without t=begin,end media fragment! (pure audio reference)
let _currentAudioUrl: string | undefined;
let _previousAudioUrl: string | undefined;

let _currentAudioBegin: number | undefined;
// let _previousAudioBegin: number | undefined;

let _currentAudioEnd: number | undefined;
let _previousAudioEnd: number | undefined;

let _currentAudioElement: HTMLAudioElement | undefined;

let _mediaOverlayRoot: MediaOverlayNode | undefined;
let _mediaOverlayTextAudioPair: MediaOverlayNode | undefined;
let _mediaOverlayTextId: string | undefined;

let _mediaOverlayActive = false;

const _mediaOverlaySkippabilityIsEnabled = true;

async function playMediaOverlays(
    textHref: string,
    rootMo: MediaOverlayNode,
    textFragmentIDChain: Array<string | null> | undefined) {

    let moTextAudioPair = findDepthFirstTextAudioPair(textHref, rootMo, textFragmentIDChain);
    if (!moTextAudioPair && textFragmentIDChain) {
        moTextAudioPair = findDepthFirstTextAudioPair(textHref, rootMo, undefined);
    }
    if (moTextAudioPair) {
        if (moTextAudioPair.Audio) {
            _mediaOverlayRoot = rootMo;
            await playMediaOverlaysAudio(moTextAudioPair, undefined, undefined);
        }
    } else {
        debug("!moTextAudioPair " + textHref);
    }
}

const ontimeupdate = async (ev: Event) => {
    const currentAudioElement = ev.currentTarget as HTMLAudioElement;
    if (_currentAudioEnd && currentAudioElement.currentTime >= (_currentAudioEnd - 0.05)) {

        mediaOverlaysNext();
    }
};
const ensureOnTimeUpdate = (remove: boolean) => {
    if (_currentAudioElement) {
        if (remove) {
            if ((_currentAudioElement as any).__ontimeupdate) {
                (_currentAudioElement as any).__ontimeupdate = false;
                _currentAudioElement.removeEventListener("timeupdate", ontimeupdate);
            }
        } else {
            if (!(_currentAudioElement as any).__ontimeupdate) {
                (_currentAudioElement as any).__ontimeupdate = true;
                _currentAudioElement.addEventListener("timeupdate", ontimeupdate);
            }
        }
    }
};

async function playMediaOverlaysAudio(
    moTextAudioPair: MediaOverlayNode,
    begin: number | undefined,
    end: number | undefined) {

    ensureKillAutoNextTimeout();
    _mediaOverlayActive = true;

    _mediaOverlayTextAudioPair = moTextAudioPair;
    _mediaOverlayTextId = undefined;

    if (moTextAudioPair.Text) {
        const i = moTextAudioPair.Text.lastIndexOf("#");
        if (i >= 0) {
            const id = moTextAudioPair.Text.substr(i + 1);
            if (id) {
                _mediaOverlayTextId = id;
                moHighlight(_mediaOverlayTextId);
            }
        }
    }

    if (!moTextAudioPair.Audio) {
        return; // TODO TTS
    }

    let publicationURL = win.READIUM2.publicationURL;
    if (publicationURL.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://")) {
        publicationURL = convertCustomSchemeToHttpUrl(publicationURL);
    }

    // const url = publicationURL + "/../" + moTextAudioPair.Audio;
    const urlObjFull = new URL(moTextAudioPair.Audio, publicationURL);
    const urlFull = urlObjFull.toString();

    const urlObjNoQuery = new URL(urlFull);
    urlObjNoQuery.hash = "";
    urlObjNoQuery.search = "";
    const urlNoQuery = urlObjNoQuery.toString();

    const hasBegin = typeof begin !== "undefined";
    const hasEnd = typeof end !== "undefined";

    // _previousAudioBegin = _currentAudioBegin;
    _previousAudioEnd = _currentAudioEnd;

    _currentAudioBegin = undefined;
    _currentAudioEnd = undefined;

    if (!hasBegin && !hasEnd) {
        if (urlObjFull.hash) {
            const matches = urlObjFull.hash.match(/t=([0-9\.]+)(,([0-9\.]+))?/);
            if (matches && matches.length >= 1) {
                const b = matches[1];
                try {
                    _currentAudioBegin = parseFloat(b);
                } catch (err) {
                    debug(err);
                }
                if (matches.length >= 3) {
                    const e = matches[3];
                    try {
                        _currentAudioEnd = parseFloat(e);
                    } catch (err) {
                        debug(err);
                    }
                }
            }
        }
    } else {
        // const mediaFragmentUrl = `${urlNoQuery}${`t=${hasBegin ? begin : ""}${hasEnd ? `,${end}` : ""}`}`;
        _currentAudioBegin = begin;
        _currentAudioEnd = end;
    }
    if (IS_DEV) {
        debug(`${urlFull} => [${_currentAudioBegin}-${_currentAudioEnd}]`);
    }

    const playClip = async (initial: boolean, contiguous: boolean) => {
        if (!_currentAudioElement) {
            return;
        }

        const timeToSeekTo = _currentAudioBegin ? _currentAudioBegin : 0;

        if (initial || _currentAudioElement.paused) {
            if ((initial && !timeToSeekTo) ||
                _currentAudioElement.currentTime === timeToSeekTo) {

                ensureOnTimeUpdate(false);
                await _currentAudioElement.play();

                // if (_mediaOverlaysListener) {
                //     _mediaOverlaysListener(MediaOverlaysStateEnum.PLAYING);
                // }
            } else {
                const ontimeupdateSeeked = async (ev: Event) => {
                    const currentAudioElement = ev.currentTarget as HTMLAudioElement;
                    currentAudioElement.removeEventListener("timeupdate", ontimeupdateSeeked);

                    ensureOnTimeUpdate(false);
                    if (_currentAudioElement) {
                        await _currentAudioElement.play();
                    }
                    // if (_mediaOverlaysListener) {
                    //     _mediaOverlaysListener(MediaOverlaysStateEnum.PLAYING);
                    // }
                };
                _currentAudioElement.addEventListener("timeupdate", ontimeupdateSeeked);
                _currentAudioElement.currentTime = timeToSeekTo;
            }
        } else {
            if (contiguous) {
                ensureOnTimeUpdate(false);
            } else {
                _currentAudioElement.currentTime = timeToSeekTo;
            }
        }
    };

    _previousAudioUrl = _currentAudioUrl;
    if (!_currentAudioUrl || urlNoQuery !== _currentAudioUrl) {
        _currentAudioUrl = urlNoQuery;
        if (IS_DEV) {
            debug("MO AUDIO RESET: " + _previousAudioUrl + " => " + _currentAudioUrl);
        }

        // _currentAudioElement = document.getElementById(AUDIO_MO_ID) as HTMLAudioElement;
        ensureOnTimeUpdate(true);
        if (_currentAudioElement) {
            _currentAudioElement.pause();
            _currentAudioElement.setAttribute("src", "");
            if (_currentAudioElement.parentNode) {
                _currentAudioElement.parentNode.removeChild(_currentAudioElement);
            }
        }
        _currentAudioElement = document.createElement("audio"); // no controls => should be invisible
        _currentAudioElement.setAttribute("style", "display: none");
        _currentAudioElement.setAttribute("id", AUDIO_MO_ID);
        // _currentAudioElement.setAttribute("loop", "loop");
        // _currentAudioElement.setAttribute("autoplay", "autoplay");
        _currentAudioElement.setAttribute("role", "media-overlays");
        document.body.appendChild(_currentAudioElement);

        _currentAudioElement.addEventListener("error", (ev) => {
            debug("-1) error: " + _currentAudioUrl + " -- "
            + (ev.currentTarget as HTMLAudioElement).src);

            if (_currentAudioElement && _currentAudioElement.error) {
                // 1 === MEDIA_ERR_ABORTED
                // 2 === MEDIA_ERR_NETWORK
                // 3 === MEDIA_ERR_DECODE
                // 4 === MEDIA_ERR_SRC_NOT_SUPPORTED
                debug(_currentAudioElement.error.code);
                debug(_currentAudioElement.error.message);
            }
        });

        if (IS_DEV) {
            _currentAudioElement.addEventListener("load", (ev) => {
                debug("0) load: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("loadstart", (ev) => {
                debug("1) loadstart: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("durationchange", (ev) => {
                debug("2) durationchange: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("loadedmetadata", (ev) => {
                debug("3) loadedmetadata: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("loadeddata", (ev) => {
                debug("4) loadeddata: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("progress", (ev) => {
                debug("5) progress: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("canplay", (ev) => {
                debug("6) canplay: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("canplaythrough", (ev) => {
                debug("7) canplaythrough: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("play", (ev) => {
                debug("8) play: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("pause", (ev) => {
                debug("9) pause: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("ended", (ev) => {
                debug("10) ended: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("seeked", (ev) => {
                debug("11) seeked: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            if (DEBUG_AUDIO) {
                _currentAudioElement.addEventListener("timeupdate", (ev) => {
                    debug("12) timeupdate: " + _currentAudioUrl + " -- "
                    + (ev.currentTarget as HTMLAudioElement).src);
                });
            }

            _currentAudioElement.addEventListener("seeking", (ev) => {
                debug("13) seeking: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("waiting", (ev) => {
                debug("14) waiting: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("volumechange", (ev) => {
                debug("15) volumechange: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("suspend", (ev) => {
                debug("16) suspend: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("stalled", (ev) => {
                debug("17) stalled: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("ratechange", (ev) => {
                debug("18) ratechange: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("playing", (ev) => {
                debug("19) playing: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("interruptend", (ev) => {
                debug("20) interruptend: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("interruptbegin", (ev) => {
                debug("21) interruptbegin: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("emptied", (ev) => {
                debug("22) emptied: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });

            _currentAudioElement.addEventListener("abort", (ev) => {
                debug("23) abort: " + _currentAudioUrl + " -- "
                + (ev.currentTarget as HTMLAudioElement).src);
            });
        }

        const oncanplaythrough = async (ev: Event) => {
            const currentAudioElement = ev.currentTarget as HTMLAudioElement;
            currentAudioElement.removeEventListener("canplaythrough", oncanplaythrough);
            debug("oncanplaythrough");
            await playClip(true, false);
        };
        _currentAudioElement.addEventListener("canplaythrough", oncanplaythrough);

        const onpause = async (_ev: Event) => {
            debug("onpause");
            if (_mediaOverlaysListener) {
                _mediaOverlaysListener(MediaOverlaysStateEnum.PAUSED);
            }
        };
        _currentAudioElement.addEventListener("pause", onpause);

        const onplay = async (_ev: Event) => {
            debug("onplay");
            if (_mediaOverlaysListener) {
                _mediaOverlaysListener(MediaOverlaysStateEnum.PLAYING);
            }
        };
        _currentAudioElement.addEventListener("play", onplay);

        _currentAudioElement.playbackRate = win.READIUM2.mediaOverlaysPlaybackRate;
        _currentAudioElement.setAttribute("src", _currentAudioUrl);
    } else {
        const contiguous = _previousAudioUrl === _currentAudioUrl &&
            typeof _previousAudioEnd !== "undefined" &&
            _previousAudioEnd > ((_currentAudioBegin ? _currentAudioBegin : 0) - 0.02) &&
            _previousAudioEnd <= (_currentAudioBegin ? _currentAudioBegin : 0);
        await playClip(false, contiguous);
    }
}

// https://www.w3.org/publishing/epub3/epub-mediaoverlays.html#sec-skippability
const _skippables = [
    "footnote",
    "endnote",
    "pagebreak",
    //
    "note",
    "rearnote",
    "sidebar",
    "practice",
    "marginalia",
    "annotation",
    "help",
    "table",
    "table-row",
    "table-cell",
    "list",
    "list-item",
];
function isSkippable(mo: MediaOverlayNode): boolean {
    return mo.Role && mo.Role.findIndex((r) => {
        return _skippables.includes(r);
    }) >= 0;
}

// https://www.w3.org/publishing/epub3/epub-mediaoverlays.html#sec-escabaility
// const _escapables = [
//     "table",
//     "table-row",
//     "table-cell",
//     "list",
//     "list-item",
//     "figure",
//     //
//     "footnote",
//     "endnote",
//     "note",
//     "rearnote",
//     "footnotes",
//     "rearnotes",
//     "sidebar",
//     "bibliography",
//     "toc",
//     "loi",
//     "appendix",
//     "landmarks",
//     "lot",
//     "index",
//     "colophon",
//     "epigraph",
//     "conclusion",
//     "afterword",
//     "warning",
//     "epilogue",
//     "foreword",
//     "introduction",
//     "prologue",
//     "preface",
//     "preamble",
//     "notice",
//     "errata",
//     "copyright-page",
//     "acknowledgments",
//     "other-credits",
//     "titlepage",
//     "imprimatur",
//     "contributors",
//     "halftitlepage",
//     "dedication",
//     "help",
//     "annotation",
//     "marginalia",
//     "practice",
//     "bridgehead",
//     "page-list",
//     "glossary",
// ];
// function isEscapable(mo: MediaOverlayNode): boolean {
//     return mo.Role && mo.Role.findIndex((r) => {
//         return _escapables.includes(r);
//     }) >= 0;
// }

function findNextTextAudioPair(
    mo: MediaOverlayNode,
    subMo: MediaOverlayNode,
    prevMo: MediaOverlayNode | undefined,
    escape: boolean): MediaOverlayNode | undefined {

    if (_mediaOverlaySkippabilityIsEnabled && isSkippable(mo)) {
        return undefined;
    }

    if (!mo.Children || !mo.Children.length) {
        if (mo.Text &&
            prevMo === subMo
            // && (!escape || !isEscapable(mo))
            ) {

            return mo;
        }
        return undefined;
    }
    let previous = prevMo;
    for (const child of mo.Children) {
        const match = findNextTextAudioPair(child, subMo, previous, escape);
        if (match) {
            return match;
        }
        previous = child;
    }
    return undefined;
}

function findPreviousTextAudioPair(
    mo: MediaOverlayNode,
    subMo: MediaOverlayNode,
    prevMo: MediaOverlayNode | undefined): MediaOverlayNode | undefined {

    if (_mediaOverlaySkippabilityIsEnabled && isSkippable(mo)) {
        return undefined;
    }

    if (!mo.Children || !mo.Children.length) {
        if (mo.Text &&
            prevMo &&
            mo === subMo
            ) {

            return prevMo;
        }
        return undefined;
    }
    let previous = prevMo;
    for (const child of mo.Children) {
        const match = findPreviousTextAudioPair(child, subMo, previous);
        if (match) {
            return match;
        }
        previous = child;
    }
    return undefined;
}

function findDepthFirstTextAudioPair(
    textHref: string,
    mo: MediaOverlayNode,
    textFragmentIDChain: Array<string | null> | undefined): MediaOverlayNode | undefined {

    if (!mo.Children || !mo.Children.length) {
        if (mo.Text &&
            (!_mediaOverlaySkippabilityIsEnabled || !isSkippable(mo))) {

            const hrefUrlObj = new URL("https://dummy.com/" + mo.Text);
            const toCompare = hrefUrlObj.pathname.substr(1);
            if (toCompare === textHref) {
                if (textFragmentIDChain) {
                    if (hrefUrlObj.hash) { // includes #
                        const id = hrefUrlObj.hash.substr(1);
                        for (const frag of textFragmentIDChain) {
                            if (frag === id) {
                                return mo;
                            }
                        }
                    }
                } else {
                    return mo;
                }
            }
        }
        return undefined;
    }
    for (const child of mo.Children) {
        const match = findDepthFirstTextAudioPair(textHref, child, textFragmentIDChain);
        if (match) {
            return match;
        }
    }
    return undefined;
}

function publicationHasMediaOverlays(publication: Publication) {
    if (publication.Spine) {
        const firstMoLink = publication.Spine.find((link) => {
            if (link.Properties?.MediaOverlay) {
                return true;
            }
            if (link.Alternate) {
                for (const altLink of link.Alternate) {
                    if (altLink.TypeLink === "application/vnd.syncnarr+json") {
                        return true;
                    }
                }
            }
            return false;
        });
        if (firstMoLink) {
            return true;
        }
    }
    return false;
}

let _timeoutAutoNext: number | undefined;
function ensureKillAutoNextTimeout() {
    if (_timeoutAutoNext) {
        clearTimeout(_timeoutAutoNext);
        _timeoutAutoNext = undefined;
    }
}
async function playMediaOverlaysForLink(link: Link, textFragmentIDChain: Array<string | null> | undefined) {
    if (IS_DEV) {
        debug(JSON.stringify(textFragmentIDChain, null, 4));
    }
    let moUrl: string | undefined;
    if (IS_DEV) {
        debug(link.MediaOverlays); // typically undefined, because serialized JSON not init'ed
    }
    if (link.Properties?.MediaOverlay) {
        moUrl = link.Properties.MediaOverlay;
        if (IS_DEV) {
            debug(link.Href);
            debug(link.HrefDecoded);
            debug(link.Properties.MediaOverlay);
            debug(link.Duration);
        }
    }
    if (link.Alternate) {
        for (const altLink of link.Alternate) {
            if (altLink.TypeLink === "application/vnd.syncnarr+json") {
                if (!moUrl) {
                    moUrl = altLink.Href; // HrefDecoded corrupts the query param! media-overlay.json?href=PATH
                }
                if (IS_DEV) {
                    debug(altLink.Href);
                    debug(altLink.HrefDecoded);
                    debug(altLink.TypeLink);
                    debug(altLink.Duration);
                }
            }
        }
    }
    if (!moUrl) {
        _timeoutAutoNext = window.setTimeout(() => {
            _timeoutAutoNext = undefined;

            mediaOverlaysStop(true);
            // metadata-level RTL
            const rtl = isRTL();
            navLeftOrRight(rtl, true);
        }, 2000);
        return;
    }
    if (!link.MediaOverlays || !link.MediaOverlays.initialized) {

        let publicationURL = win.READIUM2.publicationURL;
        if (publicationURL.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://")) {
            publicationURL = convertCustomSchemeToHttpUrl(publicationURL);
        }

        // const moUrlFull = publicationURL + "/../" + moUrl;
        const moUrlObjFull = new URL(moUrl, publicationURL);
        const moUrlFull = moUrlObjFull.toString();

        let response: Response;
        try {
            response = await fetch(moUrlFull);
        } catch (e) {
            debug(e);
            debug(moUrlFull);
            return;
        }
        if (!response.ok) {
            debug("BAD RESPONSE?!");
        }
        // response.headers.forEach((arg0: any, arg1: any) => {
        //     debug(arg0 + " => " + arg1);
        // });

        let moJson: any | undefined;
        try {
            moJson = await response.json();
        } catch (e) {
            debug(e);
        }
        if (!moJson) {
            return;
        }

        link.MediaOverlays = TaJsonDeserialize<MediaOverlayNode>(moJson, MediaOverlayNode);
        // link.MediaOverlays.SmilPathInZip = smilFilePath;
        link.MediaOverlays.initialized = true;

        debug(JSON.stringify(link.MediaOverlays, null, 4));
        debug(util.inspect(link.MediaOverlays,
            { showHidden: false, depth: 1000, colors: true, customInspect: true }));
    }
    if (!link.MediaOverlays || !link.MediaOverlays.initialized) {
        debug("Has MO but no Media Overlays?! " + link.Href);
        if (IS_DEV) {
            debug(JSON.stringify(win.READIUM2.publication, null, 4));
            debug(util.inspect(win.READIUM2.publication,
                { showHidden: false, depth: 1000, colors: true, customInspect: true }));
        }
        return;
    }

    const href = link.HrefDecoded || link.Href;
    const hrefUrlObj = new URL("https://dummy.com/" + href);
    // hrefUrlObj.hash = "";
    // hrefUrlObj.search = "";
    await playMediaOverlays(hrefUrlObj.pathname.substr(1), link.MediaOverlays, textFragmentIDChain);
}

export function mediaOverlaysHandleIpcMessage(
    eventChannel: string,
    eventArgs: any[],
    eventCurrentTarget: IReadiumElectronWebview): boolean {

    // win.READIUM2.getActiveWebView();
    const activeWebView = eventCurrentTarget;

    if (eventChannel === R2_EVENT_MEDIA_OVERLAY_CLICK) {
        // debug("R2_EVENT_MEDIA_OVERLAY_CLICK (webview.addEventListener('ipc-message')");
        if (publicationHasMediaOverlays(win.READIUM2.publication) &&
            (
            // win.READIUM2.mediaOverlaysClickEnabled &&
            _mediaOverlayRoot) || true) {
            // TODO: restrict to when MO was play-started at least once (so that rate/speed is set)

            setTimeout(async () => {
                const payload = eventArgs[0] as IEventPayload_R2_EVENT_MEDIA_OVERLAY_CLICK;
                if (activeWebView?.READIUM2.link) {
                    await playMediaOverlaysForLink(activeWebView.READIUM2.link, payload.textFragmentIDChain);
                }
            }, 0);
        }
    } else {
        return false;
    }
    return true;
}

function moHighlight(id: string | undefined) {
    const classActive = win.READIUM2.publication.Metadata?.MediaOverlay?.ActiveClass;
    const classActivePlayback =
        win.READIUM2.publication.Metadata?.MediaOverlay?.PlaybackActiveClass;
    const payload: IEventPayload_R2_EVENT_MEDIA_OVERLAY_HIGHLIGHT = {
        classActive: classActive ? classActive : undefined,
        classActivePlayback: classActivePlayback ? classActivePlayback : undefined,
        id,
    };
    const activeWebView = win.READIUM2.getActiveWebView();
    if (activeWebView) {
        setTimeout(async () => {
            await activeWebView.send(R2_EVENT_MEDIA_OVERLAY_HIGHLIGHT, payload);
        }, 0);
    }
}

export enum MediaOverlaysStateEnum {
    PAUSED = "PAUSED",
    PLAYING = "PLAYING",
    STOPPED = "STOPPED",
}
let _mediaOverlaysListener: ((mediaOverlaysState: MediaOverlaysStateEnum) => void) | undefined;
export function mediaOverlaysListen(mediaOverlaysListener: (mediaOverlaysState: MediaOverlaysStateEnum) => void) {
    _mediaOverlaysListener = mediaOverlaysListener;
}

export function mediaOverlaysPlay(speed: number) {
    if (!win.READIUM2 || !win.READIUM2.publication) {
        return;
    }

    win.READIUM2.mediaOverlaysPlaybackRate = speed;

    if (!_mediaOverlayRoot || !_mediaOverlayTextAudioPair) {
        setTimeout(async () => {
            const activeWebView = win.READIUM2.getActiveWebView();
            if (activeWebView?.READIUM2.link) {
                await playMediaOverlaysForLink(activeWebView.READIUM2.link, undefined);
            }
        }, 0);
    } else {
        mediaOverlaysResume();
    }
}

export function mediaOverlaysPause() {
    if (!win.READIUM2 || !win.READIUM2.publication) {
        return;
    }

    moHighlight(undefined);

    ensureOnTimeUpdate(true);
    if (_currentAudioElement) {
        _currentAudioElement.pause();
    }
}

export function mediaOverlaysStop(stayActive?: boolean) {
    if (!win.READIUM2 || !win.READIUM2.publication) {
        return;
    }

    _mediaOverlayActive = stayActive ? true : false;

    mediaOverlaysPause();

    _mediaOverlayRoot = undefined;
    _mediaOverlayTextAudioPair = undefined;
    _mediaOverlayTextId = undefined;

    setTimeout(async () => {
        if (_mediaOverlaysListener) {
            _mediaOverlaysListener(MediaOverlaysStateEnum.STOPPED);
        }
    }, 100);
}

export function mediaOverlaysResume() {
    if (!win.READIUM2 || !win.READIUM2.publication) {
        return;
    }

    if (_mediaOverlayRoot && _mediaOverlayTextAudioPair) {
        ensureOnTimeUpdate(false);
        if (_currentAudioElement) {
            setTimeout(async () => {
                if (_currentAudioElement) {
                    await _currentAudioElement.play();
                }
            }, 0);
        }
    } else {
        mediaOverlaysPlay(win.READIUM2.mediaOverlaysPlaybackRate);
    }
}

export function mediaOverlaysPrevious() {
    if (!win.READIUM2 || !win.READIUM2.publication) {
        return;
    }
    // (currentAudioElement as any).__ontimeupdate = false;
    // currentAudioElement.removeEventListener("timeupdate", ontimeupdate);
    ensureOnTimeUpdate(true);

    if (_mediaOverlayRoot && _mediaOverlayTextAudioPair) {
        const previousTextAudioPair =
            findPreviousTextAudioPair(_mediaOverlayRoot, _mediaOverlayTextAudioPair, undefined);
        if (!previousTextAudioPair) {
            mediaOverlaysStop(true);
            // metadata-level RTL
            const rtl = isRTL();
            navLeftOrRight(!rtl, true);
        } else {
            setTimeout(async () => {
                await playMediaOverlaysAudio(previousTextAudioPair, undefined, undefined);
            }, 0);
        }
    } else {
        mediaOverlaysPlay(win.READIUM2.mediaOverlaysPlaybackRate);
    }
}

export function mediaOverlaysNext(escape?: boolean) {
    if (!win.READIUM2 || !win.READIUM2.publication) {
        return;
    }
    // (currentAudioElement as any).__ontimeupdate = false;
    // currentAudioElement.removeEventListener("timeupdate", ontimeupdate);
    ensureOnTimeUpdate(true);

    if (_mediaOverlayRoot && _mediaOverlayTextAudioPair) {
        const nextTextAudioPair =
            findNextTextAudioPair(_mediaOverlayRoot, _mediaOverlayTextAudioPair, undefined, escape ? true : false);
        if (!nextTextAudioPair) {
            mediaOverlaysStop(true);
            // metadata-level RTL
            const rtl = isRTL();
            navLeftOrRight(rtl, true);
        } else {
            setTimeout(async () => {
                await playMediaOverlaysAudio(nextTextAudioPair, undefined, undefined);
            }, 0);
        }
    } else {
        mediaOverlaysPlay(win.READIUM2.mediaOverlaysPlaybackRate);
    }
}

export function mediaOverlaysEscape() {
    if (!win.READIUM2 || !win.READIUM2.publication) {
        return;
    }
    mediaOverlaysNext(true);
}

// export function mediaOverlaysClickEnable(doEnable: boolean) {
//     if (win.READIUM2) {
//         win.READIUM2.mediaOverlaysClickEnabled = doEnable;
//     }

//     const activeWebView = win.READIUM2.getActiveWebView();
//     if (!activeWebView) {
//         return;
//     }

//     const payload: IEventPayload_R2_EVENT_MEDIA_OVERLAYS_CLICK_ENABLE = {
//         doEnable,
//     };

//     setTimeout(async () => {
//         await activeWebView.send(R2_EVENT_MEDIA_OVERLAYS_CLICK_ENABLE, payload);
//     }, 0);
// }

export function mediaOverlaysPlaybackRate(speed: number) {
    if (!win.READIUM2 || !win.READIUM2.publication) {
        return;
    }

    win.READIUM2.mediaOverlaysPlaybackRate = speed;

    if (_currentAudioElement) {
        _currentAudioElement.playbackRate = speed;
    }
}

export function mediaOverlaysNotifyDocumentLoaded() {
    if (_mediaOverlayActive) { // implies publicationHasMediaOverlays()
        mediaOverlaysResume();
    }
}
