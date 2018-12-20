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

## Developer quick start

Command line steps (NPM, but similar with YARN):

1) `cd r2-navigator-js`
2) `git status` (please ensure there are no local changes, especially in `package-lock.json` and the dependency versions in `package.json`)
3) `rm -rf node_modules` (to start from a clean slate)
4) `npm install`, or alternatively `npm ci` (both commands initialize the `node_modules` tree of package dependencies, based on the strict `package-lock.json` definition)
5) `npm run build:all` (invoke the main build script: clean, lint, compile)
6) `ls dist` (that's the build output which gets published as NPM package)

## Documentation

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

```javascript
import {
    setEpubReadingSystemInfo
} from "@r2-navigator-js/electron/renderer/index";

// This sets the EPUB3 `navigator.epubReadingSystem` object with the provided `name` and `version` values:
setEpubReadingSystemInfo({ name: "My R2 Application", version: "0.0.1-alpha.1" });
```

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

```javascript
import {
    LocatorExtended,
    setReadingLocationSaver
} from "@r2-navigator-js/electron/renderer/index";

// `saveReadingLocation` is a function "pointer" (callback) that will be called when the navigator
// needs to notify the host app that the user's reading location has changed ("push" design pattern).
// This function call is debounced inside the navigator, to avoid flooding the application with
// many calls (and consequently putting unnecessary strain on the store/messaging system required to
// handle the renderer/main process communication).
// A typical example of when this function is called is when the user scrolls the viewport using the mouse
// (debouncing is every 500ms on the trailing edge,
// so there is always a 500ms delay before the first notification).
const saveReadingLocation = (location: LocatorExtended) => {
  // Use an application store to make `location` persistent
  // ...
};
setReadingLocationSaver(saveReadingLocation);
```

```javascript
import {
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
// The final absolute URL can be computed simply by concatenating the publication's manifest.json URL:
const href = publicationURL + "/../" + link.Href;
// For example:
// publicationURL === "https://127.0.0.1:3000/PUB_ID/manifest.json"
// link.Href === "contents/chapter1.html"
```

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

```javascript
// TODO LCP
import { lsdLcpUpdateInject } from "@r2-navigator-js/electron/main/lsd-injectlcpl";
import { doTryLcpPass } from "@r2-navigator-js/electron/main/lcp";
import { IDeviceIDManager } from "@r2-lcp-js/lsd/deviceid-manager";
import { doLsdRenew } from "@r2-navigator-js/electron/main/lsd";
import { doLsdReturn } from "@r2-navigator-js/electron/main/lsd";
```
