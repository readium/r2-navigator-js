import debounce = require("debounce");
import URI = require("urijs");

import { Publication } from "@models/publication";
import { Link } from "@models/publication-link";
import { encodeURIComponent_RFC3986 } from "@utils/http/UrlUtils";
import { shell } from "electron";
import { ipcRenderer } from "electron";

import {
    R2_EVENT_LINK,
    R2_EVENT_PAGE_TURN,
    R2_EVENT_PAGE_TURN_RES,
    R2_EVENT_READING_LOCATION,
    R2_EVENT_READIUMCSS,
    R2_EVENT_SCROLLTO,
    R2_EVENT_WEBVIEW_READY,
} from "../common/events";
import { R2_SESSION_WEBVIEW } from "../common/sessions";

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

// const queryParams = getURLQueryParams();

// // tslint:disable-next-line:no-string-literal
// const publicationJsonUrl = queryParams["pub"];

// const pathBase64 = publicationJsonUrl.replace(/.*\/pub\/(.*)\/manifest.json/, "$1");

// const pathDecoded = window.atob(pathBase64);

// const pathFileName = pathDecoded.substr(
//     pathDecoded.replace(/\\/g, "/").lastIndexOf("/") + 1,
//     pathDecoded.length - 1);

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

function __computeReadiumCssJsonMessage(link: Link): string {

    if (isFixedLayout(link)) {
        const jsonMsg = { injectCSS: "rollback", setCSS: "rollback", isFixedLayout: true };
        return JSON.stringify(jsonMsg, null, 0);
    }

    if (!_computeReadiumCssJsonMessage) {
        return "{}";
    }
    const readiumCssJsonMessage = _computeReadiumCssJsonMessage();
    return readiumCssJsonMessage;
}

let _computeReadiumCssJsonMessage: () => string = () => {
    return "{}";
};
export function setReadiumCssJsonGetter(func: () => string) {
    _computeReadiumCssJsonMessage = func;
}

let _saveReadingLocation: (docHref: string, cssSelector: string) => void = (_docHref: string, _cssSelector: string) => {
    return;
};
export function setReadingLocationSaver(func: (docHref: string, cssSelector: string) => void) {
    _saveReadingLocation = func;
}

export function readiumCssOnOff() {
    const readiumCssJsonMessage1 = __computeReadiumCssJsonMessage((_webview1 as any).READIUM2_LINK);
    (_webview1 as any).send(R2_EVENT_READIUMCSS, readiumCssJsonMessage1); // .getWebContents()

    const readiumCssJsonMessage2 = __computeReadiumCssJsonMessage((_webview2 as any).READIUM2_LINK);
    (_webview2 as any).send(R2_EVENT_READIUMCSS, readiumCssJsonMessage2); // .getWebContents()
}

let _webview1: Electron.WebviewTag;
let _webview2: Electron.WebviewTag;

let _viewHideInterval: NodeJS.Timer | undefined;

let _publication: Publication | undefined;
let _publicationJsonUrl: string | undefined;

