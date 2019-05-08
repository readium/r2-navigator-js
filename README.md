# NodeJS / TypeScript Readium-2 "navigator" component

NodeJS implementation (written in TypeScript) for the navigator module of the Readium2 architecture ( https://github.com/readium/architecture/ ).

[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](/LICENSE)

## Build status

[![NPM](https://img.shields.io/npm/v/r2-navigator-js.svg)](https://www.npmjs.com/package/r2-navigator-js) [![David](https://david-dm.org/readium/r2-navigator-js/status.svg)](https://david-dm.org/readium/r2-navigator-js)

[Changelog](/CHANGELOG.md)

## Prerequisites

1) https://nodejs.org NodeJS >= 8, NPM >= 5 (check with command line `node --version` and `npm --version`)
2) OPTIONAL: https://yarnpkg.com Yarn >= 1.0 (check with command line `yarn --version`)

## GitHub repository

https://github.com/readium/r2-navigator-js

There is no [github.io](https://readium.github.io/r2-navigator-js) site for this project (no [gh-pages](https://github.com/readium/r2-navigator-js/tree/gh-pages) branch).

## NPM package

https://www.npmjs.com/package/r2-navigator-js

Command line install:

`npm install r2-navigator-js`
OR
`yarn add r2-navigator-js`

...or manually add in your `package.json`:
```json
  "dependencies": {
    "r2-navigator-js": "latest"
  }
```

The JavaScript code distributed in the NPM package is usable as-is (no transpilation required), as it is automatically-generated from the TypeScript source.

Several ECMAScript flavours are provided out-of-the-box: ES5, ES6-2015, ES7-2016, ES8-2017:

https://unpkg.com/r2-navigator-js/dist/

(alternatively, GitHub mirror with semantic-versioning release tags: https://github.com/edrlab/r2-navigator-js-dist/tree/develop/dist/ )

The JavaScript code is not bundled, and it uses `require()` statement for imports (NodeJS style).

More information about NodeJS compatibility:

http://node.green

Note that web-browser Javascript is currently not supported (only NodeJS runtimes).

The type definitions (aka "typings") are included as `*.d.ts` files in `./node_modules/r2-navigator-js/dist/**`, so this package can be used directly in a TypeScript project.

Example usage:

```javascript
// currently no index file
// import { * } from "r2-navigator-js";

// ES5 import (assuming node_modules/r2-navigator-js/):
import { trackBrowserWindow } from "r2-navigator-js/dist/es5/src/electron/main/browser-window-tracker";

// ... or alternatively using a convenient path alias in the TypeScript config (+ WebPack etc.):
import { trackBrowserWindow } from "@r2-navigator-js/electron/main/browser-window-tracker";
```

## Dependencies

https://david-dm.org/readium/r2-navigator-js

A [package-lock.json](https://github.com/readium/r2-navigator-js/blob/develop/package-lock.json) is provided (modern NPM replacement for `npm-shrinkwrap.json`).

A [yarn.lock](https://github.com/readium/r2-navigator-js/blob/develop/yarn.lock) file is currently *not* provided at the root of the source tree.

## Continuous Integration

TODO (unit tests?)
https://travis-ci.org/readium/r2-navigator-js

Badge: `[![Travis](https://travis-ci.org/readium/r2-navigator-js.svg?branch=develop)](https://travis-ci.org/readium/r2-navigator-js)`

## Version(s), Git revision(s)

NPM package (latest published):

https://unpkg.com/r2-navigator-js/dist/gitrev.json

Alternatively, GitHub mirror with semantic-versioning release tags:

https://raw.githack.com/edrlab/r2-navigator-js-dist/develop/dist/gitrev.json

## Developer Primer

### Quick Start

Command line steps (NPM, but similar with YARN):

1) `cd r2-navigator-js`
2) `git status` (please ensure there are no local changes, especially in `package-lock.json` and the dependency versions in `package.json`)
3) `rm -rf node_modules` (to start from a clean slate)
4) `npm install`, or alternatively `npm ci` (both commands initialize the `node_modules` tree of package dependencies, based on the strict `package-lock.json` definition)
5) `npm run build:all` (invoke the main build script: clean, lint, compile)
6) `ls dist` (that's the build output which gets published as NPM package)

### Local Workflow (NPM packages not published yet)

Strictly-speaking, a developer needs to clone only the GitHub repository he/she wants to modify code in.
However, for this documentation let's assume that all `r2-xxx-js` GitHub repositories are cloned, as siblings within the same parent folder.
The dependency chain is as follows: `r2-utils-js` - `r2-lcp-js` - `r2-shared-js` - `r2-opds-js` - `r2-streamer-js` - `r2-navigator-js` - `r2-testapp-js`
(for example, this means that `r2-shared-js` depends on `r2-utils-js` and `r2-lcp-js` to compile and function properly).
Note that `readium-desktop` can be cloned in there too, and this project has the same level as `r2-testapp-js` in terms of its `r2-XXX-js` dependencies.

1) `cd MY_CODE_FOLDER`
2) `git clone https://github.com/readium/r2-XXX-js.git` (replace `XXX` for each repository name mentioned above)
3) `cd r2-XXX-js && npm install && npm run build:all` (the order of the `XXX` repositories does not matter here, as we are just pulling dependencies from NPM, and testing that the build works)
4) Now change some code in `r2-navigator-js` (for example), and invoke `npm run build` (for a quick ES8-2017 build) or `npm run build:all` (for all ECMAScript variants).
5) To update the `r2-navigator-js` package in `r2-testapp-js` without having to publish an official package with strict semantic versioning, simply invoke `npm run copydist`. This command is available in each `r2-XXX-js` package to "propagate" (compiled) code changes into all dependants.
6) From time to time, an `r2-XXX-js` package will have new package dependencies in `node_modules` (for example when `npm install --save` is used to fetch a new utility library). In this case ; using the `r2-navigator-js` example above ; the new package dependencies must be manually copied into the `node_modules` folder of `r2-testapp-js`, as these are not known and therefore not handled by the `npm run copydist` command (which only cares about propagating code changes specific to `r2-XXX-js` packages). Such mismatch may typically occur when working from the `develop` branch, as the formal `package-lock.json` definition of dependencies has not yet been published to NPM.
7) Lastly, once the `r2-navigator-js` code changes are built and copied across into `r2-testapp-js`, simply invoke `npm run electron PATH_TO_EPUB` to launch the test app and check your code modifications (or with `readium-desktop` use `npm run start:dev`).

