// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

// import { consoleRedirect } from "../common/console-redirect";
if (IS_DEV) {
    // tslint:disable-next-line:no-var-requires
    const cr = require("./common/console-redirect");
    // const releaseConsoleRedirect =
    cr.consoleRedirect("r2:navigator#electron/renderer/index", process.stdout, process.stderr, true);
}

import { URL } from "url";

import { Locator, LocatorLocations } from "@r2-shared-js/models/locator";
import { Publication } from "@r2-shared-js/models/publication";
import { Link } from "@r2-shared-js/models/publication-link";
import { encodeURIComponent_RFC3986 } from "@r2-utils-js/_utils/http/UrlUtils";
import { debounce } from "debounce";
import * as debug_ from "debug";
import { ipcRenderer, shell } from "electron";

import {
    IEventPayload_R2_EVENT_LINK,
    IEventPayload_R2_EVENT_LOCATOR_VISIBLE,
    IEventPayload_R2_EVENT_PAGE_TURN,
    IEventPayload_R2_EVENT_READING_LOCATION,
    IEventPayload_R2_EVENT_READING_LOCATION_PAGINATION_INFO,
    IEventPayload_R2_EVENT_READIUMCSS,
    IEventPayload_R2_EVENT_SCROLLTO,
    IEventPayload_R2_EVENT_WEBVIEW_READY,
    R2_EVENT_DEBUG_VISUALS,
    R2_EVENT_LINK,
    R2_EVENT_LOCATOR_VISIBLE,
    R2_EVENT_PAGE_TURN,
    R2_EVENT_PAGE_TURN_RES,
    R2_EVENT_READING_LOCATION,
    R2_EVENT_READIUMCSS,
    R2_EVENT_SCROLLTO,
    R2_EVENT_WEBVIEW_READY,
} from "../common/events";
import {
    R2_SESSION_WEBVIEW,
    READIUM2_ELECTRON_HTTP_PROTOCOL,
    convertCustomSchemeToHttpUrl,
    convertHttpUrlToCustomScheme,
} from "../common/sessions";
import {
    URL_PARAM_CSS,
    URL_PARAM_DEBUG_VISUALS,
    URL_PARAM_EPUBREADINGSYSTEM,
    URL_PARAM_GOTO,
    URL_PARAM_PREVIOUS,
} from "./common/url-params";
import { INameVersion } from "./webview/epubReadingSystem";
import { IElectronBrowserWindow, IElectronWebviewTag } from "./webview/state";

import URI = require("urijs");

// import { registerProtocol } from "@r2-navigator-js/electron/renderer/common/protocol";
// registerProtocol();

const ENABLE_WEBVIEW_RESIZE = true;

// const CLASS_POS_RIGHT = "r2_posRight";
// const CLASS_SHIFT_LEFT = "r2_shiftedLeft";
// const CLASS_ANIMATED = "r2_animated";

// export const DOM_EVENT_HIDE_VIEWPORT = "r2:hide-content-viewport";
// export const DOM_EVENT_SHOW_VIEWPORT = "r2:show-content-viewport";

const ELEMENT_ID_SLIDING_VIEWPORT = "r2_navigator_sliding_viewport";

const debug = debug_("r2:navigator#electron/renderer/index");

// const queryParams = getURLQueryParams();

// // tslint:disable-next-line:no-string-literal
// const publicationJsonUrl = queryParams["pub"];
// debug(publicationJsonUrl);
// const publicationJsonUrl_ = publicationJsonUrl.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL) ?
//     convertCustomSchemeToHttpUrl(publicationJsonUrl) : publicationJsonUrl;
// debug(publicationJsonUrl_);
// const pathBase64 = publicationJsonUrl_.replace(/.*\/pub\/(.*)\/manifest.json/, "$1");
// debug(pathBase64);
// const pathDecoded = new Buffer(decodeURIComponent(pathBase64), "base64").toString("utf8");
// debug(pathDecoded);
// const pathFileName = pathDecoded.substr(
//     pathDecoded.replace(/\\/g, "/").lastIndexOf("/") + 1,
//     pathDecoded.length - 1);
// debug(pathFileName);

// // tslint:disable-next-line:no-string-literal
// const lcpHint = queryParams["lcpHint"];

function isRTL(/* link: Link | undefined */): boolean {
    // if (link && link.Properties) {
    //     if (link.Properties.Direction === "rtl") {
    //         return true;
    //     }
    //     if (typeof link.Properties.Direction !== "undefined") {
    //         return false;
    //     }
    // }
    if (_publication &&
        _publication.Metadata &&
        _publication.Metadata.Direction) {
        return _publication.Metadata.Direction.toLowerCase() === "rtl"; //  any other value is LTR
    }
    return false;
}

