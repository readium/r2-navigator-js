// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import debounce = require("debounce");
import URI = require("urijs");

import { Publication } from "@models/publication";
import { Link } from "@models/publication-link";
import { encodeURIComponent_RFC3986 } from "@utils/http/UrlUtils";

import { ipcRenderer, shell } from "electron";

import {
    IEventPayload_R2_EVENT_LINK,
    IEventPayload_R2_EVENT_PAGE_TURN,
    IEventPayload_R2_EVENT_READING_LOCATION,
    IEventPayload_R2_EVENT_READIUMCSS,
    IEventPayload_R2_EVENT_SCROLLTO,
    IEventPayload_R2_EVENT_WEBVIEW_READY,
    R2_EVENT_LINK,
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
import { URL_PARAM_GOTO, URL_PARAM_PREVIOUS } from "./common/url-params";
import { IElectronWebviewTag } from "./webview/state";

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

export const DOM_EVENT_HIDE_VIEWPORT = "r2:hide-content-viewport";
export const DOM_EVENT_SHOW_VIEWPORT = "r2:show-content-viewport";

const ELEMENT_ID_SLIDING_VIEWPORT = "r2_navigator_sliding_viewport";

// const queryParams = getURLQueryParams();

// // tslint:disable-next-line:no-string-literal
// const publicationJsonUrl = queryParams["pub"];
// console.log(publicationJsonUrl);
// const publicationJsonUrl_ = publicationJsonUrl.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL) ?
//     convertCustomSchemeToHttpUrl(publicationJsonUrl) : publicationJsonUrl;
// console.log(publicationJsonUrl_);
// const pathBase64 = publicationJsonUrl_.replace(/.*\/pub\/(.*)\/manifest.json/, "$1");
// console.log(pathBase64);
// const pathDecoded = window.atob(pathBase64);
// console.log(pathDecoded);
// const pathFileName = pathDecoded.substr(
//     pathDecoded.replace(/\\/g, "/").lastIndexOf("/") + 1,
//     pathDecoded.length - 1);
// console.log(pathFileName);

// // tslint:disable-next-line:no-string-literal
// const lcpHint = queryParams["lcpHint"];

function isFixedLayout(link: Link | undefined): boolean {
    if (link && link.Properties) {
        if (link.Properties.Layout === "fixed") {
            return true;
        }
        if (typeof link.Properties.Layout !== "undefined") {
            return false;
        }
    }
    const isFXL = _publication &&
        _publication.Metadata &&
        _publication.Metadata.Rendition &&
        _publication.Metadata.Rendition.Layout === "fixed";
    return isFXL as boolean;
}

function __computeReadiumCssJsonMessage(link: Link | undefined): IEventPayload_R2_EVENT_READIUMCSS {

    if (isFixedLayout(link)) {
        return { injectCSS: "rollback", setCSS: "rollback", isFixedLayout: true };
    }

    if (!_computeReadiumCssJsonMessage) {
        return { injectCSS: "rollback", setCSS: "rollback", isFixedLayout: false };
    }

    const readiumCssJsonMessage = _computeReadiumCssJsonMessage();
    return readiumCssJsonMessage;
}
let _computeReadiumCssJsonMessage: () => IEventPayload_R2_EVENT_READIUMCSS = () => {
    return { injectCSS: "rollback", setCSS: "rollback", isFixedLayout: false };
};
export function setReadiumCssJsonGetter(func: () => IEventPayload_R2_EVENT_READIUMCSS) {
    _computeReadiumCssJsonMessage = func;
}

let _saveReadingLocation: (docHref: string, cssSelector: string) => void = (_docHref: string, _cssSelector: string) => {
    return;
};
export function setReadingLocationSaver(func: (docHref: string, cssSelector: string) => void) {
    _saveReadingLocation = func;
}

export function readiumCssOnOff() {

    if (_webview1) {
        const payload1 = __computeReadiumCssJsonMessage(_webview1.READIUM2.link);
        _webview1.send(R2_EVENT_READIUMCSS, payload1); // .getWebContents()
    }

    if (_webview2) {
        const payload2 = __computeReadiumCssJsonMessage(_webview2.READIUM2.link);
        _webview2.send(R2_EVENT_READIUMCSS, payload2); // .getWebContents()
    }
}

let _webview1: IElectronWebviewTag;
let _webview2: IElectronWebviewTag;

let _publication: Publication | undefined;
let _publicationJsonUrl: string | undefined;

let _rootHtmlElement: Element | undefined;

export function handleLink(href: string, previous: boolean | undefined, useGoto: boolean) {

    let okay = href.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://");
    if (!okay && _publicationJsonUrl) {
        const prefix = _publicationJsonUrl.replace("manifest.json", "");
        okay = decodeURIComponent(href).startsWith(decodeURIComponent(prefix));
    }
    if (okay) {
        loadLink(href, previous, useGoto);
    } else {
        console.log("EXTERNAL LINK:");
        console.log(href);
        shell.openExternal(href);
    }
}

export function installNavigatorDOM(
    publication: Publication,
    publicationJsonUrl: string,
    rootHtmlElementID: string,
    preloadScriptPath: string,
    pubDocHrefToLoad: string | undefined,
    pubDocSelectorToGoto: string | undefined) {

    _publication = publication;
    _publicationJsonUrl = publicationJsonUrl;

    if (IS_DEV) {
        // quick debugging from the console
        (window as any).READIUM2_PUB = _publication;
        (window as any).READIUM2_PUBURL = _publicationJsonUrl;
    }

    _rootHtmlElement = document.getElementById(rootHtmlElementID) as HTMLElement;
    if (!_rootHtmlElement) {
        console.log("!rootHtmlElement ???");
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

    _webview2 = createWebView(preloadScriptPath);
    _webview2.READIUM2 = {
        id: 2,
        link: undefined,
    };
    _webview2.setAttribute("id", "webview2");

    slidingViewport.appendChild(_webview1 as Node);
    slidingViewport.appendChild(_webview2 as Node);

    _rootHtmlElement.appendChild(slidingViewport);

    const isRTL = _publication.Metadata &&
        _publication.Metadata.Direction &&
        _publication.Metadata.Direction.toLowerCase() === "rtl"; //  any other value is LTR
    if (isRTL) {
        _webview1.classList.add("posRight");
        _webview1.style.left = "50%";
    } else {
        _webview2.classList.add("posRight");
        _webview2.style.left = "50%";
    }

    let linkToLoad: Link | undefined;
    let linkToLoadGoto: string | undefined;
    if (pubDocHrefToLoad) {
        if (_publication.Spine && _publication.Spine.length) {
            linkToLoad = _publication.Spine.find((spineLink) => {
                return spineLink.Href === pubDocHrefToLoad;
            });
            if (linkToLoad && pubDocSelectorToGoto) {
                linkToLoadGoto = pubDocSelectorToGoto;
            }
        }
        if (!linkToLoad &&
            _publication.Resources && _publication.Resources.length) {
            linkToLoad = _publication.Resources.find((resLink) => {
                return resLink.Href === pubDocHrefToLoad;
            });
            if (linkToLoad && pubDocSelectorToGoto) {
                linkToLoadGoto = pubDocSelectorToGoto;
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

    setTimeout(() => {
        if (linkToLoad) {
            const hrefToLoad = _publicationJsonUrl + "/../" + linkToLoad.Href +
                (linkToLoadGoto ? ("?" + URL_PARAM_GOTO + "=" + encodeURIComponent_RFC3986(linkToLoadGoto)) : "");
            handleLink(hrefToLoad, undefined, true);
        }
    }, 100);
}

export function navLeftOrRight(left: boolean) {
    if (!_publication) {
        return;
    }
    const activeWebView = getActiveWebView();
    const isRTL = _publication.Metadata &&
        _publication.Metadata.Direction &&
        _publication.Metadata.Direction.toLowerCase() === "rtl"; //  any other value is LTR
    const goPREVIOUS = left ? !isRTL : isRTL;
    const payload: IEventPayload_R2_EVENT_PAGE_TURN = {
        direction: isRTL ? "RTL" : "LTR",
        go: goPREVIOUS ? "PREVIOUS" : "NEXT",
    };
    activeWebView.send(R2_EVENT_PAGE_TURN, payload); // .getWebContents()
}

const getActiveWebView = (): IElectronWebviewTag => {

    let activeWebView: IElectronWebviewTag;

    const slidingViewport = document.getElementById(ELEMENT_ID_SLIDING_VIEWPORT) as HTMLElement;
    if (slidingViewport.classList.contains("shiftedLeft")) {
        if (_webview1.classList.contains("posRight")) {
            activeWebView = _webview1;
        } else {
            activeWebView = _webview2;
        }
    } else {
        if (_webview2.classList.contains("posRight")) {
            activeWebView = _webview1;
        } else {
            activeWebView = _webview2;
        }
    }

    return activeWebView;
};

function loadLink(hrefFull: string, previous: boolean | undefined, useGoto: boolean) {

    if (!_publication || !_publicationJsonUrl) {
        return;
    }

    if (hrefFull.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://")) {
        hrefFull = convertCustomSchemeToHttpUrl(hrefFull);
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

    const pubJsonUri = _publicationJsonUrl.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://") ?
        convertCustomSchemeToHttpUrl(_publicationJsonUrl) : _publicationJsonUrl;
    const pubUri = new URI(pubJsonUri);

    // "/pub/BASE64_PATH/manifest.json" ==> "/pub/BASE64_PATH/"
    const pathPrefix = decodeURIComponent(pubUri.path().replace("manifest.json", ""));

    // "/pub/BASE64_PATH/epub/chapter.html" ==> "epub/chapter.html"
    const normPath = decodeURIComponent(linkUri.normalizePath().path());
    const linkPath = normPath.replace(pathPrefix, "");

    let pubLink = _publication.Spine.find((spineLink) => {
        return spineLink.Href === linkPath;
    });
    if (!pubLink) {
        pubLink = _publication.Resources.find((spineLink) => {
            return spineLink.Href === linkPath;
        });
    }

    if (!pubLink) {
        console.log("FATAL WEBVIEW READIUM2_LINK ??!! " + hrefFull + " ==> " + linkPath);
        return;
    }

    const rcssJson = __computeReadiumCssJsonMessage(pubLink);
    const rcssJsonstr = JSON.stringify(rcssJson, null, "");
    // const str = window.atob(base64);
    const rcssJsonstrBase64 = window.btoa(rcssJsonstr);

    linkUri.search((data: any) => {
        // overrides existing (leaves others intact)

        data.readiumcss = rcssJsonstrBase64;
    });

    const activeWebView = getActiveWebView();
    const wv1AlreadyLoaded = _webview1.READIUM2.link === pubLink;
    const wv2AlreadyLoaded = _webview2.READIUM2.link === pubLink;
    if (wv1AlreadyLoaded || wv2AlreadyLoaded) {
        const goto = useGoto ? linkUri.search(true)[URL_PARAM_GOTO] as string : undefined;
        const hash = useGoto ? undefined : linkUri.fragment();

        console.log("ALREADY LOADED: " + pubLink.Href);

        const webviewToReuse = wv1AlreadyLoaded ? _webview1 : _webview2;
        // const otherWebview = webviewToReuse === _webview2 ? _webview1 : _webview2;
        if (webviewToReuse !== activeWebView) {

            console.log("INTO VIEW ...");

            const slidingView = document.getElementById(ELEMENT_ID_SLIDING_VIEWPORT) as HTMLElement;
            if (slidingView) {
                let animate = true;
                if (goto || hash) {
                    console.log("DISABLE ANIM");
                    animate = false;
                } else if (previous) {
                    if (!slidingView.classList.contains("shiftedLeft")) {
                        console.log("DISABLE ANIM");
                        animate = false;
                    }
                }
                if (animate) {
                    if (!slidingView.classList.contains("animated")) {
                        slidingView.classList.add("animated");
                        slidingView.style.transition = "left 500ms ease-in-out";
                    }
                } else {
                    if (slidingView.classList.contains("animated")) {
                        slidingView.classList.remove("animated");
                        slidingView.style.transition = "none";
                    }
                }
                if (slidingView.classList.contains("shiftedLeft")) {
                    slidingView.classList.remove("shiftedLeft");
                    slidingView.style.left = "0";

                    // if (_webview1.classList.contains("posRight")) {
                    //     // activeWebView === _webview1;
                    // } else {
                    //     // activeWebView === _webview2;
                    // }
                } else {
                    slidingView.classList.add("shiftedLeft");
                    slidingView.style.left = "-100%";

                    // if (_webview2.classList.contains("posRight")) {
                    //     // activeWebView === _webview1;
                    // } else {
                    //     // activeWebView === _webview2;
                    // }
                }
            }
        }

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

        const msgStr = JSON.stringify(payload);
        console.log(msgStr);

        webviewToReuse.send(R2_EVENT_SCROLLTO, payload); // .getWebContents()

        return;
    }

    if (!isFixedLayout(pubLink)) {
        if (_rootHtmlElement) {
            _rootHtmlElement.dispatchEvent(new Event(DOM_EVENT_HIDE_VIEWPORT));
        }
    }

    const uriStr = linkUri.toString();
    console.log("####### >>> ---");
    console.log(activeWebView.READIUM2.id);
    console.log(pubLink.Href);
    console.log(linkUri.hash());
    // tslint:disable-next-line:no-string-literal
    console.log(linkUri.search(true)[URL_PARAM_GOTO]);
    // tslint:disable-next-line:no-string-literal
    console.log(linkUri.search(true)[URL_PARAM_PREVIOUS]);
    console.log("####### >>> ---");
    activeWebView.READIUM2.link = pubLink;

    const needConvert = _publicationJsonUrl.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://");
    const uriStr_ = uriStr.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL + "://") ?
        uriStr : (needConvert ? convertHttpUrlToCustomScheme(uriStr) : uriStr);
    console.log("setAttribute SRC:");
    console.log(uriStr_);
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
    //                     data.readiumcss = rcssJsonstrBase64;
    //                 });
    //                 const uriStrNext = linkUriNext.toString();

    //                 console.log("####### ======");
    //                 console.log(otherWebview.READIUM2.id);
    //                 console.log(nextPubLink.Href);
    //                 console.log(linkUriNext.hash());
    //                 // tslint:disable-next-line:no-string-literal
    //                 console.log(linkUriNext.search(true)[URL_PARAM_GOTO]);
    //                 // tslint:disable-next-line:no-string-literal
    //                 console.log(linkUriNext.search(true)[URL_PARAM_PREVIOUS]);
    //                 console.log("####### ======");
    //                 otherWebview.READIUM2.link = nextPubLink;
    //                 otherWebview.setAttribute("src", uriStrNext);
    //             }
    //         }
    //     }, 300);
    // }
}

function createWebView(preloadScriptPath: string): IElectronWebviewTag {
    const wv = document.createElement("webview");
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
    wv.setAttribute("preload", preloadScriptPath);
    wv.setAttribute("disableguestresize", "");
    setTimeout(() => {
        wv.removeAttribute("tabindex");
    }, 500);

    wv.addEventListener("dom-ready", () => {
        // wv.openDevTools();
        wv.clearHistory();
    });

    wv.addEventListener("ipc-message", (event: Electron.IpcMessageEvent) => {
        const webview = event.currentTarget as IElectronWebviewTag;
        const activeWebView = getActiveWebView();
        if (webview !== activeWebView) {
            return;
        }

        if (event.channel === R2_EVENT_LINK) {
            const payload = event.args[0] as IEventPayload_R2_EVENT_LINK;
            handleLink(payload.url, undefined, false);
        } else if (event.channel === R2_EVENT_WEBVIEW_READY) {
            const payload = event.args[0] as IEventPayload_R2_EVENT_WEBVIEW_READY;
            console.log("WEBVIEW READY: " + payload.href);

            if (_rootHtmlElement) {
                _rootHtmlElement.dispatchEvent(new Event(DOM_EVENT_SHOW_VIEWPORT));
            }
        } else if (event.channel === R2_EVENT_READING_LOCATION) {
            const payload = event.args[0] as IEventPayload_R2_EVENT_READING_LOCATION;
            if (webview.READIUM2.link && _saveReadingLocation) {
                _saveReadingLocation(webview.READIUM2.link.Href, payload.cssSelector);
            }
        } else if (event.channel === R2_EVENT_PAGE_TURN_RES) {
            if (!_publication) {
                return;
            }
            // const isRTL = _publication.Metadata &&
            // _publication.Metadata.Direction &&
            // _publication.Metadata.Direction.toLowerCase() === "rtl"; //  any other value is LTR

            const payload = event.args[0] as IEventPayload_R2_EVENT_PAGE_TURN;

            // const isRTL = messageJson.direction === "RTL"; //  any other value is LTR
            const goPREVIOUS = payload.go === "PREVIOUS"; // any other value is NEXT

            if (!webview.READIUM2.link) {
                console.log("WEBVIEW READIUM2_LINK ??!!");
                return;
            }

            let nextOrPreviousSpineItem: Link | undefined;
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
            if (!nextOrPreviousSpineItem) {
                return;
            }
            if (_publicationJsonUrl) {
                const linkHref = _publicationJsonUrl + "/../" + nextOrPreviousSpineItem.Href;
                handleLink(linkHref, goPREVIOUS, false);
            }
        } else {
            console.log("webview1 ipc-message");
            console.log(event.channel);
        }
    });

    return wv as IElectronWebviewTag;
}

const adjustResize = (webview: IElectronWebviewTag) => {
    const width = webview.clientWidth;
    const height = webview.clientHeight;
    const wc = webview.getWebContents();
    if (wc && width && height) {
        wc.setSize({
            normal: {
                height,
                width,
            },
        });
    }
};

const onResizeDebounced = debounce(() => {
    adjustResize(_webview1);
    adjustResize(_webview2);

    setTimeout(() => {
        if (_rootHtmlElement) {
            _rootHtmlElement.dispatchEvent(new Event(DOM_EVENT_SHOW_VIEWPORT));
        }
    }, 1000);
}, 200);

window.addEventListener("resize", () => {
    if (!isFixedLayout(_webview1.READIUM2.link)) {
        if (_rootHtmlElement) {
            _rootHtmlElement.dispatchEvent(new Event(DOM_EVENT_HIDE_VIEWPORT));
        }
    }
    onResizeDebounced();
});

ipcRenderer.on(R2_EVENT_LINK, (_event: any, payload: IEventPayload_R2_EVENT_LINK) => {
    console.log("R2_EVENT_LINK");
    console.log(payload.url);
    handleLink(payload.url, undefined, false);
});