## Programmer Documentation

An Electron app has one `main` process, and potentially several `renderer` processes (one per `BrowserWindow`).
In addition, there is a separate runtime for each `webview` embedded inside each `BrowserWindow`
(this qualifies as a `renderer` process too).
Communication between processes occurs via Electron's IPC asynchronous messaging system,
as the runtime contexts are otherwise isolated from each other.
Each process launches its own Javascript code bundle. There may be identical / shared code between bundles,
but the current state of a given context may differ from the state of another.
Internally, state synchronisation between isolated runtimes is performed using IPC,
or sometimes by passing URL parameters as this achieves a more instant / synchronous behaviour.

Most of the navigator API surface (i.e. exposed functions) relies on the fact that each process is effectively
a runtime "singleton", with a ongoing state during its lifecycle. For example, from the moment a `BrowserWindow`
is opened (e.g. the "reader" view for a given publication), a `renderer` process is spawned,
and this singleton runtime maintains the internal state of the navigator "instance"
(this includes the DOM `window` itself).
This explains why there is no object model in the navigator design pattern,
i.e. no `const nav = new Navigator()` calls.

### Electron main process

#### Session initialization

```javascript
// ES5 import (assuming node_modules/r2-navigator-js/):
import { initSessions, secureSessions } from "r2-navigator-js/dist/es5/src/electron/main/sessions";

// ... or alternatively using a convenient path alias in the TypeScript config (+ WebPack etc.):
import { initSessions, secureSessions } from "@r2-navigator-js/electron/main/sessions";

// Calls Electron APIs to setup sessions/partitions so that local storage (etc.)
// for webviews are sandboxed adequately, and to ensure resources are freed when the
// application shuts down.
// Also initializes the custom URL protocol / scheme used under the hood to ensure
// that individual publications have unique origins (to avoid inadvertantly sharing
// localStorage, IndexedDB, etc.)
//  See `convertCustomSchemeToHttpUrl()` and `convertHttpUrlToCustomScheme()` below.
initSessions(); // uses app.on("ready", () => {}) internally

app.on("ready", () => {

  // `streamerServer` is an instance of the Server class, see:
  // https://github.com/readium/r2-streamer-js/blob/develop/README.md
  const streamerServer = new Server( ... ); // r2-streamer-js

  // This sets up the Electron hooks that protect the transport layer by adding encrypted headers
  // in every request (see `streamerServer.getSecureHTTPHeader()`).
  // This relies on the private encryption key managed by `r2-streamer-js` (in secure mode),
  // which is also used for the self-signed HTTPS certificate.
  if (streamerServer.isSecured()) {
    secureSessions(streamerServer);
  }
}
```

#### URL scheme conversion