function isFixedLayout(link: Link | undefined): boolean {
    if (link && link.Properties) {
        if (link.Properties.Layout === "fixed") {
            return true;
        }
        if (typeof link.Properties.Layout !== "undefined") {
            return false;
        }
    }
    if (_publication &&
        _publication.Metadata &&
        _publication.Metadata.Rendition) {
        return _publication.Metadata.Rendition.Layout === "fixed";
    }
    return false;
}

let _epubReadingSystemNameVersion: INameVersion = { name: "Readium2", version: "0.0.0" };
export function setEpubReadingSystemInfo(nv: INameVersion) {
    _epubReadingSystemNameVersion = nv;
}

export function __computeReadiumCssJsonMessage(link: Link | undefined): IEventPayload_R2_EVENT_READIUMCSS {

    if (isFixedLayout(link)) {
        return { setCSS: undefined, isFixedLayout: true };
    }

    if (!_computeReadiumCssJsonMessage) {
        return { setCSS: undefined, isFixedLayout: false };
    }

    const readiumCssJsonMessage = _computeReadiumCssJsonMessage();
    return readiumCssJsonMessage;
}
let _computeReadiumCssJsonMessage: () => IEventPayload_R2_EVENT_READIUMCSS = () => {
    return { setCSS: undefined, isFixedLayout: false };
};
export function setReadiumCssJsonGetter(func: () => IEventPayload_R2_EVENT_READIUMCSS) {
    _computeReadiumCssJsonMessage = func;
}

export interface LocatorExtended {
    locator: Locator;
    paginationInfo: IEventPayload_R2_EVENT_READING_LOCATION_PAGINATION_INFO | undefined;
}

let _lastSavedReadingLocation: LocatorExtended | undefined;
export function getCurrentReadingLocation(): LocatorExtended | undefined {
    return _lastSavedReadingLocation;
}
let _readingLocationSaver: ((locator: LocatorExtended) => void) | undefined;
const _saveReadingLocation = (docHref: string, locator: IEventPayload_R2_EVENT_READING_LOCATION) => {
    _lastSavedReadingLocation = {
        locator: {
            href: docHref,
            locations: {
                cfi: locator.cfi ? locator.cfi : undefined,
                cssSelector: locator.cssSelector ? locator.cssSelector : undefined,
                position: (typeof locator.position !== "undefined") ? locator.position : undefined,
                progression: (typeof locator.progression !== "undefined") ? locator.progression : undefined,
            },
        },
        paginationInfo: locator.paginationInfo,
    };
    if (_readingLocationSaver) {
        _readingLocationSaver(_lastSavedReadingLocation);
    }

    // // tslint:disable-next-line:no-floating-promises
    // (async () => {
    //     try {
    //         const visible = await isLocatorVisible(_lastSavedReadingLocation.locator);
    //         debug(`isLocatorVisible async: ${visible}`);
    //     } catch (err) {
    //         debug(err);
    //     }
    // })();
};
export function setReadingLocationSaver(func: (locator: LocatorExtended) => void) {
    _readingLocationSaver = func;
}

export function readiumCssOnOff() {

    if (_webview1) {
        const payload1 = __computeReadiumCssJsonMessage(_webview1.READIUM2.link);
        _webview1.send(R2_EVENT_READIUMCSS, payload1); // .getWebContents()
    }

    // if (_webview2) {
    //     const payload2 = __computeReadiumCssJsonMessage(_webview2.READIUM2.link);
    //     _webview2.send(R2_EVENT_READIUMCSS, payload2); // .getWebContents()
    // }
}

