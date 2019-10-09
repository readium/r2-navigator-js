# Next

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.36...develop

Changes:
* TODO

# 1.0.36

> Build environment: NodeJS `10.16.3`, NPM `6.11.3`

Changes:
* Now allowing `javascript:` hyperlinks

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.36/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.36/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.36

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.35...v1.0.36

# 1.0.35

> Build environment: NodeJS `10.16.3`, NPM `6.11.3`

Changes:
* Screen reader detection optionally triggers webview hard refresh

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.35/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.35/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.35

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.34...v1.0.35

# 1.0.34

> Build environment: NodeJS `10.16.3`, NPM `6.11.3`

Changes:
* Added safeguard against erroneous inner-publication links (badly-authored EPUBs)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.34/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.34/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.34

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.33...v1.0.34

# 1.0.33

> Build environment: NodeJS `10.16.3`, NPM `6.11.3`

Changes:
* NPM updates

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.33/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.33/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.33

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.32...v1.0.33

# 1.0.32

> Build environment: NodeJS `10.16.3`, NPM `6.11.3`

Changes:
* NPM updates
* TypeScript sort import

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.32/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.32/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.32

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.31...v1.0.32

# 1.0.31

> Build environment: NodeJS `10.16.3`, NPM `6.11.3`

Changes:
* NPM updates
* Added API to forward keyboard key down press event to consumer app, useful for previous/next navigation at page or spine -level

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.31/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.31/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.31

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.30...v1.0.31

# 1.0.30

> Build environment: NodeJS `10.16.0`, NPM `6.10.2`

Changes:
* NPM updates
* Buffer.from() API to remove deprecation messages

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.30/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.30/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.30

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.29...v1.0.30

# 1.0.29

> Build environment: NodeJS `10.16.0`, NPM `6.9.0`

Changes:
* TTS readaloud improvements and fixes (full screen utterances view, support for RTL text)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.29/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.29/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.29

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.28...v1.0.29

# 1.0.28

> Build environment: NodeJS `10.16.0`, NPM `6.9.0`

Changes:
* Fixed URI vs. URL bug (percent-escaped Unicode characters in path, was failing to match spine/readingOrder resource)
* Document selection: DOM Range normalization (algorithm from Apache Annotator, ported to TypeScript)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.28/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.28/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.28

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.27...v1.0.28

# 1.0.27

> Build environment: NodeJS `10.16.0`, NPM `6.9.0`

Changes:
* NPM updates
* Document selection: `window.getSelection().collapseToStart()` replaced with `.removeAllRanges()` (was failing silently inside IPC event listener)
* Document highlighting: working SVG implementation (background, underline, and strikethrough). Works with reflow scroll and paginated, as well as scaled fixed layout. Exact same visuals as with HTML divs, just with SVG instead. Note: no well-defined API to expose total functionality, still work in progress.

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.27/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.27/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.27

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.26...v1.0.27

# 1.0.26

> Build environment: NodeJS `10.15.3`, NPM `6.9.0`

Changes:
* Fix Electron/Chromium regression due to breaking changes in WebView (Out Of Process iFrame) lifecycle: resize and load events were creating unnecessary scroll adjustments in reflow column-paginated and scroll views.

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.26/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.26/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.26

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.25...v1.0.26

# 1.0.25

> Build environment: NodeJS `10.15.3`, NPM `6.9.0`

Changes:
* NPM update: the css-element-queries package (ResizeSensor) is now fetched from NPM rather than GitHub (was a forked/patched dependency, some time ago ...)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.25/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.25/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.25

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.24...v1.0.25

# 1.0.24

> Build environment: NodeJS `10.15.3`, NPM `6.9.0`

Changes:
* NPM updates (including the ResizeSensor)
* TTS renaming to "readaloud" (non-breaking internal API change)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.24/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.24/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.24

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.23...v1.0.24

# 1.0.23

> Build environment: NodeJS `10.15.3`, NPM `6.9.0`

Changes:
* NPM updates
* Fixed left/right arrow key for page switch, when keyboard focus inside webview (Electron post-v1 regression)
* Added highlights API (with minimal UI / UX in r2-testapp-js)
* Fixed-layout documents (FXL) sometimes did not emit the load event, and did not scale correctly (browser engine bugs / edge cases). There are still rendering issues in Electron v3-v5. To be continued...

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.23/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.23/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.23

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.22...v1.0.23