```javascript
import { READIUM2_ELECTRON_HTTP_PROTOCOL, convertHttpUrlToCustomScheme, convertCustomSchemeToHttpUrl }
  from "@r2-navigator-js/electron/common/sessions";

if (url.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL)) {

  // These functions convert back and forth between regular HTTP
  // (for example: https://127.0.0.1:3000/pub/PUB_ID/manifest.json)
  // and the custom URL protocol / scheme used under the hood to ensure
  // that individual publications have unique origins (to avoid inadvertantly sharing
  // localStorage, IndexedDB, etc.)
  const urlHTTP = convertCustomSchemeToHttpUrl(urlCustom);
} else {

  // Note that it is crucial that the passed URL has a properly-encoded base64 "PUB_ID",
  // which typically escapes `/` and `=` charaecters that are problematic in URL path component
  // as well as domain/authority (which the custom URL scheme leverages to create unique PUB_ID origins).
  const urlCustom = convertHttpUrlToCustomScheme(urlHTTP);
}
```

#### Electron browser window tracking

```javascript
import { trackBrowserWindow } from "@r2-navigator-js/electron/main/browser-window-tracker";

app.on("ready", () => {

  const electronBrowserWindow = new BrowserWindow({
    // ...
  });
  // This tracks created Electron browser windows in order to
  // intercept / hijack clicked hyperlinks in embedded content webviews
  // (e.g. user navigation inside EPUB documents)
  // Note that hyperlinking can work without this low-level,
  // Electron-specific mechanism (using DOM events),
  // but this is a powerful "native" interceptor that will listen to
  // navigation events triggered by non-interactive links (e.g. scripted / programmatic redirections)
  trackBrowserWindow(electronBrowserWindow);
}
```

#### Readium CSS configuration (streamer-level injection)

```javascript
import { IEventPayload_R2_EVENT_READIUMCSS } from "@r2-navigator-js/electron/common/events";
import {
    readiumCSSDefaults,
} from "@r2-navigator-js/electron/common/readium-css-settings";
import { setupReadiumCSS } from "@r2-navigator-js/electron/main/readium-css";

app.on("ready", () => {
  // `streamerServer` is an instance of the Server class, see:
  // https://github.com/readium/r2-streamer-js/blob/develop/README.md
  const streamerServer = new Server( ... ); // r2-streamer-js

  // `readiumCSSPath` is a local filesystem path where the folder that contains
  // ReadiumCSS assets can be found. `path.join(process.cwd(), ...)` or `path.join(__dirname, ...)`
  // can be used depending on integration / bundling context. The HTTP server will create a static hosting
  // route to this folder.
  setupReadiumCSS(streamerServer, readiumCSSPath, getReadiumCss);
  // `getReadiumCss` is a function "pointer" that will be called when the navigator
  // needs to obtain an up-to-date ReadiumCSS configuration (this is for initial injection in HTML documents,
  // via the streamer/server). Note that subsequent requests will originate from the renderer process,
  // whenever the webview needs to (see further below):
  const getReadiumCss = (publication: Publication, link: Link | undefined): IEventPayload_R2_EVENT_READIUMCSS => {

    // The built-in default values.
    // The ReadiumCSS app-level settings would typically be persistent in a store.
    const readiumCssKeys = Object.keys(readiumCSSDefaults);
    readiumCssKeys.forEach((key: string) => {
        const value = (readiumCSSDefaults as any)[key];
        console.log(key, " => ", value);
        // fetch values from app store ...
    });

    // See `electron/common/readium-css-settings.ts` for more information,
    // including links to the ReadiumCSS exhaustive documentation.
    return {
      setCSS: {
        ...
        fontSize: "100%",
        ...
        textAlign: readiumCSSDefaults.textAlign,
        ...
      } // setCSS can actually be undefined, in which case this disables ReadiumCSS completely.
    };
  };
}
```

### Electron renderer process(es), for each Electron BrowserWindow

#### Navigator initial injection

```javascript
import {
    installNavigatorDOM,
} from "@r2-navigator-js/electron/renderer/index";

// This function attaches the navigator HTML DOM and associated functionality
// to the app-controlled Electron `BrowserWindow`.
installNavigatorDOM(
    publication, // Publication object (see below for an example of how to create it)
    publicationURL, // For example: "https://127.0.0.1:3000/PUB_ID/manifest.json"
    rootHtmlElementID, // For example: "rootdiv", assuming <div id="rootdiv"></div> in the BrowserWindow HTML
    preloadPath, // See below.
    location); // A `Locator` object representing the initial reading bookmark (can be undefined/null)

// The string parameter `preloadPath` is the path to the JavaScript bundle created for
// `r2-navigator-js/src/electron/renderer/webview/preload.ts`,
// for example in development mode this could be (assuming EcmaScript-6 / ES-2015 is used):
// "node_modules/r2-navigator-js/dist/es6-es2015/src/electron/renderer/webview/preload.js",
// whereas in production mode this would be the copied JavaScript bundle inside the Electron app's ASAR:
// `"file://" + path.normalize(path.join((global as any).__dirname, preload.js))`
// (typically, the final application package contains the following JavaScript bundles:
// `main.js` alonside `renderer.js` and `preload.js`)

// Here is a typical example of how the Publication object (passed as first parameter) is created:
import { Publication } from "@r2-shared-js/models/publication";
import { JSON as TAJSON } from "ta-json-x";

const response = await fetch(publicationURL);
const publicationJSON = await response.json();
const publication = TAJSON.deserialize<Publication>(publicationJSON, Publication);
```