export async function isLocatorVisible(locator: Locator): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        if (!_webview1) {
            reject("No navigator webview?!");
            return;
        }
        if (!_webview1.READIUM2.link) {
            reject("No navigator webview link?!");
            return;
        }
        if (_webview1.READIUM2.link.Href !== locator.href) {
            debug(`isLocatorVisible FALSE: ${_webview1.READIUM2.link.Href} !== ${locator.href}`);
            resolve(false);
            return;
        }

        // const cb = (_event: any, payload: IEventPayload_R2_EVENT_LOCATOR_VISIBLE) => {
        //     debug("R2_EVENT_LOCATOR_VISIBLE");
        //     debug(payload.visible);
        // };
        // ipcRenderer.once(R2_EVENT_LOCATOR_VISIBLE, cb);

        const cb = (event: Electron.IpcMessageEvent) => {
            if (event.channel === R2_EVENT_LOCATOR_VISIBLE) {
                const webview = event.currentTarget as IElectronWebviewTag;
                // const activeWebView = getActiveWebView();
                if (webview !== _webview1) {
                    reject("Wrong navigator webview?!");
                    return;
                }
                const payload_ = event.args[0] as IEventPayload_R2_EVENT_LOCATOR_VISIBLE;
                debug(`isLocatorVisible: ${payload_.visible}`);
                _webview1.removeEventListener("ipc-message", cb);
                resolve(payload_.visible);
            }
        };
        _webview1.addEventListener("ipc-message", cb);
        const payload: IEventPayload_R2_EVENT_LOCATOR_VISIBLE = { location: locator.locations, visible: false };
        _webview1.send(R2_EVENT_LOCATOR_VISIBLE, payload);
    });
}

let _webview1: IElectronWebviewTag;
// let _webview2: IElectronWebviewTag;

let _publication: Publication | undefined;
let _publicationJsonUrl: string | undefined;

let _rootHtmlElement: Element | undefined;

export function handleLink(href: string, previous: boolean | undefined, useGoto: boolean) {

    const special = href.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://");
    if (special) {
        loadLink(href, previous, useGoto);
    } else {
        const okay = loadLink(href, previous, useGoto);
        if (!okay) {
            debug("EXTERNAL LINK:");
            debug(href);
            shell.openExternal(href);
        }
    }
}

export function handleLinkUrl(href: string) {
    handleLink(href, undefined, false);
}

export function handleLinkLocator(location: Locator | undefined) {

    // installNavigatorDOM() should have initiated the state
    if (!_publication || !_publicationJsonUrl) {
        return;
    }

    let linkToLoad: Link | undefined;
    let linkToLoadGoto: LocatorLocations | undefined;
    if (location && location.href) {
        if (_publication.Spine && _publication.Spine.length) {
            linkToLoad = _publication.Spine.find((spineLink) => {
                return spineLink.Href === location.href;
            });
            if (linkToLoad && location.locations) {
                linkToLoadGoto = location.locations;
            }
        }
        if (!linkToLoad &&
            _publication.Resources && _publication.Resources.length) {
            linkToLoad = _publication.Resources.find((resLink) => {
                return resLink.Href === location.href;
            });
            if (linkToLoad && location.locations) {
                linkToLoadGoto = location.locations;
            }
        }
    }
    if (!linkToLoad) {
        if (_publication.Spine && _publication.Spine.length) {
            const firstLinear = _publication.Spine[0];
            if (firstLinear) {
                linkToLoad = firstLinear;
            }
        }
    }

    if (linkToLoad) {
        const useGoto = typeof linkToLoadGoto !== "undefined"
            // && typeof linkToLoadGoto.cssSelector !== "undefined"
            ;
        const uri = new URL(linkToLoad.Href, _publicationJsonUrl);
        uri.hash = "";
        uri.search = "";
        const urlNoQueryParams = uri.toString(); // _publicationJsonUrl + "/../" + linkToLoad.Href;
        const hrefToLoad = urlNoQueryParams +
            ((useGoto) ? ("?" + URL_PARAM_GOTO + "=" +
                encodeURIComponent_RFC3986(new Buffer(JSON.stringify(linkToLoadGoto, null, "")).toString("base64"))) :
                "");
        handleLink(hrefToLoad, undefined, useGoto);
    }
}

