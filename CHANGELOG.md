# Next

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.4.7...develop

Changes:
* TODO

# 1.4.7

> Build environment: NodeJS `12.18.1`, NPM `6.14.5`

Changes:
* NPM package updates

Git revision info:
* https://unpkg.com/r2-navigator-js@1.4.7/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.4.7/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.4.7

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.4.6...v1.4.7

# 1.4.6

> Build environment: NodeJS `12.18.0`, NPM `6.14.5`

Changes:
* Audiobooks with no cover image were crashing
* Minor NPM package updates

Git revision info:
* https://unpkg.com/r2-navigator-js@1.4.6/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.4.6/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.4.6

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.4.5...v1.4.6

# 1.4.5

> Build environment: NodeJS `12.18.0`, NPM `6.14.5`

Changes:
* Workaround for Electron regression bug, HTTP headers passthrough ( https://github.com/electron/electron/issues/23988 )

Git revision info:
* https://unpkg.com/r2-navigator-js@1.4.5/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.4.5/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.4.5

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.4.4...v1.4.5

# 1.4.4

> Build environment: NodeJS `12.16.3`, NPM `6.14.5`

Changes:
* TTS readaloud new mode: in-document highlighting, with smooth scroll-into-view, word-by-word underline emphasis during playback, and sentence-level navigation granularity (i.e. individual atomic TTS utterances), created from larger paragraph blocks of text. TTS utterances can be clicked to start playback (hit testing based on fragmented strings of characters / DOM ranges).
* TTS readaloud simplified "overlay" view is now opt-in, default is in-document highlighting.

Git revision info:
* https://unpkg.com/r2-navigator-js@1.4.4/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.4.4/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.4.4

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.4.3...v1.4.4

# 1.4.3

> Build environment: NodeJS `12.16.3`, NPM `6.14.5`

Changes:
* Fixed bug which prevented resources from loading, when URL path starts with any first characters of "/manifest.json" (incorrect URL resolution routine, bad character offset calculation, erroneous common root string)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.4.3/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.4.3/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.4.3

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.4.2...v1.4.3

# 1.4.2

> Build environment: NodeJS `12.16.3`, NPM `6.14.5`

Changes:
* EPUB3 Media Overlays / sync-media: "caption style" view switch does not automatically trigger pause/resume.

Git revision info:
* https://unpkg.com/r2-navigator-js@1.4.2/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.4.2/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.4.2

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.4.1...v1.4.2

# 1.4.1

> Build environment: NodeJS `12.16.2`, NPM `6.14.4`

Changes:
* NPM package updates.
* EPUB3 Media Overlays / sync-media: new "caption style" view.
* TTS readaloud: improved presentation styles for sepia, night and normal modes.
* TTS readaloud: new features, emphasis on heading levels, and inline display of images with "alt" attribute.
* Annotations / highlights: vastly improved rendering performance (DocumentFragment to build DOM, then batch-append highlights "layer" into actual document, also better mouse interaction / hover detection).
* Annotation / highlights: display improvement, using "mix blend mode" with opacity, yield better text legibility.
* Annotation / highlights: SVG and HTML renderers now default to "background" drawing style, with "underline" / "strikethrough" optional choices (was hard-coded before, now in API).

Git revision info:
* https://unpkg.com/r2-navigator-js@1.4.1/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.4.1/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.4.1

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.4.0...v1.4.1

# 1.4.0

> Build environment: NodeJS `12.16.2`, NPM `6.14.4`

Changes:
* NPM package updates
* Support for fixed-layout / FXL two-page spread in EPUB publications, works for Media Overlays synchronized text/audio playback, concurrent reading locations depending on "active" focused page, selection / highlights, etc. (TTS readloud is currently not polished in two-page mode, needs to be mutually-exclusive per page)
* Fixed Media Overlays night and sepia highlights
* Fixed SVG xlink:href relative URL handling
* Disabled FXL scroll during element focusing (mouse, keyboard interactions)
* Workaround for fixed layout documents that do not size the body correctly (force width + height dimensions)
* Visibility mask improved for fixed layout documents (smooth fade effect)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.4.0/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.4.0/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.4.0

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.3.2...v1.4.0

# 1.3.2

> Build environment: NodeJS `12.16.2`, NPM `6.14.4`

Changes:
* EPUB Media Overlays skippables fix

Git revision info:
* https://unpkg.com/r2-navigator-js@1.3.2/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.3.2/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.3.2

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.3.1...v1.3.2

# 1.3.1

> Build environment: NodeJS `12.16.2`, NPM `6.14.4`

Changes:
* EPUB Media Overlays / W3C Sync Media playback rate needed reset across audio files switch

Git revision info:
* https://unpkg.com/r2-navigator-js@1.3.1/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.3.1/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.3.1

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.3.0...v1.3.1

# 1.3.0

> Build environment: NodeJS `12.16.2`, NPM `6.14.4`

Changes:
* NPM updates
* EPUB Media Overlays / W3C Sync Media playback
* Highlights fixes in scroll mode (incorrect visual offsets due to CSS margins)
* Fixed focus / refresh bugs in scroll and paginated views (sync of reading location)
* Crushed a fixed layout scroll bug

Git revision info:
* https://unpkg.com/r2-navigator-js@1.3.0/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.3.0/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.3.0

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.2.0...v1.3.0

# 1.2.0

> Build environment: NodeJS `12.16.2`, NPM `6.14.4`

Changes:
* NPM updates
* TTS read aloud UI improvements (active utterance presentation, smooth scroll), added speech rate control API
* disabled "will-quit" Electron app event handler for clearSessions()

Git revision info:
* https://unpkg.com/r2-navigator-js@1.2.0/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.2.0/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.2.0

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.57...v1.2.0

# 1.1.57

> Build environment: NodeJS `12.16.2`, NPM `6.14.4`

Changes:
* NPM updates
* Fix: XML namespaces in popup footnotes (e.g. epub:type attributes, MathML elements)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.57/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.57/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.57

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.56...v1.1.57

# 1.1.56

> Build environment: NodeJS `12.16.2`, NPM `6.14.4`

Changes:
* NPM updates
* Audiobooks: improved progress slider timeline (input type range)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.56/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.56/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.56

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.55...v1.1.56

# 1.1.55

> Build environment: NodeJS `12.16.1`, NPM `6.14.4`

Changes:
* NPM updates
* Audiobooks: skip title when non-existent
* Correct license.lcpl path for LCP injection in EPUB and Readium audiobooks

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.55/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.55/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.55

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.54...v1.1.55

# 1.1.54

> Build environment: NodeJS `12.16.1`, NPM `6.14.4`

Changes:
* NPM updates (minor, including Electron)
* Fixed CSON-2-JSON build script
* audiobook player improvements: SVG icons, time indicators, placeholders for localization (translatable titles), cover image play/pause button now reacts on mouse up event and only for left mouse button click (otherwise interferes with right click for context menu), added rate speed control

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.54/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.54/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.54

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.53...v1.1.54

# 1.1.53

> Build environment: NodeJS `12.16.1`, NPM `6.14.4`

Changes:
* NPM updates (minor)
* Fixed 'will-navigate' infinite loop introduced by HTML injection of `<base href="HTTP_URL" />`
* ReadiumCSS is not applied to iframes
* Improved invisibility "mask" techique, default when ReadiumCSS is HTML-injected, disabled at window.load event
* Fixed handling of base@href (HTTP URL) vs. the root URL of ReadiumCSS assets

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.53/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.53/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.53

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.52...v1.1.53

# 1.1.52

> Build environment: NodeJS `12.16.1`, NPM `6.14.4`

Changes:
* NPM updates (minor)
* workaround for application/xhtml+xml not handled correctly in xmldom lib
* support for audio/video autoplay (Electron command line switch)
* support for audio background looping track (epub:type = ibooks:soundtrack)
* in order to bypass Electron registerStreamProtocol() bugs: instead of static DOM patching of audio and video src URLs (replacement of custom URL protocol/scheme with direct HTTP streamer address), we now inject `<base href="HTTP_URL"/>` (this benefits all resolved absolute URLs, including scripted ones from mutated dynamic DOM, and does not affect the sandboxing of localStorage, IndexedDB etc. which is afforded by the custom URL protocol/scheme)
* fixed handling of iframes inside publication HTML documents (forwarding of query params, and allows same-origin scripting by bypassing the aforementioned `<base href="HTTP_URL"/>` of the host document, recursively)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.52/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.52/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.52

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.51...v1.1.52

# 1.1.51

> Build environment: NodeJS `12.16.1`, NPM `6.14.4`

Changes:
* NPM updates
* Electron getWebContents() WebView API deprecation (upcoming breaking change)
* replaced registerStreamProtocol() with registerHttpProtocol() as the latter was hanging on large resource requests from the HTTP server / streamer
* registerStreamProtocol() with self-signed certificate passthrough, and encrypted HTTP headers

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.51/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.51/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.51

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.50...v1.1.51

# 1.1.50

> Build environment: NodeJS `12.16.1`, NPM `6.14.3`

Changes:
* in debug / development mode: context menu for "inspect element" at x,y coordinates, with automatic forced-focus on devtools window
* audiobook error event now console logged in normal non-debug mode
* in development mode with special audio debug enabled: the buffering tracking element (HTML canvas) is now centered correctly

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.50/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.50/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.50

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.49...v1.1.50

# 1.1.49

> Build environment: NodeJS `12.16.1`, NPM `6.14.2`

Changes:
* fix: when there is a text selection, the reading location is the start container of the selection. Also added CFI indicator for start/end selection containers (in addition to existing CSS selector)
* fix: role=doc-pagebreak in addition to epub:type=pagebreak, and pagebreak label now obtained from title and aria-label attributes in addition to element's textual descendant

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.49/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.49/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.49

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.48...v1.1.49

# 1.1.48

> Build environment: NodeJS `12.16.1`, NPM `6.14.2`

Changes:
* NPM package updates (minor semantic version increments)
* ReadiumCSS upgrade + fixed a subtle bug related to 'null' origin in the case of audio book (HTML template with data: URL + base) + API updates to allow app host to pass configuration instead of navigator "pulling" data as needed (this change is required for contextual / per-publication ReadiumCSS presets)
* Performance: significant improvements in annotations / highlights rendering, ReadiumCSS background-color override, animated page scroll
* Audiobooks: added debugging UI and console messages to help troubleshoot random playback break problems
* Usability: avoid unnecessary reading location recording when scrolling, if currently-recorded element is already in the visible viewport (scroll and paginated modes)
* Accessibility: consider that CSS selector link is equivalent to hash fragment identifier (e.g. typical TOC heading), for the purpose of setting the destination for the top-level skip-hyperlink (which restores previously-linked bookmarks, etc.)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.48/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.48/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.48

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.47...v1.1.48

# 1.1.47

> Build environment: NodeJS `12.16.1`, NPM `6.14.1`

Changes:
* NPM updates (minor)
* tabbables now handled via focusin (hyperlinks traversal) => better performance, fewer keyboard-tabbing flashes / visual "bugs"
* added top-level "skip link" to quickly keyboard-access the current URL hash fragment identifier or "active" target element (the link is CFI and CSS selector blacklisted) ... we need this because the iframe/webview cannot force focus when keyboard is in the app UI (the user must explicitely trigger the navigation)
* fixed CFI blacklisting (even number element indexing calculations)
* fixed style animation restart for element target (hyperlinking), added CSS "target" class to mimic the actual pseudo-class (for when URL fragment identifier is not used)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.47/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.47/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.47

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.46...v1.1.47

# 1.1.46

> Build environment: NodeJS `12.16.1`, NPM `6.14.1`

Changes:
* NPM updates (minor)
* Fixed the keyboard event handler callback signature to include the element name and attributes used for blacklisting on the API's client side
* Added EPUB epub:type=pagebreak info in reading location (nearest preceeding ancestor/sibling in document order)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.46/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.46/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.46

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.45...v1.1.46

# 1.1.45

> Build environment: NodeJS `12.16.1`, NPM `6.14.0`

Changes:
* NPM updates, including minor Electron
* Added key-up event listener (to existing key-down), and target element name (for optional client-side blacklisting). Also now ensures "capture" in top-level document event listen.

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.45/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.45/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.45

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.44...v1.1.45

# 1.1.44

> Build environment: NodeJS `12.15.0`, NPM `6.13.7`

Changes:
* NPM updates, notably: removed unused UUID package (breaking API change in newer version, so must avoid unnecessarily import here)
* CSS fix: ReadiumCSS was taking precedence due to selector specificity (button border colour in night mode, audio player)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.44/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.44/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.44

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.43...v1.1.44

# 1.1.43

> Build environment: NodeJS `12.15.0`, NPM `6.13.7`

Changes:
* NPM updates
* Bugfix: protection against publications without Resources
* API improvement: readiumCssUpdate(rcss) now replaces readiumCssOnOff() which was misnamed and required out-of-line callback to fetch ReadiumCSS info.
* Content transformers now pass "session info" semantic-agnostic data (serialized string) so that anonymous HTTP requests can be correlated with specific publications and with their reading session (multiple readers scenario). Also see changes in r2-shared, and of course r2-streamer.
* Support for AudioBook serving/streaming, local-packed (zipped), local-exploded (unzipped), and remote-exploded.
* Electron v8 (was v7)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.43/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.43/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.43

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.42...v1.1.43

# 1.1.42

> Build environment: NodeJS `12.13.1`, NPM `6.13.4`

Changes:
* NPM updates
* ReadiumCSS update

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.42/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.42/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.42

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.41...v1.1.42

# 1.1.41

> Build environment: NodeJS `12.13.0`, NPM `6.13.0`

Changes:
* Clipboard copy interceptor for LCP rights

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.41/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.41/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.41

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.40...v1.1.41

# 1.1.40

> Build environment: NodeJS `12.13.0`, NPM `6.13.0`

NOTE: this was mistakenly tagged as 1.0.40!

Changes:
* NPM package updates
* TAJSON now parses/generates arbitrary JSON properties with typed object

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.40/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.40/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.40

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.39...v1.1.40

# 1.1.39

> Build environment: NodeJS `12.13.0`, NPM `6.13.0`

Changes:
* NPM updates
* MathJax "support" (blacklisting CSS selectors + CFI)
* Added "refresh" function for webview (reloadContent()))

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.39/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.39/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.39

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.38...v1.1.39

# 1.1.38

> Build environment: NodeJS `12.13.0`, NPM `6.12.0`

Changes:
* NPM updates
* Removal of ResizeSensor, now using Chromium native Observer to detect HTML body dimensions changes (in order to re-paginate)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.38/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.38/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.38

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.1.37...v1.1.38

# 1.1.37

> Build environment: NodeJS `12.13.0`, NPM `6.12.0`

Changes:
* NPM updates, Electron v7

Git revision info:
* https://unpkg.com/r2-navigator-js@1.1.37/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.1.37/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.1.37

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.37...v1.1.37

# 1.0.37

ELECTRON v6 moved to `electron6` branch! (Electron v7 in `develop`)

> Build environment: NodeJS `10.16.3`, NPM `6.12.0`

Changes:
* NPM updates (including NodeJS v12 for Electron v6)

Git revision info:
* https://unpkg.com/r2-navigator-js@1.0.37/dist/gitrev.json
* https://github.com/edrlab/r2-navigator-js-dist/blob/v1.0.37/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-navigator-js/commits/v1.0.37

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.36...v1.0.37

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