#### Readium CSS configuration (after stream-level injection)

```javascript
import {
    setReadiumCssJsonGetter
} from "@r2-navigator-js/electron/renderer/index";
import {
    readiumCSSDefaults
} from "@r2-navigator-js/electron/common/readium-css-settings";
import {
    IEventPayload_R2_EVENT_READIUMCSS,
} from "@r2-navigator-js/electron/common/events";

// `getReadiumCss` is a function "pointer" (callback) that will be called when the navigator
// needs to obtain an up-to-date ReadiumCSS configuration ("pull" design pattern).
// Unlike the equivalent function in the main process
// (which is used for the initial injection in HTML documents, via the streamer/server), this one handles
// requests by the actual content viewport, in an on-demand fashion:
const getReadiumCss = (publication: Publication, link: Link | undefined): IEventPayload_R2_EVENT_READIUMCSS => {

  // The built-in default values.
  // The ReadiumCSS app-level settings would typically be persistent in a store.
  const readiumCssKeys = Object.keys(readiumCSSDefaults);
  readiumCssKeys.forEach((key: string) => {
      const value = (readiumCSSDefaults as any)[key];
      console.log(key, " => ", value);
      // fetch values from app store ...
  });

  // See `electron/common/readium-css-settings.ts` for more information,
  // including links to the ReadiumCSS exhaustive documentation.
  return {

    // `streamerServer` is an instance of the Server class, see:
    // https://github.com/readium/r2-streamer-js/blob/develop/README.md
    // This is actually an optional field (i.e. can be undefined/null),
    // if not provided, `urlRoot` defaults to `window.location.origin`
    // (typically, https://127.0.0.1:3000 or whatever the port number happens to be):
    urlRoot: streamerServer.serverUrl(),

    setCSS: {
      ...
      fontSize: "100%",
      ...
      textAlign: readiumCSSDefaults.textAlign,
      ...
    } // setCSS can actually be undefined, in which case this disables ReadiumCSS completely.
  };
};
setReadiumCssJsonGetter(getReadiumCss);
```

```javascript
import {
    readiumCssOnOff,
} from "@r2-navigator-js/electron/renderer/index";

// This function simply tells the navigator that the ReadiumCSS settings have changed
// (for example when the user used the configuration panel to choose a font size).
// Following this call (in an asynchronous manner) the navigator will trigger a call
// to the function previously registered via `setReadiumCssJsonGetter()` (see above).
readiumCssOnOff();
```

#### EPUB reading system information

```javascript
import {
    setEpubReadingSystemInfo
} from "@r2-navigator-js/electron/renderer/index";

// This sets the EPUB3 `navigator.epubReadingSystem` object with the provided `name` and `version` values:
setEpubReadingSystemInfo({ name: "My R2 Application", version: "0.0.1-alpha.1" });
```

#### Logging, redirection from web console to shell

```javascript
// This should not be called explicitly on the application side,
// as this is already handled inside the navigator context! (this is currently not configurable)
// This automatically copies web console messages from the renderer process
// into the shell ouput (where logging messages from the main process are emitted):
import { consoleRedirect } from "@r2-navigator-js/electron/renderer/console-redirect";

// By default, the navigator calls the console redirector in both embedded webviews (iframes)
// and the central index (renderer process):
const releaseConsoleRedirect = consoleRedirect(loggingTag, process.stdout, process.stderr, true);
// loggingTag ===
// "r2:navigator#electron/renderer/webview/preload"
// and
// "r2:navigator#electron/renderer/index"
```

#### Reading location, linking with locators

```javascript
import {
    LocatorExtended,
    getCurrentReadingLocation,
    setReadingLocationSaver
} from "@r2-navigator-js/electron/renderer/index";

// `saveReadingLocation` is a function "pointer" (callback) that will be called when the navigator
// needs to notify the host app that the user's reading location has changed ("push" design pattern).
// This function call is debounced inside the navigator, to avoid flooding the application with
// many calls (and consequently putting unnecessary strain on the store/messaging system required to
// handle the renderer/main process communication).
// A typical example of when this function is called is when the user scrolls the viewport using the mouse
// (debouncing is every 250ms on the trailing edge,
// so there is always a 250ms delay before the first notification).
const saveReadingLocation = (location: LocatorExtended) => {
  // Use an application store to make `location` persistent
  // ...
};
setReadingLocationSaver(saveReadingLocation);

// This returns the last reading location as a `LocatorExtended` object (can be undefined).
// This is equal to the last object received in the `setReadingLocationSaver()` callback (see above)
const loc = getCurrentReadingLocation();
```

