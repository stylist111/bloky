# eyeo's Web Extension Ad Blocking Toolkit

[![Contributor
Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](./CODE_OF_CONDUCT.md)

This is a library that provides integration of eyeo's [Ad Blocking Core][abpcore]
for Chromium and Firefox extensions (like [Adblock Plus][abpui]).

<div class="no-docs">

## Table of contents

* [Code of Conduct](#code-of-conduct)
* [Getting started](#getting-started)
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
  * [Functional tests](#functional-tests)
  * [Integration tests](#integration-tests)
  * [Non-functional tests](#non-functional-tests)
* [Manifest V3](docs/MANIFEST_V3.md)

</div>

## Code of Conduct

All contributors to this project are required to read, and follow, our
[code of conduct](./CODE_OF_CONDUCT.md).

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

### Building and watching for changes

    npm start

## Testing

### Unit tests

Some tests require mocking of production files.
Mocked files are generated right in the test with `mock(..)` or `cachedMock(...)` automatically.
However one can generate the mocked file passing the filename from `/sdk/api/` directory:

    npx webpack --config ./test/unit/mock/webpack.config.js --env filename="subscriptions.js"
    
Run the unit tests:

    npm run unittest

### Functional tests

#### Serving the test pages

Regardless of whether you're manually loading the test extension, or using
the test runner, functional test suites require locally served test pages.

    npm run test-server

#### Using the test extension

The test extension will be built on both `/dist/test-mv2` and `/dist/test-mv3`
folders, which can be loaded as unpacked extensions under `chrome://extensions`
in Chromium-based browsers, and under `about:debugging` in Firefox.
Once the extension is loaded, it opens the test suite in a new tab.

Notes:
- `test-mv2` contains a manifest version 2 extension, and `test-mv3`
contains a manifest version 3 extension.
- `test-mv2-custom` contains a manifest version 2 extension using custom (test)
subscriptions.
- For the popup tests to work, you have to disable the browser's
built-in popup blocking (on `localhost`).

You can also inspect the extension's background page to manually test the API
through the global `EWE` object.

##### Test options

- The `timeout` option overrides the per-test timeout in milliseconds.
- The `grep` option filters the tests to run with a regular expression.
- The `incognito` checkbox is used to inform the tests whether the
browser started in incognito/private mode or not. This does not cause
tests to run in incognito mode.
- The `testKinds` option is used to run only a certain subset of the
functional tests. For example, you can target only the service worker
fuzzing tests by running `--testKinds fuzz`, or a combination of the
functional, reload and update tests by running tests with
`--testKinds functional reload update mv2-mv3-migrate`.

#### Using the test runner

```
npm test -- {v2|v3|v2-custom} {chromium|firefox|edge} [version|channel] [options]
```

Runner [options](#test-options) need to be preceded by two dashes (`--`), for
example `--timeout 10000`.

In the test runner context, the `--incognito` flag forces the browser to start
in incognito/private mode. This is only supported by Firefox.

##### Using the test runner on docker

The CI/CD pipeline runs the functional tests using [this docker image](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/blob/master/test/dockerfiles/functional.Dockerfile).
Using docker locally to run the same tests may be useful to recreate the
infrastructure the CI uses:

```
docker build -t functional -f test/dockerfiles/functional.Dockerfile .
docker run --shm-size=512m -e TEST_PARAMS="{v2|v3|v2-custom} {chromium|firefox|edge}" -it functional
```

Please notice that the `TEST_PARAMS` argument can also take the additional
options described previously.

##### Tip: Matching CI system resources

The following resources setup on a local macOS Docker installation has
proven to be close enough to the [Gitlab linux shared
runners](https://docs.gitlab.com/ee/ci/runners/saas/linux_saas_runner.html)
behaviour:

- CPUs: 1
- Memory: 1.75 GB
- Swap: 1.5 GB

This can also by done by adding the flags `--cpus=1 --memory=3.75g` to `docker run`.

```
docker run --cpus=1 --memory=3.75g {other flags as above}
```

##### Tip: Maintaining browser cache

Note: This works only on linux machines.
If you have a slow internet connection or are running the test many
times, you can add the following flags to `docker run` to use the
browser download cache from the host machine.

```
-v $(pwd)/browser-snapshots:/webext-sdk/browser-snapshots
```

##### Tip: Testing flaky tests

Flaky tests in our CI pipelines are annoying because they don't fail
or succeed every time. To help in measuring if a fix improves these,
you can run the `measureTestFlakiness` test to see the percentage of
test runs that fail.

```
npm run measureTestFlakiness
```

This script has various options to tweak how many runs to do, which
tests to run, or the docker options to use. You can run the script
with the `--help` option for a list of options.

```
npm run measureTestFlakiness -- --help
```

### Integration tests

#### Building ABPUI extension and running testpages integration tests

If there are no breaking changes in the code, you will be able to build
ABPUI extension with current codebase. To build and extract the custom extension
on Docker run the following commands:

```
docker build -t extension -f test/dockerfiles/extension.Dockerfile .
docker run extension
docker cp $(docker ps -aqf ancestor=extension):/extension .
```

The extension code uses the most recently released ABPUI Tag by default.

`extension` folder will contain two versions: mv2 and mv3.

To run testpages integration tests on Docker with the custom extension previously
created, you may clone the [Testpages project](testpages-project) and follow
the instructions on [how to run tests with packed extensions](https://gitlab.com/eyeo/adblockplus/abc/testpages.adblockplus.org#packed-extensions). Example:

```
cd testpages.adblockplus.org
cp <location/to/extension/> .
docker build -t testpages --build-arg EXTENSION_FILE="extension/extensionmv<2|3>.zip" .
docker run --shm-size=512m -e SKIP_EXTENSION_DOWNLOAD="true" -e GREP="^.*$BROWSER((?!Snippets).)*\$" testpages
```

Note: At the moment the custom extension won't support snippets. That's why it
is recommended to [use the GREP parameter](https://gitlab.com/eyeo/adblockplus/abc/testpages.adblockplus.org#grep)
to exclude those tests. On a `zsh` shell (default for MacOS), the `!` symbol
from the example above needs to be escaped (`\!`).

</div>

[abpcore]: https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore
[abpui]: https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui
[builds]: https://gitlab.com/eyeo/webext/webext-sdk/-/jobs/artifacts/master/browse/dist?job=build
[snippet-filters]: https://help.eyeo.com/adblockplus/snippet-filters-tutorial
[snippets-project]: https://gitlab.com/eyeo/adblockplus/abp-snippets
[docs]: https://eyeo.gitlab.io/adblockplus/abc/webext-sdk/master/docs/
[dev]: https://gitlab.com/eyeo/webext/webext-sdk#development
[notifications-module]: https://eyeo.gitlab.io/adblockplus/abc/webext-sdk/master/docs/#notifications
[allowlisting-module]: https://eyeo.gitlab.io/adblockplus/abc/webext-sdk/master/docs/#allowlisting
[testpages-project]: https://gitlab.com/eyeo/adblockplus/abc/testpages.adblockplus.org

### Non-functional tests

#### Bundle test

Checks that the bundled code can be imported and re-bundled

    npm run test-bundle

#### Scripts test

    npm run test-scripts

## Manifest V3

See [docs/MANIFEST_V3.md] for documentation specific to Manifest V3.
