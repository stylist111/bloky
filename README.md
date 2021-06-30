# eyeo's Web Extension Ad Blocking Toolkit

This is a library that provides integration of eyeo's [Ad Blocking Core][abpcore]
for Chromium and Firefox extensions (like [Adblock Plus][abpui]).

<div class="no-docs">

## Table of contents

* [Getting started](#getting-started)
  * [Module bundlers (optional)](#module-bundlers-optional)
  * [Machine learning models](#machine-learning-models)
* [Documentation](#documentation)
* [Development](#development)
  * [Prerequisites](#prerequisites)
  * [Installing/Updating dependencies](#installing-updating-dependencies)
  * [Building the library](#building-the-library)
  * [Building the documentation](#building-the-documentation)
  * [Linting the code](#linting-the-code)
* [Testing](#testing)
  * [Serving the test pages](#serving-the-test-pages)
  * [Building the test extension](#building-the-test-extension)
  * [Using the test runner](#using-the-test-runner)

</div>

## Getting started

The library comes in two parts, `ewe-api.js` to be included in the extension's
background page, and `ewe-content.js` to be loaded as a content script. Please
download the [latest build][builds] (or [build the library yourself][dev]).

The extension's `manifest.json` is required to include the following configuration:

```json
{
  "manifest_version": 2,
  "background": {
    "scripts": [
      "ewe-api.js"
    ]
  },
  "content_scripts": [
    {
      "all_frames": true,
      "js": [
        "ewe-content.js"
      ],
      "match_about_blank": true,
      "matches": [
        "http://*/*",
        "https://*/*"
      ],
      "run_at": "document_start"
    }
  ],
  "permissions": [
    "webNavigation",
    "webRequest",
    "webRequestBlocking",
    "unlimitedStorage",
    "<all_urls>"
  ]
}
```

The API will be available in your own background scripts through the
global `EWE` object. Please call `EWE.start()` to start blocking ads.

### Module bundlers (optional)

`ewe-api.js` is built as a UMD module (Universal Module Definition),
and so it can also be used with module bundlers.

If using a module bundler **do not** add `ewe-api.js` to your `manifest.json`.
Consequently, there won't be a global `EWE` object.

#### CommonJS

```javascript
const EWE = require("./ewe-api.js");
EWE.start();
```

#### ESM

```javascript
import * as EWE from "./ewe-api.js";
EWE.start();
```

### Machine learning models

Along with the library bundles there is a `models` folder. In order to support
ML-enabled snippets please include this folder and its contents in your
extension bundle in the same directory were `ewe-api.js` is located.

It is safe to omit these files but ML-enabled snippets won't have any effect then.

<div class="no-docs">

## Documentation

For more information, please refer to the [API documention][docs].

## Development

### Prerequisites

Node >= 12.18.4

### Installing/Updating dependencies

    npm install

### Building the library

    npx webpack

#### Release builds

By default, debug builds are created. If building the library to be used
in another project you would want to create a release build.

    npx webpack --env release

### Building the documentation

    npm run docs

### Linting the code

    npm run lint

## Testing

### Serving the test pages

Regardless of whether you're manually loading the test extension, or using
the test runner, the test suite requires locally served test pages.

    node test/start-server.js

### Building the test extension

    npm run test-build

The test extension will be built on both `/dist/test-mv2` and `/dist/test-mv3`
folders, which can be loaded as unpacked extensions under `chrome://extensions`
in Chromium-based browsers, and under `about:debugging` in Firefox.
Once the extension is loaded, it opens the test suite in a new tab.

Notes:
- `test-mv2` contains a manifest version 2 extension, and `test-mv3`
contains a manifest version 3 extension.
- For the popup tests to work, you have to disable the browser's
built-in popup blocking (on `localhost`).

You can also inspect the extension's background page to manually test the API
through the global `EWE` object.

### Using the test runner

    node test/runner.js {chromium|firefox|edge} [version|channel] [options]

- The `--timeout` option overrides the per-test timeout in milliseconds.
- The `--grep` option filters the tests to run with a regular expression.

Note: The test runner runs on `/dist/test-mv2`.
</div>

[abpcore]: https://gitlab.com/eyeo/adblockplus/adblockpluscore
[abpui]: https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui
[builds]: https://gitlab.com/eyeo/adblockplus/webext-sdk/-/jobs/artifacts/master/browse/dist?job=build
[docs]: https://gitlab.com/eyeo/adblockplus/webext-sdk/-/jobs/artifacts/master/file/docs/index.html?job=build
[dev]: https://gitlab.com/eyeo/adblockplus/webext-sdk#development

### Bundle test

Checks that the bundled code can be imported and re-bundled

    node test/bundle/run.js
