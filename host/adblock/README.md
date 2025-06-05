# AdBlock

## Intro

[AdBlock](https://getadblock.com/) is a popular ad blocking extension for Chrome,
Edge and Firefox.

## Requirements

This project requires [node.js](https://nodejs.org) and `npm` (which comes bundled with `node.js`).

The exact version requirements can be found in the [package descriptor file](package.json) under the `engines` field.

## Usage

## Running scripts

Please note that all scripts should be run from the root of the repository, not
this host folder.

## Building

See the [readme at the root of the monorepo](../../README.md) for general
instructions on prerequisites, dependency management, how to build the
extensions.

### Building with secrets

Copy the `.env.defaults` file in the `host/adblock` directory to a `.env` file
and fill in the variables accordingly. This step can be skipped, and is only
required if you wish to enable the sending of telemetry.

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

### Compliance tests

Compliance tests run on a local version of [testpages](https://abptestpages.org)
to assure compliance between AdBlock and other eyeo adblocking solutions. They
run the tests from the [testpages project](https://gitlab.com/eyeo/developer-experience/testpages.adblockplus.org/)
using a local build of the AdBlock extension.

Prerequisites:

- Docker

To run the tests from the root of the monorepo:

```bash
EXTENSION=<build file> ./host/adblock/test/compliance.sh
```

Optional environment variables:

- BROWSER: Browser and version to run. The default is "chromium latest".
- IMAGE_NAME: Name of the docker container. The default is "compliance".

### End-to-end tests

End-to-end tests load the release build of the AdBlock extension in the browser
to run the end to end test suites.

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

#### Local run

To run the end-to-end tests locally:

```sh
npm run build:release -- --scope=adblock
npm run test:end-to-end -- --scope=adblock -- {chromium|edge|firefox} {2|3}
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
BROWSER={chromium|firefox|edge} MANIFEST_VERSION={2|3} npm run --workspace host/adblock test:end-to-end-local -- --grep "Smoke"
```

Screenshots for failing tests are stored in `host/adblock/test/end-to-end/screenshots`.

#### Docker run

```sh
npm run build:release -- --scope=adblock
docker build -t end-to-end -f host/adblock/test/end-to-end/Dockerfile .
docker run --shm-size=2g -it -e BROWSER={chromium|firefox|edge} -e MANIFEST_VERSION={2|3} end-to-end
```

To use mocha command line options or a non-default browser version the
`--entrypoint` parameter needs to be set. Example:

```sh
docker run --shm-size=2g -it -e BROWSER={chromium|firefox|edge} [-e BROWSER_VERSION={version|channel}] -e MANIFEST_VERSION={2|3} --entrypoint npm end-to-end run -w host/adblock test:end-to-end-local -- --grep "Smoke"
```

To access the screenshots for failing tests run the following command, which
copies them to the `host/adblock/test/end-to-end/screenshots` folder:

```shell
docker cp $(docker ps -aqf ancestor=end-to-end | head -n 1):/extensions/host/adblock/test/end-to-end/screenshots ./host/adblock/test/end-to-end
```

## Code Style

We use a community code style enforced by [eslint](https://eslint.org) for JavaScript and [Prettier](https://prettier.io) for other files. Additionally, we use [HTMLHint](https://github.com/htmlhint/HTMLHint) for HTML accessibility and standards checking.

The following npm commands are then available:

- `npm run lint` runs all linters and prints out all violations.
- `npm run --workspace host/adblock eslint-fix` runs eslint and automatically fixes JavaScript style violations in place (be sure to commit before running this command in case you need to revert the changes eslint makes).
- `npm run --workspace host/adblock prettier` runs prettier on HTML, CSS, and JSON files in the adblock-betafish directory and list all files that need to be Prettier.
- `npm run --workspace host/adblock prettier-fix` runs prettier and automatically replaces with Prettier versions for HTML, CSS, and JSON files in the adblock-betafish directory.
- `npm run --workspace host/adblock html-hint` runs HTMLhint and flags any issues with the HTML templates such as missing `DOCTYPE`, tags and/or attributes. This does not run on pre-commits so it must be run manually. New AdBlock custom attributes should be added in `./rules/static/custom_attributes.json`. If mistakenly flagged, standard HTML attributes should be added in `./rules/static/aria_attributes.json` or `./rules/static/mapped_attributes.json`.

### Aliases

As we update the extension structure and add Typescript, we will find ourselves importing files from multiple levels within peer directories, as well as relocating files within a given subdirectory. To help make this easier, we have added a `~` shortcut, which maps to `adblock-betafish`.

This means that rather than needing to use `../` to navigate out of a file's directory, the import address can be given from the perspective of `adblock-betafish`. So an import like `from '../../id/background';` can be replaced with from `'~/id/background';`.

## Developer Guide

General guidelines for developing AdBlock specific code.

### Icons and Graphics

All graphics use SVG when at all possible. The current exception is the extension toolbar icon which is currently a PNG. There is work in progress to replace this image with SVG.

Icons use SVG web fonts. We primarily use [Material Design Icons](https://www.material.io/resources/icons/?style=baseline) and provide a few custom icons via the AdBlock Icons project. Standard markup to display the "settings" icon would be:

```html
<i class="material-icons">settings</i>
```

For <abbr title="Web Content Accessibility Guidelines">WCAG</abbr> compliance, we use <abbr title="Accessible Rich Internet Applications">ARIA</abbr> content to make the web icons accessible for screen readers. Read the [full description](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA24) for details, but a summary of the steps are:

- mark the web icon element using attribute `role="img"`
- if the web icon is purely visual, use `aria-hidden="true"`
- if the web icon is semantic, use `aria-label="Settings"` to provide the screen reader description of the icon.

An example of an icon used as a button:

```html
<i class="material-icons" role="img" aria-label="Extension settings">settings</i>
```

An example of an icon that "decorates" text and does not need to be read by the screen reader:

```html
<i class="material-icons" role="img" aria-hidden="true">check_circle</i> We are OK
```

### Accessibility

The following are notes for improving the accessibility of the AdBlock user interface.

#### Assistive Technologies

Assistive Technologies (<abbr>AT</abbr>) such as screen readers present the web content to users dramatically differently than the visual renderer.

It is important to optimize AT UX for "skipping" content. Important information should be presented first, followed by additional details. This allows the user to skip the reading of the detailed information if they are trying to navigate to particular sections of the UI.

AT use the HTML document structure and the semantic meaning associated with different HTML elements to assist in making content easy to understand. Many AT and their end users create custom stylesheets assigning different presentations (volumes, tone, etc) to different element types (i.e. `<h1>` elements may be spoken more loudly and with a deeper tone). Whenever possible use appropriate HTML elements to assist these stylesheets.

AT present the screen content as a "snapshot" of the content at the point in time when the element is visited. Dynamic content should carefully consider what the AT presentation should be when presented, and whether it's worth the distraction to the user when deciding if alerting the user of a change is desired. Content that should be dynamic should be marked the appropriate ARIA [live region roles](https://www.w3.org/TR/wai-aria-1.1/#live_region_roles) and [live region attributes](https://www.w3.org/TR/wai-aria-1.1/#attrs_liveregions). It is much harder for a user of a AT to "ignore" notifications.

`tabindex` is a good "quick fix" for controlling AT focus. Assign a value of `0` for items that should receive keyboard focus, and a `-1` for items that normally receive focus but should not for an AT. However, `tabindex` is a crutch - elements that receive focus should use the proper HTML elements and ARIA `role` attribute so the browser can automatically and "naturally" determine focus. Many users will have custom stylesheets for their AT that helps with their particular disability and those will be bypassed by using `div` elements for everything and brute forcing particular AT behaviors. We should consider the presence of `tabindex` as an "automatic technical debt" for improving the HTML in the future.

`tabindex` trivia: `tabindex` set on the `label` for an `input` transfers the focus to the `input`. Focus on the `input` reads it's `label`. The AT won't go into a loop or double-read the `label`. So setting a `tabindex` on the label reads the label when the input gets focus. Entering tab will go to the `label` but the AT won't read anything - so it feels like the tab is "broken/stuck" for the AT (visually you see the focus switch but the AT does not speak anything). The third tab then moves to the next input. Setting `tabindex="-1"` on the `input` and `tabindex="0"` on the `label` looks more correct - the label highlights and is spoken when it gets focus and keyboard input toggles (in the case of a checkbox) the input. However (on Chrome) the AT freaks out and reads all the `label` entries that are "nearby" in the DOM when the first input gets focus and then does not read anything else as focus moves in the "nearby group" (aka don't do it).

It is important to test using a screen reader. There is no substitute for experiencing and trying to operate the UI regularly using AT. Some small changes create amazing improvements to the AT UX and some unexpected outputs can be unusually annoying when using an AT. On Mac, use `cmd-F5` to toggle Voice Over on/off (or open System Preferences | Accessibility | Voice Over) and use the keyboard for navigation. TODO Windows and Linux testing options?

### Help Flow Map

The help flow structure is defined in `help-map.json`. Each entry represents a page in the help flow, and the key for each entry needs to be unique.

Each page can contain any combination of the following:

- `title`: displayed at the top of page, i18n string key, max one per page
- `seques`: displayed first in body of page, can have multiple per page
  - `content`: i18n string key, max one per segue
  - `segueTo`: key for help flow page to transition to on click, max one per segue
  - `sequeToIfPaused`: key for help flow page to transition to on click if paused, max one per segue
  - `segueToIfWhitelisted`: key for help flow page to transition to on click if whitelisted, max one per segue
- `sections`: displayed second in body of page, can have multiple per page
  - `content`: array of objects representing sentences to be displayed as a paragraph, can have multiple per section
    - `text`: i18n string key
    - `linkURL`: URL to be subbed into a string with link placeholders ("[[" and "]]")
- `buttons`: displayed third in body of page, can have multiple per page
  - `text`: i18n string key
  - `action`: function from `help-action.js` to be called on click
  - `icon`: material icons key of icon to be displayed on button, displayed before text
- `footer`: displayed at bottom of page, i18n string key, max one per page

## Uploading sourcemaps to Sentry

The gitlab CI configuration has `release` stage and `upload_sourcemaps` job
which is runs for tags like `adblock-<number>` and uploads the releases sourcemaps to Sentry.
It requires `SENTRY_AUTH_TOKEN` global variable configured for the project.
To do the same manually on the command line one has to:

1. Login to Sentry with `npm run sentry:login` and provide Sentry auth token.
2. Create a release with `VERSION=<version> npm run sentry:release-new`
3. Prepare unzipped file:

```
mkdir ./dist/sourcemaps/chrome-mv3
&& unzip dist/release/adblock-chrome-*-mv3.zip -d ./dist/sourcemaps/chrome-mv3
```

4. Upload the sourcemaps with `VERSION=<version> npm run sentry:sourcemaps`.
   The sourcemaps are overwritten.
5. Finalize the release with `VERSION=<version> npm run sentry:release-finalize`

## Supported browsers

List of browsers supported by extension can be found in the [README on the root](../../README.md#supported-browsers).