export function installNavigatorDOM(
    publication: Publication,
    publicationJsonUrl: string,
    rootHtmlElementID: string,
    preloadScriptPath: string,
    location: Locator | undefined) {

    _publication = publication;
    _publicationJsonUrl = publicationJsonUrl;

    if (IS_DEV) {
        debug("|||||||||||||| installNavigatorDOM: ", JSON.stringify(location));

        const debugVisuals = (window.localStorage &&
            window.localStorage.getItem(URL_PARAM_DEBUG_VISUALS) === "true") ? true : false;
        debug("debugVisuals GET: ", debugVisuals);

        (window as IElectronBrowserWindow).READIUM2 = {
            DEBUG_VISUALS: debugVisuals,
            publication: _publication,
            publicationURL: _publicationJsonUrl,
        };

        (window as any).READIUM2.debug = (debugVisualz: boolean) => {
            debug("debugVisuals SET: ", debugVisualz);

            (window as IElectronBrowserWindow).READIUM2.DEBUG_VISUALS = debugVisualz;
            if (_webview1) {
                _webview1.send(R2_EVENT_DEBUG_VISUALS, debugVisualz ? "true" : "false"); // .getWebContents()
            }
            if (window.localStorage) {
                window.localStorage.setItem(URL_PARAM_DEBUG_VISUALS, debugVisualz ? "true" : "false");
            }
            setTimeout(() => {
                const loc = getCurrentReadingLocation();
                debug("|||||||||||||| getCurrentReadingLocation: ", JSON.stringify(loc));
                if (loc) {
                    handleLinkLocator(loc.locator);
                }
            }, 100);
        };
    }

    _rootHtmlElement = document.getElementById(rootHtmlElementID) as HTMLElement;
    if (!_rootHtmlElement) {
        debug("!rootHtmlElement ???");
        return;
    }

    const slidingViewport = document.createElement("div");
    slidingViewport.setAttribute("id", ELEMENT_ID_SLIDING_VIEWPORT);
    slidingViewport.setAttribute("style", "display: block; position: absolute; left: 0; width: 200%; " +
        "top: 0; bottom: 0; margin: 0; padding: 0; box-sizing: border-box; background: white; overflow: hidden;");

    _webview1 = createWebView(preloadScriptPath);
    _webview1.READIUM2 = {
        id: 1,
        link: undefined,
    };
    _webview1.setAttribute("id", "webview1");

    // _webview2 = createWebView(preloadScriptPath);
    // _webview2.READIUM2 = {
    //     id: 2,
    //     link: undefined,
    // };
    // _webview2.setAttribute("id", "webview2");

    slidingViewport.appendChild(_webview1 as Node);
    // slidingViewport.appendChild(_webview2 as Node);

    _rootHtmlElement.appendChild(slidingViewport);

    // if (isRTL()) {
    //     _webview1.classList.add(CLASS_POS_RIGHT);
    //     _webview1.style.left = "50%";
    // }
    // else {
    //     _webview2.classList.add(CLASS_POS_RIGHT);
    //     _webview2.style.left = "50%";
    // }

    setTimeout(() => {
        handleLinkLocator(location);
    }, 100);
}

export function navLeftOrRight(left: boolean) {
    if (!_publication) {
        return;
    }
    const activeWebView = getActiveWebView();
    const rtl = isRTL();
    const goPREVIOUS = left ? !rtl : rtl;
    const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
        direction: rtl ? "RTL" : "LTR",
        go: goPREVIOUS ? "PREVIOUS" : "NEXT",
    };
    activeWebView.send(R2_EVENT_PAGE_TURN, payload); // .getWebContents()
}

const getActiveWebView = (): IElectronWebviewTag => {

    return _webview1;

    // let activeWebView: IElectronWebviewTag;

    // const slidingViewport = document.getElementById(ELEMENT_ID_SLIDING_VIEWPORT) as HTMLElement;
    // if (slidingViewport.classList.contains(CLASS_SHIFT_LEFT)) {
    //     if (_webview1.classList.contains(CLASS_POS_RIGHT)) {
    //         activeWebView = _webview1;
    //     } else {
    //         activeWebView = _webview2;
    //     }
    // } else {
    //     if (_webview2.classList.contains(CLASS_POS_RIGHT)) {
    //         activeWebView = _webview1;
    //     } else {
    //         activeWebView = _webview2;
    //     }
    // }

    // return activeWebView;
};