# 1.0.22

> Build environment: NodeJS `10.15.3`, NPM `6.9.0`

Changes:
* NPM updates

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.22/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.22/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.22

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.21...v1.0.22

# 1.0.21

> Build environment: NodeJS `8.15.1`, NPM `6.4.1`

Changes:
* LCP LSD TypeScript model instead of JSON "any"
* Added implementation document for selections/highlights
* NPM updates

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.21/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.21/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.21

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.20...v1.0.21

# 1.0.20

> Build environment: NodeJS `8.15.1`, NPM `6.4.1`

Changes:
* Latest ReadiumCSS
* Fixed Electron v1+ window.document.scrollingElement regression, as well as IPC event send() dom-ready event check, and scroll offset coordinates in selection/highlights (still todo: keyboard focus handling)
* NPM update r2-shared-js

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.20/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.20/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.20

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.19...v1.0.20

# 1.0.19

> Build environment: NodeJS `8.15.1`, NPM `6.4.1`

Changes:
* NPM updates

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.19/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.19/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.19

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.18...v1.0.19

# 1.0.18

> Build environment: NodeJS `8.14.1`, NPM `6.4.1`

Changes:
* NPM updates
* Updated documentation (README)
* Added support for two-page spreads with odd number of columns => empty "virtual" page at end of document.
* Fixed reading location progression reporting bugs (paginated reflowable documents, right to left)
* Added debugging feature for arbitrary visual reading locations
* New prototype code (incomplete API) for user text selections/annotations/highlights.
* Fixed ReadiumCSS for RTL (Hebrew, Arabic), was skipping some configuration
* Added information data structures to reading location (pagination and document information)
* Improved and fixed TTS / read aloud graphical user interface (minimal, but core to the user experience: modal popup text presenter with word-level highlighting and full ReadiumCSS support)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.18/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.18/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.18

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.17...v1.0.18

# 1.0.17

> Build environment: NodeJS `8.14.1`, NPM `6.4.1`

Changes:
* Fixed hyperlinking bug: nested a@href DOM fragments
* Improved footnote rendering (extraction of note content)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.17/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.17/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.17

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.16...v1.0.17

# 1.0.16

> Build environment: NodeJS `8.14.1`, NPM `6.4.1`

Changes:
* Reading locator can now be set with progression percentage (not just CSS selector/DOM element), which is useful for linear navigation / slider-scrub UI.
* Fixed "compute visibility" bug: CSS computed style "hidden" reported for scrolled-out columns!

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.16/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.16/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.16

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.15...v1.0.16

# 1.0.15

> Build environment: NodeJS `8.14.1`, NPM `6.4.1`

Changes:
* Improved visible element detection algorithm, to automatically create the most appropriate CSS selector in reflow paginated and scroll views (reading location for page / spread)
* Blacklist resize sensor in DOM traversal operations
* Handling of non-visual page breaks (invisible DOM spans)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.15/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.15/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.15

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.14...v1.0.15

# 1.0.14

> Build environment: NodeJS `8.14.1`, NPM `6.4.1`

Changes:
* NPM updates
* Fixed reflowable pagination bugs, inconsistent element selection based on visibility (HTML body fallback)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.14/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.14/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.14

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.13...v1.0.14

# 1.0.13

> Build environment: NodeJS `8.14.1`, NPM `6.4.1`

Changes:
* NPM updates
* Reflowable pagination improvement: two-page spread with odd number of columns (i.e. empty/blank "virtual" trailing page), and more accurate element-level position reporting
* Accessibility user setting "reduce motion", to disable animated page transitions
* Popup footnotes: aside with epub:type (rear|foot|end)note is normally automatically hidden, but shown when no targetting link is detected (e.g. dedicated standalone document appendix for notes)
* Content Security Policy for webview: allowed data: HTTP(S) protocols
* The "current reading location" getter now populates the document title, so client apps can use this to render info label

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.13/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.13/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.13

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.12...v1.0.13

# 1.0.12

