# eyeo's Web Extension Ad Blocking Toolkit

[![Contributor
Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](./CODE_OF_CONDUCT.md)

This is a library that provides integration of eyeo's Ad Blocking Core
for Chromium and Firefox extensions (like [Adblock Plus][abpui]). The Ad
Blocking Core is in the `core` directory. See the content of that directory
for further information.

<div class="no-docs">

## Table of contents

* [Code of Conduct](#code-of-conduct)
* [Getting started](#getting-started)
  * [Supported browsers](#supported-browsers)
  * [Manifest for V2](#manifest-for-v2)
  * [Manifest for V3](#manifest-for-v3)
  * [API](#api)
  * [Module bundlers (optional)](#module-bundlers-optional)
  * [Snippet filters support](#snippet-filters-support)
  * [Shared resources](#shared-resources)
  * [Notifications support](#notifications-support)
  * [One Click Allowlisting support](#one-click-allowlisting-support)
* [Documentation](#documentation)
* [Development](#development)
  * [Prerequisites](#prerequisites)
  * [Installing/Updating dependencies](#installingupdating-dependencies)
  * [Building the library](#building-the-library)
  * [Building the documentation](#building-the-documentation)
  * [Linting the code](#linting-the-code)
* [Testing](#testing)
* [Events](#events)
* [Supporting Manifest V3](#manifest-v3)

</div>

## Code of Conduct

All contributors to this project are required to read, and follow, our
[code of conduct](./CODE_OF_CONDUCT.md).

## Getting started

The library comes in two parts, `ewe-api.js` to be included in the extension's
background page, and `ewe-content.js` to be loaded as a content script. Please
download the [latest build][builds] (or [build the library yourself][dev]).

With two versions of the API, Manifest V2 and Manifest V3, there are
two different manifest that are needed depending on which API you
target.

### Supported browsers

The webext-sdk is tested on the following minimum versions:

Manifest V2:

- Chromium 77
- Firefox 68
- Edge 79

Manifest V3:

- Chromium 109
- Edge 108

### Manifest for V2

For Manifest V2, the extension's `manifest.json` is required to
include the following configuration:

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

### Manifest for V3

For Manifest V3, the extension's `manifest.json` is required to
include the following configuration:

```
{
  "manifest_version": 3,
  "background": {
    "service_worker": "background.js"
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
    "declarativeNetRequestWithHostAccess",
    "declarativeNetRequestFeedback",
    "scripting",
    "storage",
    "tabs",
    "webNavigation",
    "webRequest",
    "unlimitedStorage"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "declarative_net_request": <output from "subs-generate" script>
}
```

The example above requires a couple of changes and can't be used
as-is.

The `service_worker` value needs be set to your built file for the
background script, that includes `ewe-api.js`.

Please note that for the sample above, you need to make sure to set
the value of `declarative_net_request` properly, [as shown in the
decalrativeNetRequest
documentaion](https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#manifest). This mean you also need to add to your extension build the files that contains the rulesets declared in this section, as well as the text filter lists. Refer to [the Manifest V3 documentation](docs/MANIFEST_V3.md) for more details.

The permission `declarativeNetRequestWithHostAccess` requires the
`host_permissions` to be `<all_urls>`. You could use the
`declarativeNetRequest` permission without setting
`host_permissions`. But it would have the effect of preventing the
filtering of content and limiting the blocking to network requests to
those specified in `host_permissions`. The default configuration
provided offers the most functionality.

### API

The API will be available in your own background scripts through the
global `EWE` object. Please call `EWE.start()` to start blocking ads.

Note that in MV3 extensions, `EWE.start()` must be called in the first
turn of the event loop so that it can attach event listeners.

### Module bundlers (optional)

`ewe-api.js` is built as a UMD module (Universal Module Definition),
and so it can also be used with module bundlers.

If using a module bundler **do not** add `ewe-api.js` to your `manifest.json`.
Consequently, there won't be a global `EWE` object.

#### CommonJS

```
const EWE = require("@eyeo/webext-sdk");
EWE.start();
```

#### ESM

```
import * as EWE from "@eyeo/webext-sdk";
EWE.start();
```

### Snippet filters support

In order to enable support for [snippet filters][snippet-filters] you have to get
the [snippets library][snippets-project] separately and make it available to `EWE`:

```
import isolatedCode from "mv3.isolated.mjs";
import injectedCode from "mv3.injected.mjs";
EWE.snippets.setLibrary({isolatedCode, injectedCode});
```
Note `mv3...` artifacts are required to be used for both MV2 and MV3.

The integration of the machine learning models is expected to be done by clients
of the snippet library.

### Shared resources

There are some shared resources that are used by both webext-sdk & production code:
- `browser`
  - Global is set by webextension-polyfill version 0.8.0.
- `browser.runtime.connect()`/`browser.runtime.onConnect`
  - Channel name is prefixed with "ewe:".
- `browser.runtime.sendMessage()`/`browser.runtime.onMessage`
  - Our messages are objects with a "type" property whose value is prefixed with "ewe:".
- `indexedDB.open()`
  - Database name is prefixed with "EWE".
- Web page links
  - Links used by module are prefixed with "abp:" or "https://subscribe.adblockplus.org/".
- `browser.storage.local` and `browser.storage.session`
  - Storage keys are prefixed with either "ewe:" or "abp:pref:".

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

    npm run create-allowlisting-keypair

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

### Tested Browsers 

webext-sdk CI pipeline currently perform automated tests on following versions:
- Manifest v2: Chromium: 77 - 109
- Manifest v3: Chromium 109
- Firefox: 68 - 109
- Edge v3 (linux): 108
- Edge v2 (windows): 79 

### Prerequisites

- Node >= 16.10.0
- npm >= 7

### Installing/Updating dependencies

    npm install

### Building the library

    npm run build

#### Custom builds

Our build script is a CLI program with a few additional flags that can
be passed to it. It can list the options available if you ask for
`--help`.

```
npm run build -- --help
```

There are some specific flags which might be useful to customise the
build:

```
# Build only sdk, no test extensions
npm run build -- --config-name sdk

# Don't generate any sourcemaps
npm run build -- --no-devtool
```

In the background, this script is using Webpack. You can also see the
[webpack command line options](https://webpack.js.org/api/cli/) for
further information on these flags.

##### Managing Bundled Subscriptions in the test build

In MV3 extensions (and the MV3 test extension), subscriptions are
bundled statically at build time. The bundled subscriptions are based
on [the custom subscriptions
file](./test/scripts/custom-mv3-subscriptions.json). Bundled
subscription are updated by the build script if this file changes.

One case to look out for when working with bundled subscriptions in
tests is that subscriptions are NOT re-fetched if their filters have
changed. If you need to re-fetch new filters and the list of
subscriptions hasn't changed, you can use the
`--force-subscription-update` flag to the build script.

```
npm run build -- --force-subscription-update
```

##### Using your own test-server instance

By default, the build script will start up the test server for
updating bundled subscriptions. If you prefer to use a test server
which is already running, you can use the `--use-external-server`
flag.

```
npm run test-server&
npm run build -- --use-external-server
```

#### Release builds

By default, debug builds are created. If building the library to be used
in another project you would want to create a release build.

```
npm run build -- --env release
```

### Building the documentation

    npm run docs

### Linting the code

    npm run lint


</div>

[builds]: https://gitlab.com/eyeo/webext/webext-sdk/-/jobs/artifacts/master/browse/dist?job=build
[snippet-filters]: https://help.eyeo.com/adblockplus/snippet-filters-tutorial
[snippets-project]: https://gitlab.com/eyeo/adblockplus/abp-snippets
[docs]: https://eyeo.gitlab.io/adblockplus/abc/webext-sdk/master/docs/
[dev]: https://gitlab.com/eyeo/webext/webext-sdk#development
[notifications-module]: https://eyeo.gitlab.io/adblockplus/abc/webext-sdk/master/docs/#notifications
[allowlisting-module]: https://eyeo.gitlab.io/adblockplus/abc/webext-sdk/master/docs/#allowlisting

## Events

The library provides the listeners to observe the events:
* `EWE.allowlisting.onUnauthorized`: Emitted when an allowlisting request is rejected
* `EWE.filters`:
  * `onAdded`: Emitted when a new filter is added
  * `onChanged`: Emitted when a filter is either enabled or disabled or metadata changed
  * `onRemoved`: Emitted when a filter is removed
* `EWE.subscriptions`:
  * `onAdded`: Emitted when a new subscription is added
  * `onChanged`: Emitted when any property of the subscription has changed
  * `onRemoved`: Emitted when a subscription is removed
* `EWE.debugging.onLogEvent`: Emitted when having debug output
* `EWE.reporting.onBlockableItem`: Emitted when any blockable item is matched

Use `addListener(...)` to subscribe and `removeListener(...)` to unsubscribe.

<div class="no-docs">
## Manifest V3
</div>

<div class="no-docs">
See [the Manifest V3 documentation](docs/MANIFEST_V3.md) for further
explanations.
</div>


## Testing 

For full documentation about testing please refer to our [testing document](./docs/TESTING.md).