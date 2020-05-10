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
    IEventPayload_R2_EVENT_MEDIA_OVERLAY_CLICK, R2_EVENT_MEDIA_OVERLAY_CLICK,
} from "../common/events";
import { READIUM2_ELECTRON_HTTP_PROTOCOL, convertCustomSchemeToHttpUrl } from "../common/sessions";
import { IReadiumElectronBrowserWindow, IReadiumElectronWebview } from "./webview/state";

const debug = debug_("r2:navigator#electron/renderer/location");

const IS_DEV = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev";

const win = window as IReadiumElectronBrowserWindow;

const AUDIO_MO_ID = "R2_AUDIO_MO_ID";

// URL without t=begin,end media fragment! (pure audio reference)
let _currentAudioUrl: string | undefined;

let _currentAudioBegin: number | undefined;
let _currentAudioEnd: number | undefined;

let _currentAudioElement: HTMLAudioElement | undefined;

function playMediaOverlaysAudio(urlPath: string, begin: number | undefined, end: number | undefined) {

    let publicationURL = win.READIUM2.publicationURL;
    if (publicationURL.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://")) {
        publicationURL = convertCustomSchemeToHttpUrl(publicationURL);
    }

    // const url = publicationURL + "/../" + urlPath;
    const urlObjFull = new URL(urlPath, publicationURL);
    const urlFull = urlObjFull.toString();

    const urlObjNoQuery = new URL(urlFull);
    urlObjNoQuery.hash = "";
    urlObjNoQuery.search = "";
    const urlNoQuery = urlObjNoQuery.toString();

    if (!_currentAudioUrl || urlNoQuery !== _currentAudioUrl) {
        _currentAudioUrl = urlNoQuery;

        if (IS_DEV) {
            debug("MO AUDIO RESET: " + _currentAudioUrl + " => " + urlNoQuery);
        }

        // _currentAudioElement = document.getElementById(AUDIO_MO_ID) as HTMLAudioElement;
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

        _currentAudioElement.addEventListener("error", () => {
            debug("-1) error: " + _currentAudioUrl);
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
            _currentAudioElement.addEventListener("load", () => {
                debug("0) load: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("loadstart", () => {
                debug("1) loadstart: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("durationchange", () => {
                debug("2) durationchange: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("loadedmetadata", () => {
                debug("3) loadedmetadata: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("loadeddata", () => {
                debug("4) loadeddata: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("progress", () => {
                debug("5) progress: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("canplay", () => {
                debug("6) canplay: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("canplaythrough", () => {
                debug("7) canplaythrough: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("play", () => {
                debug("8) play: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("pause", () => {
                debug("9) pause: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("ended", () => {
                debug("10) ended: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("seeked", () => {
                debug("11) seeked: " + _currentAudioUrl);
            });

            if (DEBUG_AUDIO) {
                _currentAudioElement.addEventListener("timeupdate", () => {
                    debug("12) timeupdate: " + _currentAudioUrl);
                });
            }

            _currentAudioElement.addEventListener("seeking", () => {
                debug("13) seeking: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("waiting", () => {
                debug("14) waiting: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("volumechange", () => {
                debug("15) volumechange: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("suspend", () => {
                debug("16) suspend: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("stalled", () => {
                debug("17) stalled: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("ratechange", () => {
                debug("18) ratechange: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("playing", () => {
                debug("19) playing: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("interruptend", () => {
                debug("20) interruptend: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("interruptbegin", () => {
                debug("21) interruptbegin: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("emptied", () => {
                debug("22) emptied: " + _currentAudioUrl);
            });

            _currentAudioElement.addEventListener("abort", () => {
                debug("23) abort: " + _currentAudioUrl);
            });
        }
    }

    const hasBegin = typeof begin !== "undefined";
    const hasEnd = typeof end !== "undefined";

    let mediaFragmentUrl = urlFull;
    if (!hasBegin && !hasEnd) {
        mediaFragmentUrl = urlFull;
        // urlObjFull.searchParams.get("t")
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
        mediaFragmentUrl = `${urlNoQuery}${`t=${hasBegin ? begin : ""}${hasEnd ? `,${end}` : ""}`}`;
        _currentAudioBegin = begin;
        _currentAudioEnd = end;
    }
    if (IS_DEV) {
        debug(`${_currentAudioUrl} => [${_currentAudioBegin}-${_currentAudioEnd}] (${mediaFragmentUrl})`);
    }
    if (_currentAudioElement) {
        _currentAudioElement.setAttribute("src", mediaFragmentUrl);

        const initialPlay = async (ev: Event) => {
            const currentAudioElement = ev.currentTarget as HTMLAudioElement;
            currentAudioElement.removeEventListener("canplaythrough", initialPlay);
            await currentAudioElement.play();
        };
        _currentAudioElement.addEventListener("canplaythrough", initialPlay);
    }
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

function playMediaOverlays(
    textHref: string,
    rootMo: MediaOverlayNode,
    textFragmentIDChain: Array<string | null> | undefined) {

    let moTextAudioPair = findDepthFirstTextAudioPair(textHref, rootMo, textFragmentIDChain);
    if (!moTextAudioPair && textFragmentIDChain) {
        moTextAudioPair = findDepthFirstTextAudioPair(textHref, rootMo, undefined);
    }
    if (moTextAudioPair) {
        if (moTextAudioPair.Audio) {
            playMediaOverlaysAudio(moTextAudioPair.Audio, undefined, undefined);
        }
    } else {
        debug("!moTextAudioPair " + textHref);
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
    playMediaOverlays(hrefUrlObj.pathname.substr(1), link.MediaOverlays, textFragmentIDChain);
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