export function handleLink(href: string, previous: boolean | undefined, useGoto: boolean) {
    if (!_publicationJsonUrl) {
        return;
    }

    const prefix = _publicationJsonUrl.replace("manifest.json", "");
    if (href.startsWith(prefix)) {
        loadLink(href, previous, useGoto);
    } else {
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

    const rootHtmlElement = document.getElementById(rootHtmlElementID) as HTMLElement;
    if (!rootHtmlElement) {
        console.log("!rootHtmlElement ???");
        return;
    }

    const slidingViewport = document.createElement("div");
    slidingViewport.setAttribute("id", "r2_navigator_sliding_viewport");
    slidingViewport.setAttribute("style", "display: block; position: absolute; left: 0; width: 200%; " +
        "top: 0; bottom: 0; margin: 0; padding: 0; box-sizing: border-box; background: white; overflow: hidden;");

    _webview1 = createWebView(preloadScriptPath);
    (_webview1 as any).readiumwebviewid = 1;
    _webview1.setAttribute("id", "webview1");

    _webview2 = createWebView(preloadScriptPath);
    (_webview2 as any).readiumwebviewid = 2;
    _webview2.setAttribute("id", "webview2");

    slidingViewport.appendChild(_webview1 as Node);
    slidingViewport.appendChild(_webview2 as Node);

    rootHtmlElement.appendChild(slidingViewport);

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
                (linkToLoadGoto ? ("?readiumgoto=" + encodeURIComponent_RFC3986(linkToLoadGoto)) : "");
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
    const messageJson = {
        direction: isRTL ? "RTL" : "LTR",
        go: goPREVIOUS ? "PREVIOUS" : "NEXT",
    };
    const messageStr = JSON.stringify(messageJson);
    (activeWebView as any).send(R2_EVENT_PAGE_TURN, messageStr); // .getWebContents()
}

const getActiveWebView = (): Electron.WebviewTag => {

    let activeWebView: Electron.WebviewTag;

    const slidingViewport = document.getElementById("r2_navigator_sliding_viewport") as HTMLElement;
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

    const linkUri = new URI(hrefFull);
    linkUri.search((data: any) => {
        // overrides existing (leaves others intact)

        if (typeof previous === "undefined") {
            // erase unwanted forward of query param during linking
            data.readiumprevious = undefined;
            // delete data.readiumprevious;
        } else {
            data.readiumprevious = previous ? "true" : "false";
        }

        if (!useGoto) {
            // erase unwanted forward of query param during linking
            data.readiumgoto = undefined;
            // delete data.readiumgoto;
        }
    });
    if (useGoto) {
        linkUri.hash("").normalizeHash();
    }

    const pubUri = new URI(_publicationJsonUrl);

    // "/pub/BASE64_PATH/manifest.json" ==> "/pub/BASE64_PATH/"
    const pathPrefix = pubUri.path().replace("manifest.json", "");

    // "/pub/BASE64_PATH/epub/chapter.html" ==> "epub/chapter.html"
    const linkPath = decodeURIComponent(linkUri.normalizePath().path().replace(pathPrefix, ""));

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

    const rcssJsonstr = __computeReadiumCssJsonMessage(pubLink);
    // const str = window.atob(base64);
    const rcssJsonstrBase64 = window.btoa(rcssJsonstr);

    linkUri.search((data: any) => {
        // overrides existing (leaves others intact)

        data.readiumcss = rcssJsonstrBase64;
    });

    const activeWebView = getActiveWebView();
    const wv1AlreadyLoaded = (_webview1 as any).READIUM2_LINK === pubLink;
    const wv2AlreadyLoaded = (_webview2 as any).READIUM2_LINK === pubLink;
    if (wv1AlreadyLoaded || wv2AlreadyLoaded) {
        const msgJson = {
            goto: useGoto ? linkUri.search("readiumgoto") : undefined,
            hash: useGoto ? undefined : linkUri.fragment(),
            previous,
        };
        const msgStr = JSON.stringify(msgJson);

        console.log("ALREADY LOADED: " + pubLink.Href);
        console.log(msgStr);

        const webviewToReuse = wv1AlreadyLoaded ? _webview1 : _webview2;
        // const otherWebview = webviewToReuse === _webview2 ? _webview1 : _webview2;
        if (webviewToReuse !== activeWebView) {

            console.log("INTO VIEW ...");

            const slidingView = document.getElementById("r2_navigator_sliding_viewport") as HTMLElement;
            if (slidingView) {
                let animate = true;
                if (msgJson.goto || msgJson.hash) {
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

        (webviewToReuse as any).send(R2_EVENT_SCROLLTO, msgStr); // .getWebContents()

        return;
    }

    if (!isFixedLayout(pubLink)) {
        const hidePanel = document.getElementById("r2_navigator_reader_chrome_HIDE") as HTMLElement;
        if (hidePanel) {
            hidePanel.style.display = "block";
            _viewHideInterval = setInterval(() => {
                unhideWebView(true);
            }, 5000);
        }
    }

    const uriStr = linkUri.toString();
    console.log("####### >>> ---");
    console.log((activeWebView as any).readiumwebviewid);
    console.log(pubLink.Href);
    console.log(linkUri.hash());
    // tslint:disable-next-line:no-string-literal
    console.log(linkUri.search(true)["readiumgoto"]);
    // tslint:disable-next-line:no-string-literal
    console.log(linkUri.search(true)["readiumprevious"]);
    console.log("####### >>> ---");
    (activeWebView as any).READIUM2_LINK = pubLink;
    activeWebView.setAttribute("src", uriStr);
    // wv.getWebContents().loadURL(uriStr, { extraHeaders: "pragma: no-cache\n" });
    // wv.loadURL(uriStr, { extraHeaders: "pragma: no-cache\n" });

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

    //             if ((otherWebview as any).READIUM2_LINK !== nextPubLink) {
    //                 const linkUriNext = new URI(_publicationJsonUrl + "/../" + nextPubLink.Href);
    //                 linkUriNext.normalizePath();
    //                 linkUriNext.search((data: any) => {
    //                     // overrides existing (leaves others intact)
    //                     data.readiumcss = rcssJsonstrBase64;
    //                 });
    //                 const uriStrNext = linkUriNext.toString();

    //                 console.log("####### ======");
    //                 console.log((otherWebview as any).readiumwebviewid);
    //                 console.log(nextPubLink.Href);
    //                 console.log(linkUriNext.hash());
    //                 // tslint:disable-next-line:no-string-literal
    //                 console.log(linkUriNext.search(true)["readiumgoto"]);
    //                 // tslint:disable-next-line:no-string-literal
    //                 console.log(linkUriNext.search(true)["readiumprevious"]);
    //                 console.log("####### ======");
    //                 (otherWebview as any).READIUM2_LINK = nextPubLink;
    //                 otherWebview.setAttribute("src", uriStrNext);
    //             }
    //         }
    //     }, 300);
    // }
}

function createWebView(preloadScriptPath: string): Electron.WebviewTag {
    const wv = document.createElement("webview");
    wv.setAttribute("webpreferences",
        "nodeIntegration=0, nodeIntegrationInWorker=0, sandbox=0, javascript=1, " +
        "contextIsolation=0, webSecurity=1, allowRunningInsecureContent=0");
    wv.setAttribute("partition", R2_SESSION_WEBVIEW);
    if (_publicationJsonUrl) {
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
        (wv as any).clearHistory();
    });

    wv.addEventListener("ipc-message", (event: Electron.IpcMessageEvent) => {
        const webview = event.currentTarget as Electron.WebviewTag;
        const activeWebView = getActiveWebView();
        if (webview !== activeWebView) {
            return;
        }

        if (event.channel === R2_EVENT_LINK) {
            handleLink(event.args[0], undefined, false);
        } else if (event.channel === R2_EVENT_WEBVIEW_READY) {
            // const id = event.args[0];
            unhideWebView(false);
        } else if (event.channel === R2_EVENT_READING_LOCATION) {
            const cssSelector = event.args[0];
            if ((webview as any).READIUM2_LINK && _saveReadingLocation) {
                _saveReadingLocation((webview as any).READIUM2_LINK.Href, cssSelector);
            }
        } else if (event.channel === R2_EVENT_PAGE_TURN_RES) {
            if (!_publication) {
                return;
            }
            // const isRTL = _publication.Metadata &&
            // _publication.Metadata.Direction &&
            // _publication.Metadata.Direction.toLowerCase() === "rtl"; //  any other value is LTR

            const messageString = event.args[0];
            const messageJson = JSON.parse(messageString);
            // const isRTL = messageJson.direction === "RTL"; //  any other value is LTR
            const goPREVIOUS = messageJson.go === "PREVIOUS"; // any other value is NEXT

            if (!(webview as any).READIUM2_LINK) {
                console.log("WEBVIEW READIUM2_LINK ??!!");
                return;
            }

            let nextOrPreviousSpineItem: Link | undefined;
            for (let i = 0; i < _publication.Spine.length; i++) {
                if (_publication.Spine[i] === (webview as any).READIUM2_LINK) {
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

    return wv;
}

const adjustResize = (webview: Electron.WebviewTag) => {
    const width = webview.clientWidth;
    const height = webview.clientHeight;
    const wc = (webview as any).getWebContents();
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
        unhideWebView(false);
    }, 1000);
}, 200);

window.addEventListener("resize", () => {
    if (!isFixedLayout((_webview1 as any).READIUM2_LINK)) {
        const hidePanel = document.getElementById("r2_navigator_reader_chrome_HIDE") as HTMLElement;
        if (hidePanel && hidePanel.style.display !== "block") {
            hidePanel.style.display = "block";
            _viewHideInterval = setInterval(() => {
                unhideWebView(true);
            }, 5000);
        }
    }
    onResizeDebounced();
});

ipcRenderer.on(R2_EVENT_LINK, (_event: any, href: string) => {
    console.log("R2_EVENT_LINK");
    console.log(href);
    handleLink(href, undefined, false);
});

const unhideWebView = (forced: boolean) => {
    if (_viewHideInterval) {
        clearInterval(_viewHideInterval);
        _viewHideInterval = undefined;
    }
    const hidePanel = document.getElementById("r2_navigator_reader_chrome_HIDE") as HTMLElement;
    if (!hidePanel || hidePanel.style.display === "none") {
        return;
    }
    if (forced) {
        console.log("unhideWebView FORCED");
    }
    if (hidePanel) {
        hidePanel.style.display = "none";
    }
};
