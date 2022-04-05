# eyeo's Web Extension Ad Blocking Toolkit

This is a library that provides integration of eyeo's [Ad Blocking Core][abpcore]
for Chromium and Firefox extensions (like [Adblock Plus][abpui]).

<div class="no-docs">

## Table of contents

* [Getting started](#getting-started)
  * [Module bundlers (optional)](#module-bundlers-optional)
  * [Snippet filters support](#snippet-filters-support)
  * [Shared resources](#shared-resources)
  * [Notifications support](#notifications-support)
  * [One Click Allowlisting support](#one-click-allowlisting-support)
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

```
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

```
const EWE = require("./ewe-api.js");
EWE.start();
```

#### ESM

```
import * as EWE from "./ewe-api.js";
EWE.start();
```

### Snippet filters support

In order to enable support for [snippet filters][snippet-filters] you have to get
the [snippets library][snippets-project] separately and make it available to `EWE`:

```
let response = await fetch("snippets.js");
let code = await response.text();
EWE.snippets.setLibrary(code);
```

The integration of the machine learning models is expected to be done by clients
of the snippet library.

### Shared resources

There are some shared resources that are used by both webext-sdk & production code:
- `browser`
  - Global is set by webextension-polyfill version 0.8.0.
- `browser.runtime.connect()`/`browser.runtime.onConnect`
  - Channel name is prefixed with "ewe:".
- `browser.runtime.sendMessage()`/`browser.runtime.onMessage`
  - Messages are objects with a "type" property whose value is prefixed with "ewe:".
- `indexedDB.open()`
  - Database name is prefixed with "EWE".
- `ewe:content-hello`
  - This event is [sent by the SDK](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/blob/master/sdk/content/index.js#L31) to the [SDK message responder](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/blob/master/sdk/api/message-responder.js) in order to initialise content features.
- Web page links
  - Links used by module are prefixed with "abp:" or "https://subscribe.adblockplus.org/".

During initialization webext-sdk migrates legacy data from local storage to indexedDB.
Files migrated have to be prefixed: ```file:```. Files prefixed with ```file:///``` will be ignored.

### Notifications support

Using the [notifications module][notifications-module] is optional. To start
using it, an initialisation is required:

```
EWE.notifications.start();
```

### One Click Allowlisting support

To enable One Click Allowlisting, you need to set the list of
authorized public keys that can be used to authenticate allowlisting
requests.

```
EWE.allowlisting.setAuthorizedKeys(keys);
```

See the [allowlisting module][allowlisting-module] docs for more
detail.

New keypairs can be created with the correct algorithm and settings by
using our keypair creation script.

```
npm run create-allowlisting-keypair
```

See the Development section below for details on running our scripts
and other EWE development tasks. Keys can also be generated using
other programs like OpenSSL. The keys use the RSASSA-PKCS1-v1_5
algorithm, SHA512 hash and 4096 bit long modulus. Additionally, when
passed to `setAuthorizedKeys`, the keys should be base64 encoded
strings, in SPKI format.

<div class="no-docs">

## Documentation

For more information, please refer to the [API documention][docs].

## Development

### Prerequisites

- Node >= 16.10.0
- npm >= 7

### Installing/Updating dependencies

    npm install

### Building the library

    npm run build

#### Custom builds

As webpack is our build tool of choice, any [webpack command line options](https://webpack.js.org/api/cli/) can be used.

    # Build only sdk, no test extensions
    npm run build -- --config-name sdk

    # Don't generate any sourcemaps
    npm run build -- --no-devtool

#### Release builds

By default, debug builds are created. If building the library to be used
in another project you would want to create a release build.

    npm run build -- --env release

### Building the documentation

    npm run docs

### Linting the code

    npm run lint

### Building and watching for changes

    npm start

## Testing

### Serving the test pages

Regardless of whether you're manually loading the test extension, or using
the test runner, the test suite requires locally served test pages.

    npm run test-server

### Using the test extension

The test extension will be built on both `/dist/test-mv2` and `/dist/test-mv3`
folders, which can be loaded as unpacked extensions under `chrome://extensions`
in Chromium-based browsers, and under `about:debugging` in Firefox.
Once the extension is loaded, it opens the test suite in a new tab.

Notes:
- `test-mv2` contains a manifest version 2 extension, and `test-mv3`
contains a manifest version 3 extension.
- `test-mv2-custom` contains a manifest version 2 extension using custom (test) subscriptions.
- For the popup tests to work, you have to disable the browser's
built-in popup blocking (on `localhost`).

You can also inspect the extension's background page to manually test the API
through the global `EWE` object.

#### Test options

- The `timeout` option overrides the per-test timeout in milliseconds.
- The `grep` option filters the tests to run with a regular expression.

### Using the test runner

    npm test -- {v2|v3|v2-custom} {chromium|firefox|edge} [version|channel] [options]

Runner [options](#test-options) need to be preceded by two dashes (`--`), for
example `--timeout 10000`.

Edge tests can be also performed on Docker, to achieve that run
following commands:

    docker build  --no-cache -t webext -f test/dockerfiles/Dockerfile .
    docker run -it webext  

### Building ABPUI extension and running testpages tests
If there are no breaking changes in webext code, you will be able to build
ABPUI extension with current codebase. To build custom extension on Docker use following command: 

    docker build -t testpages  -f test/dockerfiles/testpages.Dockerfile . 


To run testpages automated tests on Docker, build testpages image with command above and: 

    docker run --shm-size=256m -it testpages               

To copy custom extension from Docker image after tests were run, run following commands: 

    IMAGE_ID=$(docker ps -aqf ancestor=testpages)
    docker cp $IMAGE_ID:/adblockpluschrome.zip . 

Note: Tests by default will skip `Snippets` tests, as extension built with Docker 
won't support snippets. You can exclude other tests by passing TESTS_EXCLUDE argument f.ex:

    docker run --shm-size=256m -e TESTS_EXCLUDE="Snippets|CSP|Header" -it testpages

Firefox (latest) is the default browser. Other browsers can be run using the
BROWSER argument:

    docker run -e BROWSER="Chromium \(latest\)" -it testpages

</div>

[abpcore]: https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore
[abpui]: https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui
[builds]: https://gitlab.com/eyeo/webext/webext-sdk/-/jobs/artifacts/master/browse/dist?job=build
[snippet-filters]: https://help.eyeo.com/adblockplus/snippet-filters-tutorial
[snippets-project]: https://gitlab.com/eyeo/adblockplus/abp-snippets
[docs]: https://gitlab.com/eyeo/webext/webext-sdk/-/jobs/artifacts/master/file/docs/index.html?job=build
[dev]: https://gitlab.com/eyeo/webext/webext-sdk#development
[notifications-module]: https://gitlab.com/eyeo/webext/webext-sdk/-/jobs/artifacts/master/file/docs/index.html?job=build#notifications
[allowlisting-module]: https://gitlab.com/eyeo/webext/webext-sdk/-/jobs/artifacts/master/file/docs/index.html?job=build#allowlisting

### Bundle test

Checks that the bundled code can be imported and re-bundled

    npm run test-bundle

### Custom subscriptions list

The default provided subscriptions can be overridden by adding a file called `custom-subscriptions.json` in the root of
this project's directory and then using the following command:
`npm run subs-merge -- [-a] [-i ...] -o $(pwd)/custom-subscriptions.json` to merge the files.

Note the following:
* use `-a` argument to add the default subscriptions file to the list of input files if necessary
* use `-i` argument to add a file to the list of input files if necessary
* use absolute output file path (otherwise `node_modules/adblockpluscore` will be used as current dir)
* one can use `$(pwd)` on nix-based environments or `../../custom-subscriptions.json` for convenience
* `subs-merge` is a "forwarding" npm script that just calls according npm script from "adblockpluscore" dependency
  using `--prefix` argument
  
Examples:

* merge product-specific subscriptions file with default subscriptions:
```
    npm run subs-merge -- \
        -a \
        -i /tmp/product-subscriptions.json \
        -o $(pwd)/custom-subscriptions.json
```

* merge two subscriptions files:
```
    npm run subs-merge -- \
        -i /tmp/product-subscriptions.json \
        -i /tmp/language_en-subscriptions.json \
        -o $(pwd)/custom-subscriptions.json
```
