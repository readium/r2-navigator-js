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
import { Link } from "@r2-shared-js/models/publication-link";

import { DEBUG_AUDIO } from "../common/audiobook";
import {
    IEventPayload_R2_EVENT_MEDIA_OVERLAY_CLICK, IEventPayload_R2_EVENT_MEDIA_OVERLAY_HIGHLIGHT,
    R2_EVENT_MEDIA_OVERLAY_CLICK, R2_EVENT_MEDIA_OVERLAY_HIGHLIGHT,
} from "../common/events";
import { READIUM2_ELECTRON_HTTP_PROTOCOL, convertCustomSchemeToHttpUrl } from "../common/sessions";
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
            _mediaOverlayTextAudioPair = moTextAudioPair;
            await playMediaOverlaysAudio(moTextAudioPair, undefined, undefined);
        }
    } else {
        debug("!moTextAudioPair " + textHref);
    }
}

async function playMediaOverlaysAudio(
    moTextAudioPair: MediaOverlayNode,
    begin: number | undefined,
    end: number | undefined) {

    if (moTextAudioPair.Text) {
        const i = moTextAudioPair.Text.lastIndexOf("#");
        if (i >= 0) {
            const id = moTextAudioPair.Text.substr(i + 1);
            if (id) {
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
                    await activeWebView.send(R2_EVENT_MEDIA_OVERLAY_HIGHLIGHT, payload);
                }
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

    const ontimeupdate = async (ev: Event) => {
        const currentAudioElement = ev.currentTarget as HTMLAudioElement;
        if (_currentAudioEnd && currentAudioElement.currentTime >= (_currentAudioEnd - 0.05)) {

            (currentAudioElement as any).__ontimeupdate = false;
            currentAudioElement.removeEventListener("timeupdate", ontimeupdate);

            if (_mediaOverlayRoot && _mediaOverlayTextAudioPair) {
                const nextTextAudioPair =
                    findNextTextAudioPair(_mediaOverlayRoot, _mediaOverlayTextAudioPair, undefined);
                if (!nextTextAudioPair) {
                    currentAudioElement.pause();

                    const classActive = win.READIUM2.publication.Metadata?.MediaOverlay?.ActiveClass;
                    const classActivePlayback =
                        win.READIUM2.publication.Metadata?.MediaOverlay?.PlaybackActiveClass;
                    const payload: IEventPayload_R2_EVENT_MEDIA_OVERLAY_HIGHLIGHT = {
                        classActive: classActive ? classActive : undefined,
                        classActivePlayback: classActivePlayback ? classActivePlayback : undefined,
                        id: undefined,
                    };
                    const activeWebView = win.READIUM2.getActiveWebView();
                    if (activeWebView) {
                        await activeWebView.send(R2_EVENT_MEDIA_OVERLAY_HIGHLIGHT, payload);
                    }
                } else {
                    _mediaOverlayTextAudioPair = nextTextAudioPair;
                    await playMediaOverlaysAudio(nextTextAudioPair, undefined, undefined);
                }
            }
        }
    };
    const ensureOnTimeUpdate = () => {
        if (_currentAudioElement && !(_currentAudioElement as any).__ontimeupdate) {
            (_currentAudioElement as any).__ontimeupdate = true;
            _currentAudioElement.addEventListener("timeupdate", ontimeupdate);
        }
    };

    const playClip = async (initial: boolean, contiguous: boolean) => {
        if (!_currentAudioElement) {
            return;
        }

        const timeToSeekTo = _currentAudioBegin ? _currentAudioBegin : 0;

        if (initial || _currentAudioElement.paused) {
            if ((initial && !timeToSeekTo) ||
                _currentAudioElement.currentTime === timeToSeekTo) {

                ensureOnTimeUpdate();
                await _currentAudioElement.play();
            } else {
                const ontimeupdateSeeked = async (ev: Event) => {
                    const currentAudioElement = ev.currentTarget as HTMLAudioElement;
                    currentAudioElement.removeEventListener("timeupdate", ontimeupdateSeeked);

                    ensureOnTimeUpdate();
                    if (_currentAudioElement) {
                        await _currentAudioElement.play();
                    }
                };
                _currentAudioElement.addEventListener("timeupdate", ontimeupdateSeeked);
                _currentAudioElement.currentTime = timeToSeekTo;
            }
        } else {
            if (contiguous) {
                ensureOnTimeUpdate();
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
        if (_currentAudioElement) {
            if ((_currentAudioElement as any).__ontimeupdate) {
                (_currentAudioElement as any).__ontimeupdate = false;
                _currentAudioElement.removeEventListener("timeupdate", ontimeupdate);
            }

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
        _currentAudioElement.setAttribute("src", _currentAudioUrl);
    } else {
        const contiguous = _previousAudioUrl === _currentAudioUrl &&
            typeof _previousAudioEnd !== "undefined" &&
            _previousAudioEnd > ((_currentAudioBegin ? _currentAudioBegin : 0) - 0.02) &&
            _previousAudioEnd <= (_currentAudioBegin ? _currentAudioBegin : 0);
        await playClip(false, contiguous);
    }
}

function findNextTextAudioPair(
    mo: MediaOverlayNode,
    subMo: MediaOverlayNode,
    prevMo: MediaOverlayNode | undefined): MediaOverlayNode | undefined {

    if (!mo.Children || !mo.Children.length) {
        if (prevMo === subMo) {
            return mo;
        }
        return undefined;
    }
    let previous = prevMo;
    for (const child of mo.Children) {
        const match = findNextTextAudioPair(child, subMo, previous);
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
        if (mo.Text) {
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

// win.READIUM2.ttsClickEnabled
// win.READIUM2.ttsPlaybackRate

export function mediaOverlaysHandleIpcMessage(
    eventChannel: string,
    eventArgs: any[],
    eventCurrentTarget: IReadiumElectronWebview): boolean {

    // win.READIUM2.getActiveWebView();
    const activeWebView = eventCurrentTarget;

    if (eventChannel === R2_EVENT_MEDIA_OVERLAY_CLICK) {
        // debug("R2_EVENT_MEDIA_OVERLAY_CLICK (webview.addEventListener('ipc-message')");
        setTimeout(async () => {
            const payload = eventArgs[0] as IEventPayload_R2_EVENT_MEDIA_OVERLAY_CLICK;
            if (activeWebView?.READIUM2.link) {
                await playMediaOverlaysForLink(activeWebView.READIUM2.link, payload.textFragmentIDChain);
            }
        }, 0);
    } else {
        return false;
    }
    return true;
}
