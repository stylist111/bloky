# Adblock Plus

Welcome to the repository for the Adblock Plus extension!

The main project is hosted on [GitLab][ext] and, in addition to the user
interface and the web extension code, the Adblock Plus extension also includes
[static filter lists][eyeo-filterlists],
[eyeo's Web Extension Ad Blocking Toolkit (EWE)][eyeo-ewe] and
[eyeo's snippets][eyeo-snippets].

- [About Adblock Plus](#about-adblock-plus)
- [Running the scripts](#running-the-scripts)
- [Building](#building)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Publishing](#publishing)

## About Adblock Plus

Adblock Plus is a free extension that allows users to customize their web
experience. Users can block annoying ads, disable tracking and lots more. It’s
available for all major desktop browsers and for mobile devices.

Adblock Plus is an open source project licensed under [GPLv3][gpl3] and subject
to its [Terms of Use][eyeo-terms]. [eyeo GmbH][eyeo] is the parent company of
Adblock Plus.

## Running scripts

Please note that all scripts should be run from the root of the repository, not
this host folder.

## Building

See the [readme at the root of the monorepo](../../README.md) for general
instructions on prerequisites, dependency management, how to build the
extensions.

### Building with secrets

Copy the `.env.defaults` file in the `host/adblockplus` directory to a `.env`
file and fill in the variables accordingly. This step can be skipped, and is
only required if you wish to enable the sending of telemetry.

### Bundling the UI

Various files need to be generated before using the UI. When building the UI
for inclusion in the extension, this is achieved using
`npm run dist -w adblockplus` from the root folder (not this host folder).

For usage [in the test environment](#testing), run the
[`build`](../../README.md#building-the-extensions-in-development-mode) script to
generate the various bundles for all [UI elements](#ui-elements).

Beyond that, this repository contains [various utilities][wiki-utils] that we
rely on across our development process.

### Error reporting

We use [Sentry](https://sentry.io/) to report the errors. In order to initialize it
during the build one has to pass `SENTRY_DSN` and `SENTRY_ENVIRONMENT`
variables in either `.env` file or as environment variable during the (CI) build. If not
initialized, console warning is shown. By default `SENTRY_ENVIRONMENT=production`.
User emails are cut on client side and data scrubbing on
[server side](https://docs.sentry.io/security-legal-pii/scrubbing/server-side-scrubbing/) is
configured by default.

If testing Sentry reporting locally, ensure that
`SENTRY_ENVIRONMENT=development`. You may also need to temporarily modify
`core/sdk/src/background/sentry.js` to override the
`sampleRate` to ensure that more of your test error events get through. A
`sampleRate` of `1` will report all error events to Sentry.

## Testing

If you don't want to build the entire extension, you can open UI pages in a test
environment using a local web server. This should be run from the root of the
monorepo.

```sh
npm run build
npm run -w adblockplus build:local
npm start -w adblockplus
```

After running `npm start -w adblockplus`, you can access the HTML
pages under the URL shown in the terminal, e.g. http://127.0.0.1:8080.

Various aspects of the pages can be tested by setting parameters in the URL (see
[list of URL parameters](docs/test-env.md#url-parameters)).

**Note**: You need to [create the bundles](#bundling-the-ui) for the UI page(s)
that you want to test.

### Unit tests

The `./test/unit` folder contains various mocha unit tests files
which can be run via `npm run $ test.unit.legacy -w adblockplus`.
For `.ts` files we have jest unit tests that can be run via
`npm run $ test.unit.love -w adblockplus`. Those can be run
together via `npm test -- --scope adblockplus`.

### End-to-end tests

End-to-end tests load the release build of the Adblock Plus extension in the
browser to run the end to end test suites.

Notes:

- Release builds are needed for both local and Docker runs. The commands for
  that are added to the examples.
- Commands given below should be run from the root directory of this
  repository, the same as the build commands.
- The browser specified in the command is the browser that tests will be run
  on, not the browser that we specify in build step.
- DNS mapping from `testpages.eyeo.com` to `127.0.0.1` is used in
  browsers in order to test with locally served pages and AA-related filter
  rules.
- Eyeometry tests require eyeometry credentials filled in `.env`.
- Extension functionality meant exclusively for testing is located in ./src/testing/.

#### Local run

To run the end-to-end tests locally:

```sh
npm run build:release -- --scope=adblockplus
npm run test:end-to-end -- --scope=adblockplus -- {chromium|chrome|edge|firefox} {2|3}
```

Changing the default behaviour:

- Setting the environment variable `FORCE_HEADFUL=true` will trigger a headful
  run instead of headless.
- Setting the environment variable `BROWSER_VERSION={version|channel}` will use
  a different browser version (default is "latest"). See
  [get-browser-binary](https://gitlab.com/eyeo/developer-experience/get-browser-binary)
  for supported versions and channels.

Mocha [command line options](https://mochajs.org/#command-line-usage) are also
supported. Example:

```sh
BROWSER={chromium|chrome|firefox|edge} MANIFEST_VERSION={2|3} npm run -w adblockplus test:end-to-end-local -- --grep "Smoke"
```

Screenshots for failing tests are stored in `host/adblockplus/test/end-to-end/screenshots`.

#### Docker run

Prerequisites: Docker

```sh
npm run build:release -- --scope=adblockplus
docker build -t end-to-end -f host/adblockplus/test/end-to-end/Dockerfile .
docker run --shm-size=2g -it -e BROWSER={chromium|chrome|firefox|edge} -e MANIFEST_VERSION={2|3} end-to-end
```

To use mocha command line options or a non-default browser version the
`--entrypoint` parameter needs to be set. Example:

```sh
docker run --shm-size=2g -it -e BROWSER={chromium|chrome|firefox|edge} [-e BROWSER_VERSION={version|channel}] -e MANIFEST_VERSION={2|3} --entrypoint npm end-to-end run -w adblockplus test:end-to-end-local -- --grep "Smoke"
```

To access the screenshots for failing tests run the following command, which
copies them to the `host/adblockplus/test/end-to-end/screenshots` folder:

```shell
docker cp $(docker ps -aqf ancestor=end-to-end | head -n 1):/extensions/host/adblockplus/test/end-to-end/screenshots ./host/adblockplus/test/end-to-end
```

#### Deprecated webdriverIO tests

Old tests using WebdriverIO were removed in February 2025. However, they can still be accessed via the following git tag: [abp-wdio-e2e-removal](https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/tags/abp-wdio-e2e-removal).

### Compliance tests

Compliance tests run on a local version of [testpages](https://abptestpages.org)
to assure compliance between Adblock Plus and other eyeo adblocking solutions.
They run the tests from the [testpages project](https://gitlab.com/eyeo/developer-experience/testpages.adblockplus.org/)
using a local build of the Adblock Plus extension.

Prerequisites:

- Docker

To run the tests:

```sh
EXTENSION=host/adblockplus/dist/release/<build file> MANIFEST={mv2|mv3} ./host/adblockplus/test/compliance.sh
```

Optional environment variables:

- BROWSER: Browser and version to run. The default is "chromium latest".
- IMAGE_NAME: Name of the docker container. The default is "compliance".

### Linting

You can lint all files via `npm run lint` or lint only specific file types:

- Translation files: `npm run -w adblockplus $ lint.locale`

The following can help fix issues:

- JavaScript/TypeScript: `npm run lint-fix`

## CI pipeline

The project uses Gitlab CI to run pipelines which contain build and test jobs.

### Runners

Pipeline jobs use self-managed runners from Google Cloud Platform (GCP). The
the setup of the runner is defined in [the devops runner project](https://gitlab.com/eyeo/devops/terraform/projects/gitlab-runners/terraform-adblock-inc-runner/), and the runner status can be checked
[here](https://gitlab.com/groups/adblockinc/ext/-/runners). Access to GCP
resources like the GCloud console can be granted by devops as well.

## Monitoring

For monitoring the overall health of the extension, use [eyeo's internal
extension health dashboard][hex-ext-health].

## Publishing

The Adblock Plus extension is published to various extension stores according to
the [host release process][wiki-release-process].

### Uploading sourcemaps to Sentry

The gitlab CI configuration has `release` stage and `upload_sourcemaps` job
which is runs for tags like `adblockplus-<number>` and uploads the releases sourcemaps to Sentry.
It requires `SENTRY_AUTH_TOKEN` global variable configured for the project.
To do the same manually on the command line one has to:

1. Login to Sentry with `npm run sentry:login` and provide Sentry auth token.
2. Create a release with `VERSION=<version> npm run sentry:release-new`
3. Prepare unzipped file:

```
mkdir ./dist/release/sourcemaps-mv3
&& unzip dist/release/adblockplus-chrome-*-mv3.zip -d ./dist/release/sourcemaps-mv3
```

4. Upload the sourcemaps with `VERSION=<version> npm run sentry:sourcemaps`.
   The sourcemaps are overwritten.
5. Finalize the release with `VERSION=<version> npm run sentry:release-finalize`

### Release history

[Extension releases (since 3.11)][ext-tags-abp]

[Extension releases (prior to 3.11)][abpchrome-tags]

[abpchrome-tags]: https://gitlab.com/eyeo/adblockplus/adblockpluschrome/-/tags
[ext]: https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions
[ext-tags-abp]: https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/tags?sort=updated_desc&search=adblockplus-
[eyeo]: https://eyeo.com/
[eyeo-ewe]: https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution
[eyeo-filterlists]: https://gitlab.com/eyeo/filters/filterlists
[eyeo-snippets]: https://gitlab.com/eyeo/snippets
[eyeo-terms]: https://adblockplus.org/terms
[gpl3]: https://www.gnu.org/licenses/gpl.html
[hex-ext-health]: https://eu.hex.tech/eyeo/app/Eyeo-Extension-Health-032QfyuottjWQzBZuQBKLm/latest
[ms-wsl]: https://docs.microsoft.com/windows/wsl/install-win10
[nodejs]: https://nodejs.org/en/
[npm]: https://www.npmjs.com/get-npm
[npx]: https://medium.com/@maybekatz/introducing-npx-an-npm-package-runner-55f7d4bd282b
[wiki-release-process]: https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/wikis/Host-release-process
[wiki-utils]: https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/wikis/utilities