```javascript
// Typically, the `LocatorExtended` data structure will be used to store "bookmarks",
// to render a user interface that provides information about the document (e.g. page "numbers"),
// or to display an interactive "timeline" / linear scrub bar
// to rapidely navigate the publication spine / reading order.

// Here is a typical usage example for LocatorExtended.locator.href:
// (null/undefined sanity checks removed, for brevity)

let _publication: Publication; // set somewhere else
const locatorExtended = getCurrentReadingLocation();

// That's the HTML <title /> (inside the <head />)
console.log(locatorExtended.locator.title);

let foundLink = _publication.Spine.find((link, i) => {
    return link.Href === locatorExtended.locator.href;
});
if (!foundLink) {
    // a publication document is not necessarily the spine / reading order
    foundLink = _publication.Resources.find((link) => {
        return link.Href === locatorExtended.locator.href;
    });
}
// then, use `foundLink` as needed ...
```

```javascript
// `LocatorExtended.locations.cssSelector` is a CSS Selector that points to an HTML element,
// (i.e. the reading location / bookmarked reference)
// and it can be used as-is to restore this using the `handleLinkLocator()` function (see below).

// `LocatorExtended.locations.cfi` is provided as "read-only" information,
// in the sense that it is not used when ingested back into the navigator via `handleLinkLocator()`.
// In other words, setting the CFI field to undefined or another string has no effects when passing the parameter.

// `LocatorExtended.locations.position` is not currently supported / implemented,
// and as with the CFI field, it can be ignored when feeding back into the navigator API.

// `LocatorExtended.locations.progression` is a percentage (floating point number [0, 1])
// representing the reading location inside a single document,
// so for fixed layout this has no effect. However, reflowable documents are either scrolled or paginated,
// so the progression percentage represents how much vertical scrolling / horizontal panning there is.
// This progression field can be used to ask the navigator to set a specific reading placement
// using `handleLinkLocator()` (see further below).
// Typically, for paginated reflowable documents,
// the calculation of a desired progression could be mapped to "page" information (columns). See below.
```

```javascript
// When a reflowable document is currently presented in a paginated view,
// `LocatorExtended.paginationInfo` reports the current `totalColumns` (number of single "pages"),
// `currentColumn` (a zero-based index between [0, totalColumns-1]),
// and if `isTwoPageSpread` is true, then `spreadIndex` reports the zero-based index
// of the currently-visible two-page spread.
```

```javascript
// `LocatorExtended.docInfo` reports `isFixedLayout`, `isRightToLeft` and `isVerticalWritingMode`
// which are self-explanatory.
```

```javascript
// `LocatorExtended.docInfo` reports `isFixedLayout`, `isRightToLeft` and `isVerticalWritingMode`
// which are self-explanatory.
```

```javascript
// Note that `LocatorExtended.selectionInfo` is currently a prototype concept, not a stable API.
// However, this already provides an accurate representation of user selection / character ranges,
// which will ; in a future release of r2-navigator-js ; be connected to a highlights / annotations
// subsystem (i.e. minimal, but stable / robust functionality).
```

```javascript
// For convenience, here is the fully-expanded `LocatorExtended` data structure:
interface LocatorExtended {
    locator { //Locator
        href: string;
        title?: string;
        text?: { //LocatorLocations
            before?: string;
            highlight?: string;
            after?: string;
        };
        locations { //LocatorLocations
            cfi?: string;
            cssSelector?: string;
            position?: number;
            progression?: number;
        };
    };
    paginationInfo { //IPaginationInfo
        totalColumns: number | undefined;
        currentColumn: number | undefined;
        isTwoPageSpread: boolean | undefined;
        spreadIndex: number | undefined;
    };
    docInfo { //IDocInfo
        isFixedLayout: boolean;
        isRightToLeft: boolean;
        isVerticalWritingMode: boolean;
    };
    selectionInfo { //ISelectionInfo
        rangeInfo { //IRangeInfo
            startContainerElementCssSelector: string;
            startContainerChildTextNodeIndex: number;
            startOffset: number;

            endContainerElementCssSelector: string;
            endContainerChildTextNodeIndex: number;
            endOffset: number;

            cfi: string | undefined;
        };
        cleanText: string;
        rawText: string;
    };
}
```