> Build environment: NodeJS `8.14.1`, NPM `6.4.1`

Changes:
* NPM updates
* Added documentation (README)
* Improved keyboard handling, tab navigation
* Added support for TTS read aloud (WebSpeech API)
* Added support for popup footnotes (EPUB3)
* Fixed ReadiumCSS injection bug (edge cases with some bad DOM, doctype)
* Enabled loading of remote publications (was filtering local URL)
* Allow loading of Readium webpubmanifest with different URL syntax than default streamer implementation
* Disabled window.alert/confirm/prompt to avoid publication documents blocking the renderer thread
* Fixed arrow keys capture issues (no page turn when used for interaction with text input, video/audio, slider, etc.)
* Fixed scroll-to-view in the scroll view (now centering, was top edge)
* Added visibility mask when navigating back into previous publication spine item (to eliminate visual flash due to first-render of document top)
* Added blacklist of CSS class names and HTML element IDs for locators (CSS Selectors and CFI), to skip navigator-injected DOM markup)
* Fixed hash-fragment ID reset problem (::active pseudo CSS class)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.12/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.12/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.12

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.11...v1.0.12

# 1.0.11

> Build environment: NodeJS `8.14.1`, NPM `6.4.1`

Changes:
* Fixed regression bug that affected apps with custom URL protocol handlers (schemes) due to Content Security Policy (now narrow scope by filtering requests)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.11/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.11/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.11

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.10...v1.0.11

# 1.0.10

> Build environment: NodeJS `8.14.1`, NPM `6.4.1`

Changes:
* Added visibility testing for locators (updated README documentation)
* Improved timing of reading location restore, in case of layout delay due to heavy font faces, etc.
* Fixed issues related to Electron4 support (webview resizing, Content Security Policy via HTTP headers, security params in webview creation interceptor, priviledged URL scheme / protocol for fetch in renderer process)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.10/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.10/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.10

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.9...v1.0.10

# 1.0.9

> Build environment: NodeJS `8.14.1`, NPM `6.4.1`

Changes:
* Updated documentation
* Web console logging + shell output redirection
* Added window-attached debug(true/false) function to switch visual debugging (setting is persistent in localStorage)
* Code cleanup, better debug messages

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.9/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.9/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.9

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.8...v1.0.9

# 1.0.8

> Build environment: NodeJS `8.14.1`, NPM `6.4.1`

Changes:
* Updated documentation
* NPM 6.5.* has regression bugs for global package installs, so revert back to NPM 6.4.1 (which is officially shipped with the NodeJS installer).

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.8/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.8/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.8

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.7...v1.0.8

# 1.0.7

> Build environment: NodeJS `8.14.0`, NPM `6.5.0`

Changes:
* NPM updates
* API to provide epubReadingSystem info (name and version) changed slightly, now push-once rather than pull-many design pattern
* Improved documentation (in progress)
* Moved ReadiumCSS boilerplate code to here
* Removed unused DOM event code (legacy mechanism to cater for slow rendering performance)
* Console logging redirect for renderer process (not just webview isolated process)
* Minor internal code reorganisation

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.7/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.7/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.7

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.6...v1.0.7

# 1.0.6

> Build environment: NodeJS `8.14.0`, NPM `6.5.0`

Changes:
* Fixed regression bug due to the previous base64 pub ID encoding bugfix (slashes). Depending on what lib is used, URLs and URLs components do not necessarilly get automatically decoded/encoded (percent escape for base64 chars, e.g. `=` and `/`). We must be very careful because we pass around both full URLs, and URLs components that require encoding (thus the double-encoding issues). In the navigator component we also have the compound issue of URI authority/domain/origin (derived from the based64 encoding of the pub ID).

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.6/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.6/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.6

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.5...v1.0.6

# 1.0.5

> Build environment: NodeJS `8.14.0`, NPM `6.5.0`

Changes:
* NPM updates (r2-xxx-js)
* Fixed nasty Base64 encoding edge case with slash character in URLs
* Moved "secure" HTTP code from navigator to streamer

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.5/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.5/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.5

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.4...v1.0.5

# 1.0.4

> Build environment: NodeJS `8.14.0`, NPM `6.5.0`

