# eyeo's WebExtension Ad-Filtering Solution

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
  * [Required permissions and why we need them](#required-permissions-and-why-we-need-them)
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

The webext-ad-filtering-solution (as a short term we use 'engine') is tested on
the following versions:

Manifest V2:

* Chromium 77 and latest
* Firefox 68 and latest
* Edge latest

Manifest V3:

* Chromium 124 and latest
* Edge latest

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
    "storage",
    "unlimitedStorage",
    "tabs",
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
    "declarativeNetRequest",
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
documentation](https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#manifest).
This mean you also need to add to your extension build the files that contains
the rulesets declared in this section, as well as the text filter lists. Refer
to [the Manifest V3 documentation](docs/MANIFEST_V3.md) for more details.

The permission `declarativeNetRequestWithHostAccess` requires the
`host_permissions` to be `<all_urls>`. You could use the
`declarativeNetRequest` permission without setting
`host_permissions`. But it would have the effect of preventing the
filtering of content and limiting the blocking to network requests to
those specified in `host_permissions`. The default configuration
provided offers the most functionality.

### Required permissions and why we need them

We require several permissions for the WebExt Ad-Filtering Solution to function
correctly. The manifest file templates above include the required permissions.
Here is why we need each one:

* `webNavigation`: Gives access to the Web Navigation API, which we use to
  apply document-level allowing filters and to block popups.
* `webRequest`: Gives access to the Web Request API. Used to apply URL filters
  in MV2, and to report on URL filters in MV3. Also used to retrieve sitekeys
  for a site.
* `webRequestBlocking` (MV2 only): Allows blocking request based on URL filters
  in MV2.
* `declarativeNetRequest` (MV3 only): Gives access to the Declarative Net
  Request API, which we use to apply URL filters in MV3.
* `storage`: Gives access to storage APIs, which we use to store downloaded
  subscriptions, user's custom filters, etc.
* `unlimitedStorage`: By default, extensions are only allowed 5MB of storage,
  which isn't enough for larger subscriptions. This permission removes that
  limit.
* `tabs`: Gives access to some tab metadata, including the tab's URL, which is
  used to apply document-level allowing filters to the tab.
* `scripting` (MV3 only): Used to apply content filters, including element
  hiding filters and snippet filters.
* `<all_urls>`: Allows the WebExt Ad-Filtering Solution to act on all websites.
  Note that in MV2 manifests this goes in the `permissions`, but in MV3
  manifests this goes in the new `host_permissions` section.

You can read more about browser extension permissions and their effects in
Google's docs for
[MV2 permissions](https://developer.chrome.com/docs/extensions/mv2/declare_permissions/)
and [MV3 permissions](https://developer.chrome.com/docs/extensions/mv3/declare_permissions/)

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
const EWE = require("@eyeo/webext-ad-filtering-solution");
EWE.start();
```

#### ESM

```
import * as EWE from "@eyeo/webext-ad-filtering-solution";
EWE.start();
```

### Snippet filters support

In order to enable support for [snippet filters][snippet-filters] you have to get
the [snippets library][snippets-project] separately and make it available to `EWE`:

```
import * as snippets from "@eyeo/snippets";
EWE.snippets.setLibrary({
  injectedCode: snippets.main,
  isolatedCode: snippets.isolated
});
```

The integration of the machine learning models is expected to be done by clients
of the snippet library.

### Shared resources

There are some shared resources that are used by both webext-ad-filtering-solution
& production code:

* `browser`
  * Global is set by webextension-polyfill version 0.8.0.
* `browser.runtime.connect()`/`browser.runtime.onConnect`
  * Channel name is prefixed with "ewe:".
* `browser.runtime.sendMessage()`/`browser.runtime.onMessage`
  * Our messages are objects with a "type" property whose value is prefixed with
    "ewe:".
* `indexedDB.open()`
  * Database name is prefixed with "EWE".
* Web page links
  * Links used by module are prefixed with "abp:" or "https://subscribe.adblockplus.org/".
* `browser.storage.local` and `browser.storage.session`
  * Storage keys are prefixed with either "ewe:" or "abp:pref:".

During initialization the engine migrates legacy data from
local storage to indexedDB. Files migrated have to be prefixed: ```file:```.
Files prefixed with ```file:///``` will be ignored.

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

For more information, please refer to the [API documention][api-docs].

## Development

### Prerequisites

* Node >= 18.16
* npm >= 9

### Installing/Updating dependencies

```
npm install
```

### Building the library

```
npm run build
```

### Running Locally (and watch for changes)

```
npx webpack --watch
```

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
# Build only engine, no test extensions
npm run build -- --config-name engine

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
file](./test/scripts/custom-subscriptions.json). Bundled
subscriptions are updated by the build script if this file changes.

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

```
npm run docs
```

### Linting the code

```
npm run lint
```

</div>

[builds]: https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/jobs/artifacts/master/browse/dist?job=build
[snippet-filters]: https://help.eyeo.com/adblockplus/snippet-filters-tutorial
[snippets-project]: https://gitlab.com/eyeo/adblockplus/abp-snippets
[api-docs]: https://eyeo.gitlab.io/adblockplus/abc/webext-ad-filtering-solution/#apis
[dev]: https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution#development
[notifications-module]: https://eyeo.gitlab.io/adblockplus/abc/webext-ad-filtering-solution/master/docs/#notifications
[allowlisting-module]: https://eyeo.gitlab.io/adblockplus/abc/webext-ad-filtering-solution/master/docs/#allowlisting
[abpui]:https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui

## Events

The library provides the listeners to observe the events:

* `EWE.allowlisting.onUnauthorized`: Emitted when an allowlisting request is rejected
* `EWE.filters`:
  * `onAdded`: Emitted when a new filter is added
  * `onChanged`: Emitted when a filter is either enabled or disabled or
     metadata changed
  * `onRemoved`: Emitted when a filter is removed
* `EWE.subscriptions`:
  * `onAdded`: Emitted when a new subscription is added
  * `onChanged`: Emitted when any property of the subscription has changed
  * `onRemoved`: Emitted when a subscription is removed
* `EWE.debugging.onLogEvent`: Emitted when having debug output
* `EWE.reporting.onBlockableItem`: Emitted when any blockable item is matched
* `EWE.cdp.onCdpItem`: Emitted when any CDP event happened

Use `addListener(...)` to subscribe and `removeListener(...)` to unsubscribe.

## Manifest V3

See [the Manifest V3 documentation](./docs/MANIFEST_V3.md) for further
explanations.

## Testing

For full documentation about testing please refer to our [testing document](./docs/TESTING.md).

## Typings

To provide an optimal DX to consumers of the SDK, we are generating typescript
type definitions from JSDoc.  
However when setting this up we noticed that the api had numerous type errors
and JSDoc syntax errors.  

So while typedef files are generated as part of the build script, they are not
exported in the package.json.  
First we want to fix the type errors found by typescript in the `/api` folder.
You can check errors by running `npm run types:check`, and generate the
typedefs by running `npm run types:generate`.  

To make the typedefs available to consumers of the SDK, add the following to
the package.json: `"types": "./dist/types/api/index.d.ts",` and run
`npm run build`.