```javascript
import {
  handleLinkLocator,
  handleLinkUrl
} from "@r2-navigator-js/electron/renderer/index";

// The `handleLinkUrl` function is used to instruct the navigator to load
// an absolute URL, either internal to the current publication,
// or external. For example:
// const href = "https://127.0.0.1:3000/PUB_ID/contents/chapter1.html";
// or:
// const href = "https://external-domain.org/out-link";
handleLinkUrl(href);

// A typical use-case is the publication's Table Of Contents.
// Each spine/readingOrder item is a `Link` object with a relative href (see `r2-shared-js` models).
// The final absolute URL may be computed simply by concatenating the publication's manifest.json URL:
// (although it is recommended to use a URL/URI library in order to handle query parameters, etc.)
const href = publicationURL + "/../" + link.Href;
// For example:
// publicationURL === "https://127.0.0.1:3000/PUB_ID/manifest.json"
// link.Href === "contents/chapter1.html"

// This can be used to restore a bookmark previously saved via `getCurrentReadingLocation()` (see above).
handleLinkLocator(locator);

// `locator.href` is obviously required.
// `locator.locations.cssSelector` can be used as-is (as provided by a prior call to `getCurrentReadingLocation()`)
// in order to restore a saved reading location.
// Alternatively, `locator.locations.progression` (percentage) can be used to pan/shift to a desired reading location,
// based on pagination / scroll information (see description of `LocatorExtended.paginationInfo`, above).
```

```javascript
import {
  getCurrentReadingLocation,
  isLocatorVisible
} from "@r2-navigator-js/electron/renderer/index";

const locEx = getCurrentReadingLocation();

// This function returns true (async promise) if the locator
// is fully or partially visible inside the viewport (scrolled or paginated).
// Always returns true for fixed layout publications / documents.
try {
    const visible = await isLocatorVisible(locEx.locator);
} catch (err) {
    console.log(err); // promise rejection
}
```

#### Navigating using arrow keys

```javascript
import {
    navLeftOrRight
} from "@r2-navigator-js/electron/renderer/index";

// This function instructs the navigator to "turn the page" left or right.
// This is litterally in relation to the left-side or right-side of the display.
// In other words, the navigator automatically handles the fact that with Right-To-Left content,
// the left-hand-side "page turn" button (or associated left arrow keyboard key) means "progress forward".
// For example (no need to explicitly handle RTL conditions in this app code):
window.document.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.keyCode === 37) { // left
        navLeftOrRight(true);
    } else if (ev.keyCode === 39) { // right
        navLeftOrRight(false);
    }
});
```

#### Selection Highlighting

```javascript
// The navigator maintains an ordered (visually-stacked) list of character-level highlights,
// during the lifespan of a loaded / rendered publication document. The app is responsible for instructing
// the navigator to instantiate these highlights, whenever a document is (re)loaded.
// There is no persistence at the level of the navigator, the state is constrained to the lifecycle
// of individual HTML documents. The navigator handles redrawing at the appropriate optimal times,
// for example when changing the font size. Highlights emit mouse click events which the app can listen to.

import {
    IHighlight,
    IHighlightDefinition,
} from "@r2-navigator-js/electron/common/highlight";
import {
    highlightsClickListen,
    highlightsCreate,
    highlightsRemove,
} from "@r2-navigator-js/electron/renderer/index";

// Use the setReadingLocationSaver() notification to detect when the user creates a new selection:
const saveReadingLocation = (location: LocatorExtended) => {

    if (location.selectionInfo && location.selectionIsNew) {
        // Note that a RGB `color` can be optionally specified in IHighlightDefinition (default is red-ish):
        const highlightToCreate = { selectionInfo: location.selectionInfo } as IHighlightDefinition;

        let createdHighlights: Array<IHighlight | null> | undefined;
        try {
            // The highlightsCreate() function takes an array of highlight definitions,
            // here we just pass a single one, derived from the user selection:
            createdHighlights = await highlightsCreate(location.locator.href, [highlightToCreate]);
        } catch (err) {
            console.log(err);
        }
        if (createdHighlights) {
            createdHighlights.forEach((highlight) => {
                if (highlight) {
                    // ...
                    // The visual highlight created in the navigator can be saved here in the app,
                    // so that it can be restored at a later stage, typically when reloading the document (href).
                }
            });
        }
    }
};
setReadingLocationSaver(saveReadingLocation);

// TIP: the app can detect when a new document has been loaded,
// in which case the saved / stored highlights (inside the app's persistence layer)
// must be re-instantiated inside the navigator:
let _lastSavedReadingLocationHref: string | undefined;
const saveReadingLocation = async (location: LocatorExtended) => {
    const hrefHasChanged = _lastSavedReadingLocationHref !== location.locator.href;
    _lastSavedReadingLocationHref = location.locator.href;

    // ...
    // here, invoke highlightsCreate() with the saved / stored highlights for this particular document (href)
};

// here we listen to mouse click events,
// and we destroy the clicked highlight:
highlightsClickListen((href: string, highlight: IHighlight) => {
    highlightsRemove(href, [highlight.id]);
    // ...
    // remove the persistent / stored / saved copy too!
});

```

