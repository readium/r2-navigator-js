# Next

Git diff:
* https://github.com/readium/r2-navigator-js/compare/v1.0.7...develop

Changes:
* TODO

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