Changes:
* NPM updates (`r2-xxx-js` packages)
* Replaced deprecated RawGit URLs
* ReadiumCSS readme (GitHub commit hash / revision)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.4/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.4/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.4

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.3...v1.0.4

# 1.0.3

> Build environment: NodeJS `8.14.0`, NPM `6.5.0`

Changes:
* Performance improvements in layout/rendering logic, now ReadiumCSS injected at streamer level (optionally, still works with regular DOM injection too)
* Fixed scroll view bug: fast-switching was making document jump up
* Fixed issue with back-navigation inside spine (delay in resynchronizing document position, in both scroll and paginated view modes)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.3/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.3/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.3

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.2...v1.0.3

# 1.0.2

> Build environment: NodeJS `8.14.0`, NPM `6.5.0`

Changes:
* Fixed code typo which was breaking some ReadiumCSS functionality.

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.2/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.2/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.2

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.1...v1.0.2

# 1.0.1

> Build environment: NodeJS `8.14.0`, NPM `6.5.0`

Changes:
* Disabled debug mode (visuals)
* Added missing license header
* Removed unnecessary import aliases

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.1/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.1/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.1

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.0...v1.0.1

# 1.0.0

> Build environment: NodeJS `8.14.0`, NPM `6.5.0`

Changes:
* Locator support (CFI, CSS Selectors, Progression(percent ratio), Position(placeholder))
* Various fixes in reflow column-based pagination and scroll view, LTR and RTL (arabic), due to box-model and offsetTop innaccuracy (now getBoundingClientRect() with floating point accuracy)
* ReadiumCSS added missing parameters, complete review of model + default values, based on current doc
* Fixed disappearing scroll view scrollbar when switching modes
* Adjusted focus and target CSS styles to transient display (timeout outline)
* CSS Selector lib replacement (more robust uniqueness strategy)
* NPM updates (minor)
* ReadiumCSS updated to latest (minor)
* Git revision JSON info now includes NodeJS and NPM version (build environment)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.0/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.0/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.0

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.0-alpha.7...v1.0.0

# 1.0.0-alpha.7

> Build environment: NodeJS `8.12.0`, NPM `6.4.1`

Changes:
* NPM updates (minor)
* ReadiumCSS updated to latest (minor)
* Git revision JSON info now includes NodeJS and NPM version (build environment)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.0-alpha.7/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.0-alpha.7/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.0-alpha.7

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.0-alpha.6...v1.0.0-alpha.7

# 1.0.0-alpha.6

Changes:
* Dependency "ta-json" GitHub semver dependency becomes "ta-json-x" NPM package (fixes https://github.com/readium/r2-testapp-js/issues/10 )
* Fixed TypeScript regression bug (3.0.3 -> 3.1.1) related to XML / HTML DOM typings
* Removed TypeScript linter warning message (checks for no unused variables)
* NPM updates related to the Node TypeScript typings

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.0-alpha.6/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.0-alpha.6/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.0-alpha.6

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.0-alpha.5...v1.0.0-alpha.6

# 1.0.0-alpha.5

Changes:
* NPM package 'debug' with explicity 'node' vs. 'browser' fix (console redirect)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.0-alpha.5/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.0-alpha.5/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.0-alpha.5

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.0-alpha.4...v1.0.0-alpha.5

# 1.0.0-alpha.4

Changes:
* NPM updates (external dependencies)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.0-alpha.4/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.0-alpha.4/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.0-alpha.4

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.0-alpha.3...v1.0.0-alpha.4

# 1.0.0-alpha.3

Changes:
* correct version in `package-lock.json`

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.0-alpha.3/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.0-alpha.3/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.0-alpha.3

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.0-alpha.2...v1.0.0-alpha.3

# 1.0.0-alpha.2

Changes (NPM updates):
* `@types/node`
* `@types/uuid`
* `r2-streamer-js`
* `r2-lcp-js`

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.0-alpha.2/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.0-alpha.2/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.0-alpha.2

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.0-alpha.1...v1.0.0-alpha.2

# 1.0.0-alpha.1

Changes:
* initial NPM publish

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.0-alpha.1/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.0-alpha.1/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.0-alpha.1

Git diff:
* initial NPM publish