function loadLink(hrefFull: string, previous: boolean | undefined, useGoto: boolean): boolean {

    if (!_publication || !_publicationJsonUrl) {
        return false;
    }

    if (hrefFull.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://")) {
        hrefFull = convertCustomSchemeToHttpUrl(hrefFull);
    }

    const pubJsonUri = _publicationJsonUrl.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://") ?
        convertCustomSchemeToHttpUrl(_publicationJsonUrl) : _publicationJsonUrl;

    let linkPath: string | undefined;

    const urlToLink = new URL(hrefFull);
    urlToLink.hash = "";
    urlToLink.search = "";
    const urlPublication = new URL(pubJsonUri);
    urlPublication.hash = "";
    urlPublication.search = "";
    let iBreak = -1;
    for (let i = 0; i < urlPublication.pathname.length; i++) {
        const c1 = urlPublication.pathname[i];
        if (i < urlToLink.pathname.length) {
            const c2 = urlToLink.pathname[i];
            if (c1 !== c2) {
                iBreak = i;
                break;
            }
        } else {
            break;
        }
    }
    if (iBreak > 0) {
        linkPath = urlToLink.pathname.substr(iBreak);
    }

    if (!linkPath) {
        return false;
    }

    // const pubUri = new URI(pubJsonUri);
    // // "/pub/BASE64_PATH/manifest.json" ==> "/pub/BASE64_PATH/"
    // const pathPrefix = decodeURIComponent(pubUri.path().replace("manifest.json", ""));
    // // "/pub/BASE64_PATH/epub/chapter.html" ==> "epub/chapter.html"
    // const normPath = decodeURIComponent(linkUri.normalizePath().path());
    // const linkPath = normPath.replace(pathPrefix, "");

    let pubLink = _publication.Spine ? _publication.Spine.find((spineLink) => {
        return spineLink.Href === linkPath;
    }) : undefined;
    if (!pubLink) {
        pubLink = _publication.Resources.find((spineLink) => {
            return spineLink.Href === linkPath;
        });
    }

    if (!pubLink) {
        debug("FATAL WEBVIEW READIUM2_LINK ??!! " + hrefFull + " ==> " + linkPath);
        return false;
    }

    const linkUri = new URI(hrefFull);
    linkUri.search((data: any) => {
        // overrides existing (leaves others intact)

        if (typeof previous === "undefined") {
            // erase unwanted forward of query param during linking
            data[URL_PARAM_PREVIOUS] = undefined;
            // delete data[URL_PARAM_PREVIOUS];
        } else {
            data[URL_PARAM_PREVIOUS] = previous ? "true" : "false";
        }

        if (!useGoto) {
            // erase unwanted forward of query param during linking
            data[URL_PARAM_GOTO] = undefined;
            // delete data[URL_PARAM_GOTO];
        }
    });
    if (useGoto) {
        linkUri.hash("").normalizeHash();
    }

    // no need for encodeURIComponent_RFC3986, auto-encoded by URI class

    const rcssJson = __computeReadiumCssJsonMessage(pubLink);
    const rcssJsonstr = JSON.stringify(rcssJson, null, "");
    const rcssJsonstrBase64 = new Buffer(rcssJsonstr).toString("base64");

    const rersJson = _epubReadingSystemNameVersion;
    const rersJsonstr = JSON.stringify(rersJson, null, "");
    const rersJsonstrBase64 = new Buffer(rersJsonstr).toString("base64");

    linkUri.search((data: any) => {
        // overrides existing (leaves others intact)

        // tslint:disable-next-line:no-string-literal
        data[URL_PARAM_CSS] = rcssJsonstrBase64;

        // tslint:disable-next-line:no-string-literal
        data[URL_PARAM_EPUBREADINGSYSTEM] = rersJsonstrBase64;

        // tslint:disable-next-line:no-string-literal
        data[URL_PARAM_DEBUG_VISUALS] = (IS_DEV && (window as IElectronBrowserWindow).READIUM2.DEBUG_VISUALS) ?
            "true" : "false";
    });

    const activeWebView = getActiveWebView();
    const wv1AlreadyLoaded = _webview1.READIUM2.link === pubLink;
    // const wv2AlreadyLoaded = _webview2.READIUM2.link === pubLink;
    if (wv1AlreadyLoaded
        // || wv2AlreadyLoaded
        ) {
        const goto = useGoto ? linkUri.search(true)[URL_PARAM_GOTO] as string : undefined;
        const hash = useGoto ? undefined : linkUri.fragment(); // without #

        debug("ALREADY LOADED: " + pubLink.Href);

        const webviewToReuse = _webview1;
        // const webviewToReuse = wv1AlreadyLoaded ? _webview1 : _webview2;
        // // const otherWebview = webviewToReuse === _webview2 ? _webview1 : _webview2;
        // if (webviewToReuse !== activeWebView) {

        //     debug("INTO VIEW ...");

        //     const slidingView = document.getElementById(ELEMENT_ID_SLIDING_VIEWPORT) as HTMLElement;
        //     if (slidingView) {
        //         let animate = true;
        //         if (goto || hash) {
        //             debug("DISABLE ANIM");
        //             animate = false;
        //         } else if (previous) {
        //             if (!slidingView.classList.contains(CLASS_SHIFT_LEFT)) {
        //                 debug("DISABLE ANIM");
        //                 animate = false;
        //             }
        //         }
        //         if (animate) {
        //             if (!slidingView.classList.contains(CLASS_ANIMATED)) {
        //                 slidingView.classList.add(CLASS_ANIMATED);
        //                 slidingView.style.transition = "left 500ms ease-in-out";
        //             }
        //         } else {
        //             if (slidingView.classList.contains(CLASS_ANIMATED)) {
        //                 slidingView.classList.remove(CLASS_ANIMATED);
        //                 slidingView.style.transition = "none";
        //             }
        //         }
        //         if (slidingView.classList.contains(CLASS_SHIFT_LEFT)) {
        //             slidingView.classList.remove(CLASS_SHIFT_LEFT);
        //             slidingView.style.left = "0";

        //             // if (_webview1.classList.contains(CLASS_POS_RIGHT)) {
        //             //     // activeWebView === _webview1;
        //             // } else {
        //             //     // activeWebView === _webview2;
        //             // }
        //         } else {
        //             slidingView.classList.add(CLASS_SHIFT_LEFT);
        //             slidingView.style.left = "-100%";

        //             // if (_webview2.classList.contains(CLASS_POS_RIGHT)) {
        //             //     // activeWebView === _webview1;
        //             // } else {
        //             //     // activeWebView === _webview2;
        //             // }
        //         }
        //     }
        // }

        // const msgJson = {
        //     goto: ,
        //     hash: ,
        //     previous,
        // };

        const payload: IEventPayload_R2_EVENT_SCROLLTO = {
            goto,
            hash,
            previous: previous ? true : false,
        };

        if (IS_DEV) {
            const msgStr = JSON.stringify(payload);
            debug(msgStr);
        }

        webviewToReuse.send(R2_EVENT_SCROLLTO, payload); // .getWebContents()

        return true;
    }

    // if (!isFixedLayout(pubLink)) {
    //     if (_rootHtmlElement) {
    //         _rootHtmlElement.dispatchEvent(new Event(DOM_EVENT_HIDE_VIEWPORT));
    //     }
    // }

    const uriStr = linkUri.toString();

    if (IS_DEV) {
        debug("####### >>> ---");
        debug(activeWebView.READIUM2.id);
        debug(pubLink.Href);
        debug(uriStr);
        debug(linkUri.hash()); // with #
        debug(linkUri.fragment()); // without #
        // tslint:disable-next-line:no-string-literal
        const gto = linkUri.search(true)[URL_PARAM_GOTO];
        debug(gto ? (new Buffer(gto, "base64").toString("utf8")) : ""); // decodeURIComponent
        // tslint:disable-next-line:no-string-literal
        debug(linkUri.search(true)[URL_PARAM_PREVIOUS]);
        // tslint:disable-next-line:no-string-literal
        debug(linkUri.search(true)[URL_PARAM_CSS]);
        debug("####### >>> ---");
    }

    activeWebView.READIUM2.link = pubLink;

    const needConvert = _publicationJsonUrl.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://");
    const uriStr_ = uriStr.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://") ?
        uriStr : (needConvert ? convertHttpUrlToCustomScheme(uriStr) : uriStr);
    if (IS_DEV) {
        debug("setAttribute SRC:");
        debug(uriStr_);
    }
    activeWebView.setAttribute("src", uriStr_);
    // activeWebView.getWebContents().loadURL(uriStr_, { extraHeaders: "pragma: no-cache\n" });
    // activeWebView.loadURL(uriStr_, { extraHeaders: "pragma: no-cache\n" });

    // ALWAYS FALSE => let's comment for now...
    // const enableOffScreenRenderPreload = false;
    // if (enableOffScreenRenderPreload) {
    //     setTimeout(() => {
    //         if (!_publication || !pubLink) {
    //             return;
    //         }

    //         const otherWebview = activeWebView === _webview2 ? _webview1 : _webview2;

    //         // let inSpine = true;
    //         const index = _publication.Spine.indexOf(pubLink);
    //         // if (!index) {
    //         //     inSpine = false;
    //         //     index = _publication.Resources.indexOf(pubLink);
    //         // }
    //         if (index >= 0 &&
    //             previous && (index - 1) >= 0 ||
    //             !previous && (index + 1) < _publication.Spine.length
    //             // (index + 1) < (inSpine ? _publication.Spine.length : _publication.Resources.length)
    //         ) {
    //             const nextPubLink = _publication.Spine[previous ? (index - 1) : (index + 1)];
    //             // (inSpine ? _publication.Spine[index + 1] : _publication.Resources[index + 1]);

    //             if (otherWebview.READIUM2.link !== nextPubLink) {
    //                 const linkUriNext = new URI(_publicationJsonUrl + "/../" + nextPubLink.Href);
    //                 linkUriNext.normalizePath();
    //                 linkUriNext.search((data: any) => {
    //                     // overrides existing (leaves others intact)

    //                     // tslint:disable-next-line:no-string-literal
    //                     data[URL_PARAM_CSS] = rcssJsonstrBase64;
    //                 });
    //                 const uriStrNext = linkUriNext.toString();

    //                 debug("####### ======");
    //                 debug(otherWebview.READIUM2.id);
    //                 debug(nextPubLink.Href);
    //                 debug(linkUriNext.hash()); // with #
    //                 debug(linkUriNext.fragment()); // without #
    //                 // tslint:disable-next-line:no-string-literal
    //                 debug(linkUriNext.search(true)[URL_PARAM_GOTO]);
    //                 // tslint:disable-next-line:no-string-literal
    //                 debug(linkUriNext.search(true)[URL_PARAM_PREVIOUS]);
    //                 debug("####### ======");
    //                 otherWebview.READIUM2.link = nextPubLink;
    //                 otherWebview.setAttribute("src", uriStrNext);
    //             }
    //         }
    //     }, 300);
    // }

    return true;
}