#### Read aloud, TTS (Text To Speech), Synthetic Speech

```javascript
import {
    TTSStateEnum,
    ttsClickEnable,
    ttsListen,
    ttsNext,
    ttsPause,
    ttsPlay,
    ttsPrevious,
    ttsResume,
    ttsStop,
} from "@r2-navigator-js/electron/renderer/index";

// When true, mouse clicks on text inside publication documents
// trigger TTS readaloud playback at the pointed location.
// The default is false. Once set to true, this setting persists
// for any new loading document within the same publication.
// This resets to false for any newly opened publication.
// The ALT key modifier triggers playback for the pointed DOM fragment only.
ttsClickEnable(false);

// Starts playing TTS read aloud for the entire document, from the begining of the document,
// or from the last-known reading location (i.e. currently visible in the viewport).
// This does not automatically move to the next document.
// If called when already playing, stops and starts again from the current location.
// Highlighted word-by-word synthetic speech is rendered inside a modal overlay
// with basic previous/next and timeline scrubber controls (which has instant text preview).
// The textual popup overlay receives mouse clicks to pause/resume playback.
// The main document text (in the background of the modal overlay) keeps track
// of the current playback position, and the top-level spoken fragment is highlighted.
// Note that long paragraphs/sections of text are automatically sentence-fragmented
// in order to generate short speech utterances.
// Also note that the engine parses DOM information in order to assign the correct language
// to utterances, thereby providing support for multilingual documents.
ttsPlay();

// Stops playback whilst maintaining the read aloud popup overlay,
// ready for playback to be resumed.
ttsPause();

// Resumes from a paused state, plays from the begining of the last-played utterance, and onwards.
ttsResume();

// Stops any ongoing playback and discards the popup modal TTS overlay.
// Cleans-up allocated resources.
ttsStops();

// Navigate backward / forward inside the stream of utterances scheduled for the current TTS playback.
// Equivalent to the command buttons left/right of the timeline scrubber located at the bottom of the read aloud overlay.
ttsPrevious();
ttsNext();

// Sets up a callback for event notifications from the read aloud state machine.
// Currently: TTS paused, stopped, and playing.
ttsListen((ttsState: TTSStateEnum) => {
  if (ttsState === TTSStateEnum.PAUSED) {
    // ...
  } else if (ttsState === TTSStateEnum.STOPPED) {
    // ...
  } else if (ttsState === TTSStateEnum.PLAYING) {
    // ...
  }
});
```

At this stage there are missing features: voice selection (depending on languages), volume, speech rate and pitch.

#### LCP

```javascript
import { setLcpNativePluginPath } from "@r2-lcp-js/parser/epub/lcp";

// Registers the filesystem location of the native LCP library
const lcpPluginPath = path.join(process.cwd(), "LCP", "lcp.node");
setLcpNativePluginPath(lcpPluginPath);
```

