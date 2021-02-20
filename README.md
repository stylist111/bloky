# Ad Blocking Web Extension SDK

This is a library that provides integration of eyeo's [Ad Blocking Core][abpcore]
for Chromium and Firefox extensions (like [Adblock Plus][abpui]).

## Table of contents

* [Getting started](#getting-started)
  * [Module bundlers (optional)](#module-bundlers-optional)
* [Documentation](#documentation)
* [Development](#development)
  * [Installing/Updating dependencies](#installing-updating-dependencies)
  * [Building the library](#building-the-library)
  * [Building the documentation](#building-the-documentation)
  * [Linting the code](#linting-the-code)
* [Testing](#testing)
  * [Serving the test pages](#serving-the-test-pages)
  * [Using the test extension](#using-the-test-extension)
  * [Using the test runner](#using-the-test-runner)

## Getting started

The library comes in two parts, `abp-api.js` to be included in the extension's
background page, and `abp-content.js` to be loaded as a content script. Please
download the [latest build][builds] (or [build the library yourself](#development)).

The extension's `manifest.json` is required to include the following configuration:

```json
{
  "manifest_version": 2,
  "background": {
    "scripts": [
      "abp-api.js"
    ]
  },
  "content_scripts": [
    {
      "all_frames": true,
      "js": [
        "abp-content.js"
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
    "storage",
    "unlimitedStorage",
    "http://*/*",
    "https://*/*"
  ]
}
```

The API will be available in your own background scripts through the
global `ABP` object. Please call `ABP.start()` to start blocking ads.

### Module bundlers (optional)

`abp-api.js` is built as a UMD module (Universal Module Definition),
and so it can also be used with module bundlers.

If using a module bundler **do not** add `abp-api.js` to your `manifest.json`.
Consequently, there won't be a global `ABP` object.

#### CommonJS

```javascript
const ABP = require("./abp-api.js");
ABP.start();
```

#### ESM

```javascript
import * as ABP from "./abp-api.js";
ABP.start();
```

## Documentation

For more information, please refer to the [API documention][docs].

## Development

### Installing/Updating dependencies

    git submodule update --init
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

### Using the test extension

You can load the project root as an unpacked extension under `chrome://extensions`
in Chromium-based browsers, and under `about:debugging` in Firefox.
Once the extension is loaded, it opens the test suite in a new tab.

Note: For the popup tests to work, you have to disable the browser's
built-in popup blocking (on `localhost`).

You can also inspect the extension's background page to manually test the API
through the global `ABP` object.

### Using the test runner

    node test/runner.js {chromium|firefox|edge} [version] [options]
  
- The `--timeout` option overrides the per-test timeout in milliseconds.
- The `--grep` option filters the tests to run with a regular expression.

[abpcore]: https://gitlab.com/eyeo/adblockplus/adblockpluscore
[abpui]: https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui
[builds]: https://gitlab.com/eyeo/adblockplus/webext-sdk/-/jobs/artifacts/master/browse/dist?job=build
[docs]: https://gitlab.com/eyeo/adblockplus/webext-sdk/-/jobs/artifacts/master/file/docs/index.html?job=build
