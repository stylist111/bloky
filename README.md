# ABP SDK project

## Useful commands

- Update the sub modules: `git submodule update --init`
- Install: `npm i`
- Lint: `npx eslint .`
- Bundle: `npx webpack`
  - To debug the source code rather than the generated code add the `-d inline-source-map` option.

## How to run unit tests

- start the test pages server `node test/start-server.mjs`
- run `npx webpack`
- reload the extension
- navigate to: `chrome-extension://{EXTENSION_ID}/test/index.html`
