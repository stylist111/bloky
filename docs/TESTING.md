# eyeo's WebExtension Ad-Filtering Solution Testing

This project is automatically tested by unit, functional, integration and
performance tests:

- Unit tests check isolated functions at code level.
- Functional tests cover most of the functionality and run in a browser
environment.
- Integration tests check that the SDK integrates smoothly from an extension
  developer point of view.
- Performance tests check that SDK performance metrics do not degrade.

All test kinds run on the CI pipeline. They can also be executed on a local
development environment.

## Pipelines structure

The CI pipeline has the following stages:

- Build - stage where webextension-sdk is built, and tested statically by audit
and linting.
- [Unit](#unit-tests) - unit tests for both core & webext-sdk.
- [Functional tests](#functional-tests) - most extensive tests. It contains
functional tests on web bundles, scripts and functional tests on various
combinations of browsers and manifests. Note: the set of browsers varies for
branch master.
- [Fuzz Functional tests](#fuzz-functional-tests) - MV3 related service workers
tests based on functional suite. Runs a subset of the functional tests, while
suspending the service worker regularly to determine how the system behaves.
- [Compliance tests](#compliance-tests) - tests ensuring compliance between
eyeo's adBlocking products.
- [Integration tests](#integration-tests) - tests of the integration scripts.
- [Performance tests](#performance-tests) - measure the performance of the
engine.

## Unit Tests

### Unit:core

The engine contains a core repository responsible for the core ad-filtering
logic, which is tested at unit and browser levels. To run all core tests use
the following command from the top level directory:

```
npm run test:unit:core
```

Optionaly use a test path to run a single test module. Example:

```
npm run test:unit:core -- test/dnr.js
```

### Unit:webext

In webext we mostly use functional tests to make sure everything works.

Additionally, two specific areas lend themselves to unit tests.

1. For utilities in the `sdk/all` folder. These may be individual imported by
   users of the SDK, and should not depend on any browser-specific APIs, and so
   are good candidates for unit testing. These unit tests go in the
   `test/unit/all` folder.
2. When background API functionality gets complicated and when testing some
   specific state of the system is required. These unit tests go in
   `test/unit/background`, and mock browser API. On a high level all our tests
   and production code uses `browser.js`, which will either be the actual
   webextension polyfill or our unit tests mock based on our webpack config.

To run the webext unit tests use the following command:

```
npm run test:unit:webext
```

### Unit:scripts

To be able to use webext in extension integrator has to generate files
(containing f.ex subscriptions) using our scripts. To test if scripts work
properly use following command:

```
npm run test:unit:scripts
```

#### Mocking browser APIs

The mocked files used by the background unit tests are automatically generated
with `mock(...)`  and `cachedMock(...)` functions. It is also possible to
generate mocked files by passing the filename from the `/sdk/background/`
directory:

```
npx webpack --config ./test/unit/mock/webpack.config.js --env filename="subscriptions.js"
```

#### Run the unit tests

```
npm run unittest
```

## Functional tests

Next stage of testing focuses on the software’s reactions to various activities
rather than on the mechanisms behind these reactions.

### Run All Tests

```
npm run build-then-test -- {2|3} {chromium|firefox|edge}
```

This script runs the test server and the test suite. You can also run each of
these independentally using:

```
npm run test-server
npm run test:functional
```

In order to pass additional arguments, use the following syntax:

```
npm run build-then-test -- {2|3} {chromium|firefox|edge} --argName="{ARGUMENT}"
```

For example:

```
npm run build-then-test -- v3 chromium --grep="Test Name" 
```

### Func:bundle

Checks that the bundled code can be imported and re-bundled:

```
npm run test:bundle
```

### Functional tests on browsers

Most exhaustive tests on our pipeline testing webext-sdk integrated into
test-extension and by visiting various web pages (served by test-server).

Important: All linux tests are run on Docker, all Windows tests are run on
[Windows shared runners](https://docs.gitlab.com/ee/ci/runners/hosted_runners/windows.html)
on a pipeline.

For Chromium-based browsers a DNS mapping entry (webext.com, sub.webext.com, search.webext.com
and webext.co.uk to 127.0.0.1) is added to browser configuration for domains testing.

#### Serving the test pages on test-server

Regardless of whether you're manually loading the test extension, or using the
test runner, functional test suites require locally served test pages.
When running tests on Docker, the test-server is run automatically on Docker
container, no need to run it locally.

```
npm run test-server
```

#### Using the test extension

The test extension containing webext-sdk will be built on both `/dist/test-mv2`
and `/dist/test-mv3` folders, which can be loaded as unpacked extensions under
`chrome://extensions` in Chromium-based browsers, and under `about:debugging` in
Firefox. Once the extension is loaded, it opens the test suite in a new tab.

Notes:

- test-mv2 contains a manifest version 2 extension, and test-mv3 contains a
manifest version 3 extension.
- For the popup tests to work, you have to disable the browser's built-in popup
blocking (on localhost).

You can also inspect the extension's background page to manually test the API
through the global EWE object.

Please refer to [Test Options](#test-options) for more details about options you
can use on UI.

#### Using the test runner

For local runs you can trigger test runner to run tests you desire:

```
npm run test:functional -- {2|3} {chromium|firefox|edge} [version|channel] [options]
```

Runner options need to be preceded by two dashes (`--`), for example
`--timeout 10000`.

#### Test options

- The `timeout` option overrides the per-test timeout in milliseconds.
- The `grep` option filters the tests to run with a regular expression.
- The `incognito` checkbox is used to inform the tests whether the browser
started in incognito/private mode or not. This does not cause tests to run in
incognito mode.
- The `forceHeadful` checkbox is used to inform the tests whether the browser
started in headless mode or not. By default tests are run in headless mode for
Firefox and Chrome >111.
- The `testKinds` option is used to run only a certain subset of the functional
tests. For example, you can target only the service worker fuzzing tests by
running `--testKinds fuzz`, or a combination of the functional, reload and
update tests by running tests with
`--testKinds functional reload update mv2-mv3-migrate`.
- The `browserBinary` option allow to pass installed browser binary
to use custom versions. For example:
`npm run test:functional v3 chromium -- --browserBinary="/Users/user/Documents/repo/webext-sdk/browser-snapshots/chromium/chromium-darwin-x64-1097561/chrome-mac/Chromium.app/Contents/MacOS/Chromium"`
- The `verbose` option prints local test servers (admin and pages) requests

#### Web bundle regeneration

The tests for the web bundle blocking require a .wbn file. The one currently
used is provided in the tree. However, if it needs to be regenerated, there is
`test/tools/webbundle-builder.js` to be run from the top-level. The content is
fixed in the script, so simply re-running it shouldn't yield any difference.
It relies on the wbn module that will be installed as a development dependency.

### Tagging functional tests

Tags can be added to a test or a suite of tests to modify when the tests are
run and when they are skipped.

A tag is kebab-case identifier inside square brackets, for example `[mv2-only]`.

For example, a test which is tagged to run only in MV2 mode would be tagged like
so:

```js
it("logs blocking $header filter [mv2-only]", async function() {
  // test body here
});
```

Tags can also be added to `describe` descriptions to tag entire suites.

If multiple tags are applied to the same test, all are applied.

#### The tags and their functionality

- `[mv2-only]`: Only run this test when testing an MV2 extension.
- `[mv3-only]`: Only run this test when testing an MV3 extension.
- `[runner-only]`: Only run this test when the test is run using Selenium
  Webdriver (ie it is launched from the console using `npm test` script).
- `[flaky]`: Run this test when using the `ONLY_FLAKY="true"` option in the
  functional test docker container.
- `[fuzz]`: Run this test in the service worker fuzz tests. By default, tests
  are not run in the service worker fuzz tests, so only the subset selected with
  `[fuzz]` and `[fuzz-only]` are run.
- `[fuzz-only]`: Only run this test in the service worker fuzz tests.

All `-only` tags have an equivalent `-skip` tag, which does the opposite. For
example, a test tagged with `[mv2-skip]` will only be run when NOT testing an
MV2 extension.

## Fuzz Functional tests

One of the major changes that Google has introduced in Chrome with the Manifest
V3 browser extension API is background service workers. These replace background
pages as the only way to have an extension running a script in the background.

For the most part, this is fine. You can do most of the things we needed to do
in a background page in the new service worker.

However, there is one major difference: service workers are event driven and may
be suspended by the browser at any time the browser decides they are not in
use. From a testing perspective, this means that we need to test that our
functionality works even when it is triggered while the service worker is
currently suspended.

Rather than writing a whole separate suite of tests for this, we instead rerun a
subset of the functional tests, except before any interaction with the service
worker the service worker is suspended. These are referred to as the Fuzz tests.

### Tagging which tests should run as fuzz tests

We avoid running all of the functional tests in fuzz mode because suspending the
service worker is a slow process. This makes the fuzz tests take a long time.

We aim to run a representative subset of the functional tests based on the
impact of service workers. As a rule of thumb, include one "happy path" for each
distinct piece of functionality. For example, enable one fuzz test for adding a
filter, but then don't enable the tests for adding multiple filters at once or
any of the filter validation cases since they don't add any extra requirements
for the service worker to start up correctly.

Only the functional tests with the `[fuzz]` or `[fuzz-only]` tags in their
description are run during the fuzz tests.

Untagged tests are not run, but it is generally expected that they would pass if
they were enabled in the future.

The `[fuzz-skip]` tag can be applied to tests which are not expected to pass if
the service worker is suspended as part of running the test.

## Compliance tests

Compliance tests are performed on a local version of [testpages](https://abptestpages.org)
to assure compliance between webext and other eyeo adblocking solutions. They
run the automated tests developed on the testpages project using the engine test
extension. Snippets and Subscriptions tests are skipped due to extension
limitations.

## Integration tests

Integration tests checks if from integrator perspective (and directory)
everything will work fine. To run integration tests locally use the following
command:

```
./test/dockerfiles/integration-entrypoint.sh
```

## Performance tests

The performace of the engine is measured using
[lightnouse metrics](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring#metrics).

To run the performance tests:

```
npm run test:performance -- {2|3} {chromium|edge} [--forceHeadful]
```

Note: Firefox is not supported by the performance tests.

## Docker local runs

### Using the test runner on docker

The CI/CD pipeline runs the tests using this docker image. Using docker locally
to run the same tests may be useful to recreate the infrastructure the CI uses.

#### Unit:core

```
docker build -t basic -f test/dockerfiles/basic.Dockerfile .
docker run --cpus=2 --memory=6g --shm-size=2g -it --entrypoint npm basic run test:core -- [test/path]
```

#### Func:webext

```
docker build -t functional -f test/dockerfiles/functional.Dockerfile .
docker run --cpus=2 --memory=6g --shm-size=2g -it -e TEST_PARAMS="{2|3} {chromium|firefox|edge}" functional
```

Please notice that the TEST_PARAMS argument can also take the additional options
described previously.

#### Compliance

```
MANIFEST={mv2|mv3} ./test/scripts/compliance.sh
```

Optional environment variables for the script:

- TESTS_TO_INCLUDE
- BROWSER
- VERSION

#### Performance

```
docker build -t functional -f test/dockerfiles/functional.Dockerfile .
docker run --cpus=2 --memory=6g --shm-size=2g -it --entrypoint npm functional run test:performance {2|3} {chromium|edge}
```

In order to access the screenshots for failing tests run the following command,
which copies the screenshots to the `<destination>` folder:

```shell
docker cp $(docker ps -aqf ancestor=functional | head -n 1):/webext-sdk/test/screenshots <destination>
```

#### ARM architecture (M1/M2 Apple Silicon)

The previous examples assume an Intel/AMD architecture on the running machine.
On ARM architectures, the run is done emulating the AMD architecture.
Requirements:

- macOS >= 13 (Ventura)
- Rosetta

The `--platform` option should be used when running the image. Example:

```
docker run --platform linux/amd64 ...
```

### Maintaining browser cache

If you plan to work on one image by rerunning tests (f.ex to investigate
flakiness) you can download it to the docker image and cache it. To do so please
add the `BROWSER` argument to the build command as follow:

```
docker build -t functional -f test/dockerfiles/functional.Dockerfile --build-arg BROWSER=<chromium> .
```

For linux machines only: If you have a slow internet connection or are running
the test many times, you can add the following flags to docker run to use the
browser download cache from the host machine:

```
-v $(pwd)/browser-snapshots:/webext-sdk/browser-snapshots
```

## Flaky Tests

Flaky tests in our CI pipelines are annoying because they don't fail or succeed
every time. We’ve implemented process for reducing flakiness:

Currently our pipelines are not flaky and if any flaky test is spotted by a
developer, a high priority ticket should be immediately created.

![Flaky tests process](/docs/flaky_process.png "Flaky tests process")

### Investigating/fixing functional flaky tests

The best way of investigating flaky tests locally is using docker (instead of
`npm test`).

If you need to run specific tests multiple times to investigate/reproduce
flakiness, use the `[flaky]` tag in the name of the test, along with the
`ONLY_FLAKY` parameter set to `true`. Example:

```
docker run ... -e ONLY_FLAKY=true functional
```

The `TEST_RUNS` parameter allows running tests multiple times in a row, while
logging the amount of failures per test run. Example:

```
docker run ... -e TEST_RUNS=10 functional
```

Note: Combining both `ONLY_FLAKY` and `TEST_RUNS` parameters allows running only
tests marked as `[flaky]` multiple times in a row:

```
docker run ... -e ONLY_FLAKY=true -e TEST_RUNS=10 functional
```

### Tips for debugging failing/ flaky tests

If job is failing on the pipeline but works on docker on your machine check first
if you test on:

- same browser & same browser version,
- same manifest version,
- you rebuild docker image,
- you use same operating system or VM or container,
- you use same set of tests (running isolated tests might behave differently).

If you still experience failing tests on pipelines while you have tests passing
locally on Docker. You can try to raise shared runner resources by adding tag
to the job that is failing:

```

func:v2:chromium:latest:
  tags: [ saas-linux-large-amd64 ]

```

This way you can check if there might be wrong architecture of the tests (race conditions
static timeouts, etc).

If tests are failing due to timeouts (of the tests or `wait()`), add `console.log()`
in each step of the test to see where test starts to "hang" and investigate
this step.

#### Code tracing to analyze flaky tests reasons

Import `info()`, `log()`, `warn()`, `error()` or `trace()` from
`sdk/background/debugging.js` to record that is happening in the solution and
make it printed in the console when a test fails:

```
import {trace} from "./debugging.js";
...
function onBeforeNavigate(details) {
  trace({details});
...
```

Use callback to avoid logging performance penalty if having no `EWE.debugging.onLogEvent`
listeners:

```
...
debug(() => `Some message with a long ${variable} that takes too much of CPU and memory`));
...
```

By default debug output is enabled in test web extension and it can be changed with
`EWE.testing.enableDebugOutput()` call.

### Checking your tests quality on a pipeline

If you need to debug specific flaky tests on the pipeline, add [flaky] to the
tests you want to run & then add `[flaky]` to the commit message.
This will trigger pipeline that will run only tests marked flaky in tests.

You can also use UI to trigger "check tests quality jobs" on the branch you
are working on.
This will trigger "measure flakiness" scripts & check that will run
test modules in isolation:

- Go to: <https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/pipelines>
then press “Run pipelines”.
- Select branch you want to run pipeline on
- Provide variable: CHECKTESTS: true
- Provide variable FULL: true if you wish to run full set of browsers (as on
master)
- Run pipeline

![Run pipeline](/docs/run_pipeline_ui.png "Run pipeline from UI")

Note: this setup is run on master on our Nightly Runs - checking if our
tests are good quality (no flaky and independent from each other)

You can also use our [webext sdk cheat sheet](TESTING_CHEAT_SHEET.md) for short
version of commands commonly used by webext devs.

### Functional Isolated Tests

Isolated tests run the tests one-by-one, which prevents them potentially intefering
with each other if they are run concurrently.

To run test suites locally in isolation, run the following docker commands:

```
docker build -t functional -f test/dockerfiles/functional.Dockerfile .
docker run --cpus=2 --memory=6g --shm-size=2g -it -e TEST_SUITES="suite_1 suite_2" -e TEST_PARAMS="v3 chromium" --entrypoint test/dockerfiles/isolated-entrypoint.sh functional
```