```javascript
import { IDeviceIDManager } from "@r2-lcp-js/lsd/deviceid-manager";
import { launchStatusDocumentProcessing } from "@r2-lcp-js/lsd/status-document-processing";
import { lsdLcpUpdateInject } from "@r2-navigator-js/electron/main/lsd-injectlcpl";

// App-level implementation of the LSD (License Status Document)
const deviceIDManager: IDeviceIDManager = {

    async checkDeviceID(key: string): Promise<string | undefined> {
        //...
    },

    async getDeviceID(): Promise<string> {
        //...
    },

    async getDeviceNAME(): Promise<string> {
        //...
    },

    async recordDeviceID(key: string): Promise<void> {
        //...
    },
};

// Assumes a `Publication` object already prepared in memory,
// loaded from `publicationFilePath`.
// This performs the LCP-compliant background operations to register the device,
// and to check for an updated license (as passed in the callback parameter).
// The lsdLcpUpdateInject() function can be used to immediately inject the updated
// LCP license (META-INF/license.lcpl) inside the EPUB container on the filesystem.
// Note that although the `launchStatusDocumentProcessing()` initializes `publication.LCP.LSDJson`,
// after `lsdLcpUpdateInject()` is invoked a fresh new `publication.LCP` object is created
// (which mirrors `META-INF/container.xml`), so `launchStatusDocumentProcessing()` must be called again (loop)
// to ensure the latest LSD is indeed loaded and verified. Another alterative is to preserve the previous LSD,
// which in all likelyhood is exactly the same (i.e. hasn't changed since the LCP license injection).
// See immediately below for the alternative "preservation" method.
// See further below for the more contrived (but strictly-speaking more correct) "loop" method.
try {
    await launchStatusDocumentProcessing(publication.LCP, deviceIDManager,
        async (licenseUpdateJson: string | undefined) => {

            if (licenseUpdateJson) {
                const LSDJson = publication.LCP.LSDJson; // LSD preservation, see comment above.

                let res: string;
                try {
                    res = await lsdLcpUpdateInject(
                        licenseUpdateJson,
                        publication as Publication,
                        publicationFilePath);

                    publication.LCP.LSDJson = LSDJson; // LSD preservation, see comment above.
                } catch (err) {
                    debug(err);
                }
            }
        });
} catch (err) {
    debug(err);
}

// Example of looping the `launchStatusDocumentProcessing()` calls in order to reset `publication.LCP.LSDJson`
// after `lsdLcpUpdateInject()` injects a fresh `publication.LCP` based on the downloaded `META-INF/container.xml`.
async function tryLSD(deviceIDManager: IDeviceIDManager, publication: Publication, publicationFilePath: string): Promise<boolean> {

    return new Promise(async (resolve, reject) => {
        try {
            await launchStatusDocumentProcessing(publication.LCP as LCP, deviceIDManager,
                async (licenseUpdateJson: string | undefined) => {

                    if (licenseUpdateJson) {
                        let res: string;
                        try {
                            res = await lsdLcpUpdateInject(
                                licenseUpdateJson,
                                publication as Publication,
                                publicationFilePath);

                            try {
                                await tryLSD(publication, publicationFilePath); // loop to re-init LSD
                                resolve(true);
                            } catch (err) {
                                debug(err);
                                reject(err);
                            }
                        } catch (err) {
                            debug(err);
                            reject(err);
                        }
                    } else {
                        resolve(true);
                    }
                });
        } catch (err) {
            debug(err);
            reject(err);
        }
    });
}
try {
    await tryLSD(publication, publicationFilePath);
} catch (err) {
    debug(err);
}
```

```javascript
import { downloadEPUBFromLCPL } from "@r2-lcp-js/publication-download";

// Downloads the EPUB publication referenced by given LCP license,
// injects the license at META-INF/license.lcpl inside the EPUB container,
// and returns the result as an array of two string values:
// first is the full destination filepath (should be path.join(destinationDirectory, destinationFileName))
// second is the URL where the EPUB was downloaded from ("publicatiion" link inside the LCP license)
try {
    let epub = await downloadEPUBFromLCPL(lcplFilePath, destinationDirectory, destinationFileName);
} catch (err) {
  debug(err);
}
```

```javascript
import { doTryLcpPass } from "@r2-navigator-js/electron/main/lcp";

// This asks the LCP library to test an array of passphrases
// (or the SHA256 digest of the passphrases).
// The promise is rejected (try+catch) when no valid passphrase was found.
// The function returns the first valid passphrase.
try {
    const lcpPass = "my LCP passphrase";
    const validPass = await doTryLcpPass(
        publicationsServer,
        publicationFilePath,
        [lcpPass],
        isSha256Hex);

    let passSha256Hex: string | undefined;
    if (!isSha256Hex) {
        const checkSum = crypto.createHash("sha256");
        checkSum.update(lcpPass);
        passSha256Hex = checkSum.digest("hex");
    } else {
        passSha256Hex = lcpPass;
    }
} catch (err) {
    debug(err);
}
```

```javascript
import { doLsdRenew } from "@r2-navigator-js/electron/main/lsd";
import { doLsdReturn } from "@r2-navigator-js/electron/main/lsd";

// LSD "renew" (with a specific end date)
try {
    const lsdJson = await doLsdRenew(
        publicationsServer,
        deviceIDManager,
        publicationFilePath,
        endDateStr);
} catch (err) {
    debug(err);
}

// LSD "return"
try {
    const lsdJson = await doLsdReturn(
        publicationsServer,
        deviceIDManager,
        publicationFilePath);
} catch (err) {
    debug(err);
}

// Both LSD "renew" and "return" interactions can return errors (i.e. Promise.reject => try/catch with async/await)
// when the server responds with HTTP statusCode < 200 || >= 300.
// The `err` object in the above code snippet can be a number (HTTP status code) when no response body is available.
// Otherwise, it can be an object with the `httpStatusCode` property (number) and httpResponseBody (string)
// when the response body cannot be parsed to JSON.
// Otherwise, it can be an object with the `httpStatusCode` property (number) and other arbitrary JSON properties,
// depending on the server response. Typically, compliant LCP/LSD servers are expected to return Problem Details JSON (RFC7807),
// which provides `title` `type` and `details` JSON properties.
// See https://readium.org/technical/readium-lsd-specification/#31-handling-errors
```
