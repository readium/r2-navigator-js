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

Wiki documentation is not used, instead there are Markdown files inside the repository ([docs](https://github.com/readium/r2-navigator-js/tree/develop/docs) folder).

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
    IReadiumCSS,
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
  setupReadiumCSS(streamerServer, readiumCSSPath, getReadiumCssJson);
  // `getReadiumCssJson` is a function "pointer" that will be called when the navigator
  // needs to obtain an up-to-date ReadiumCSS configuration (this is for initial injection in HTML documents,
  // subsequent requests will originate from the renderer process, whenever the webview needs to, see further below):
  const getReadiumCssJson = (publication: Publication, link: Link | undefined): IEventPayload_R2_EVENT_READIUMCSS => {

    // The built-in default values.
    // The ReadiumCSS app-level settings would typically be persistent in a store.
    const readiumCssKeys = Object.keys(readiumCSSDefaults); // IReadiumCSS
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
      },
      urlRoot: streamerServer.serverUrl() // in a future API revision this will be moved inside `setupReadiumCSS()`
    };

    // Note that `setCSS` can be `undefined`, in which case ReadiumCSS is totally deactivated.
    // Typically, fixed-layout publications / documents are left alone (see function `isFixedLayout()` below)
    if (isFixedLayout(publication, link)) {
        return { setCSS: undefined, isFixedLayout: true };
    }
  };

  // in a future API revision this may be moved inside `setupReadiumCSS()` (boilerplate)
  function isFixedLayout(publication: Publication, link: Link | undefined): boolean {
      if (link && link.Properties) {
          if (link.Properties.Layout === "fixed") {
              return true;
          }
          if (typeof link.Properties.Layout !== "undefined") {
              return false;
          }
      }
      if (publication &&
          publication.Metadata &&
          publication.Metadata.Rendition) {
          return publication.Metadata.Rendition.Layout === "fixed";
      }
      return false;
  }
}
```

```javascript
// TODO
import { lsdLcpUpdateInject } from "@r2-navigator-js/electron/main/lsd-injectlcpl";
import { doTryLcpPass } from "@r2-navigator-js/electron/main/lcp";
import { IDeviceIDManager } from "@r2-lcp-js/lsd/deviceid-manager";
import { doLsdRenew } from "@r2-navigator-js/electron/main/lsd";
import { doLsdReturn } from "@r2-navigator-js/electron/main/lsd";
// ---
import {
    IReadiumCSS,
    readiumCSSDefaults,
} from "@r2-navigator-js/electron/common/readium-css-settings";
import {
    READIUM2_ELECTRON_HTTP_PROTOCOL,
    convertCustomSchemeToHttpUrl,
} from "@r2-navigator-js/electron/common/sessions";
import { getURLQueryParams } from "@r2-navigator-js/electron/renderer/common/querystring";
import { consoleRedirect } from "@r2-navigator-js/electron/renderer/console-redirect";
import {
    LocatorExtended,
    handleLinkUrl,
    installNavigatorDOM,
    navLeftOrRight,
    readiumCssOnOff,
    setEpubReadingSystemJsonGetter,
    setReadingLocationSaver,
    setReadiumCssJsonGetter,
} from "@r2-navigator-js/electron/renderer/index";
import { INameVersion } from "@r2-navigator-js/electron/renderer/webview/epubReadingSystem";
```

### Electron renderer process(es), for each browser window