function createWebView(preloadScriptPath: string): IElectronWebviewTag {

    // Unfortunately the Chromium web inspector crashes when closing preload :(
    // Also, the debugger fails to open the sourcemaps (maybe related issue?)
    // process.stderr.write("\n####\n" + preloadScriptPath + "\n####\n");
    // TODO: what are the critical features needed from Node context
    // that justify using webview.preload? Can we instead use regular DOM code?
    // The ReadiumCSS injection is now streamer-based (best performance / timing)
    // and we can use postMessage instead of Electron IPC.
    // Also, preload really does most of its processing once DOM-ready.
    // Perhaps the main problem would be exposing the internal logic of navigator
    // into EPUB content documents? (preload is good for isolating app code)

    const wv = document.createElement("webview");
    // tslint:disable-next-line:max-line-length
    // https://github.com/electron/electron/blob/master/docs/tutorial/security.md#3-enable-context-isolation-for-remote-content
    wv.setAttribute("webpreferences",
        "nodeIntegration=0, nodeIntegrationInWorker=0, sandbox=0, javascript=1, " +
        "contextIsolation=0, webSecurity=1, allowRunningInsecureContent=0");
    wv.setAttribute("partition", R2_SESSION_WEBVIEW);
    if (_publicationJsonUrl) {
        // const ref = _publicationJsonUrl.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://") ?
        //     _publicationJsonUrl : convertHttpUrlToCustomScheme(_publicationJsonUrl);
        wv.setAttribute("httpreferrer", _publicationJsonUrl);
    }
    wv.setAttribute("style", "display: flex; margin: 0; padding: 0; box-sizing: border-box; " +
        "position: absolute; left: 0; width: 50%; bottom: 0; top: 0;");
    wv.setAttribute("preload", preloadScriptPath); // "file://"

    // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#webview
    if (ENABLE_WEBVIEW_RESIZE) {
        wv.setAttribute("disableguestresize", "");
    }

    setTimeout(() => {
        wv.removeAttribute("tabindex");
    }, 500);

    wv.addEventListener("dom-ready", () => {
        // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#webcontents
        // wc.openDevTools({ mode: "detach" });
        wv.clearHistory();
    });

    wv.addEventListener("ipc-message", (event: Electron.IpcMessageEvent) => {
        const webview = event.currentTarget as IElectronWebviewTag;
        const activeWebView = getActiveWebView();
        if (webview !== activeWebView) {
            return;
        }

        if (event.channel === R2_EVENT_LINK) {
            debug("R2_EVENT_LINK (webview.addEventListener('ipc-message')");
            const payload = event.args[0] as IEventPayload_R2_EVENT_LINK;
            handleLinkUrl(payload.url);
        } else if (event.channel === R2_EVENT_WEBVIEW_READY) {
            const payload = event.args[0] as IEventPayload_R2_EVENT_WEBVIEW_READY;
            debug("WEBVIEW READY: " + payload.href);

            // if (_rootHtmlElement) {
            //     _rootHtmlElement.dispatchEvent(new Event(DOM_EVENT_SHOW_VIEWPORT));
            // }
        } else if (event.channel === R2_EVENT_READING_LOCATION) {
            const payload = event.args[0] as IEventPayload_R2_EVENT_READING_LOCATION;
            if (webview.READIUM2.link && _saveReadingLocation) {
                // TODO: position metrics, based on arbitrary number of characters (1034)
                // https://github.com/readium/architecture/tree/master/positions
                // https://github.com/readium/architecture/tree/master/locators#about-the-notion-of-position
                // https://github.com/readium/architecture/blob/master/locators/locator-api.md
                // if (typeof payload.progression !== "undefined" && _publication && webview.READIUM2.link) {
                //     const totalPositions = _publication.getTotalPositions(webview.READIUM2.link);
                //     if (totalPositions) {
                //         payload.position = totalPositions * payload.progression;
                //         const totalSpinePositions = _publication.getTotalSpinePositions();
                //         if (totalSpinePositions) {
                //             payload.globalProgression = payload.position / totalSpinePositions;
                //         }
                //     }
                // }
                _saveReadingLocation(webview.READIUM2.link.Href, payload);
            }
        } else if (event.channel === R2_EVENT_PAGE_TURN_RES) {
            if (!_publication) {
                return;
            }

            const payload = event.args[0] as IEventPayload_R2_EVENT_PAGE_TURN;

            const goPREVIOUS = payload.go === "PREVIOUS"; // any other value is NEXT

            if (!webview.READIUM2.link) {
                debug("WEBVIEW READIUM2_LINK ??!!");
                return;
            }

            let nextOrPreviousSpineItem: Link | undefined;
            if (_publication.Spine) {
                for (let i = 0; i < _publication.Spine.length; i++) {
                    if (_publication.Spine[i] === webview.READIUM2.link) {
                        if (goPREVIOUS && (i - 1) >= 0) {
                            nextOrPreviousSpineItem = _publication.Spine[i - 1];
                        } else if (!goPREVIOUS && (i + 1) < _publication.Spine.length) {
                            nextOrPreviousSpineItem = _publication.Spine[i + 1];
                        }
                        break;
                    }
                }
            }
            if (!nextOrPreviousSpineItem) {
                return;
            }
            if (_publicationJsonUrl) {
                const uri = new URL(nextOrPreviousSpineItem.Href, _publicationJsonUrl);
                uri.hash = "";
                uri.search = "";
                const urlNoQueryParams = uri.toString(); // _publicationJsonUrl + "/../" + nextOrPreviousSpineItem.Href;
                handleLink(urlNoQueryParams, goPREVIOUS, false);
            }
        } else {
            debug("webview1 ipc-message");
            debug(event.channel);
        }
    });

    return wv as IElectronWebviewTag;
}
if (ENABLE_WEBVIEW_RESIZE) {
    // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#webcontents
    // https://github.com/electron/electron/blob/v3.0.0/docs/api/breaking-changes.md#webview
    // wv.setAttribute("disableguestresize", "");
    const adjustResize = (webview: IElectronWebviewTag) => {
        // https://javascript.info/size-and-scroll
        // offsetW/H: excludes margin, includes border, scrollbar, padding.
        // clientW/H: excludes margin, border, scrollbar, includes padding.
        // scrollW/H: like client, but includes hidden (overflow) areas
        const width = webview.clientWidth;
        const height = webview.clientHeight;
        const wc = webview.getWebContents();
        if (wc && (wc as any).setSize && width && height) {
            (wc as any).setSize({ // wc is WebContents, works in Electron < 3.0
                normal: {
                    height,
                    width,
                },
            });
        }
    };
    const onResizeDebounced = debounce(() => {
        adjustResize(_webview1);
        // adjustResize(_webview2);

        // setTimeout(() => {
        //     if (_rootHtmlElement) {
        //         _rootHtmlElement.dispatchEvent(new Event(DOM_EVENT_SHOW_VIEWPORT));
        //     }
        // }, 1000);
    }, 200);
    window.addEventListener("resize", () => {
        // if (!isFixedLayout(_webview1.READIUM2.link)) {
        //     if (_rootHtmlElement) {
        //         _rootHtmlElement.dispatchEvent(new Event(DOM_EVENT_HIDE_VIEWPORT));
        //     }
        // }
        onResizeDebounced();
    });
}

// see webview.addEventListener("ipc-message", ...)
// needed for main process browserWindow.webContents.send()
ipcRenderer.on(R2_EVENT_LINK, (_event: any, payload: IEventPayload_R2_EVENT_LINK) => {
    debug("R2_EVENT_LINK (ipcRenderer.on)");
    debug(payload.url);
    handleLinkUrl(payload.url);
});
