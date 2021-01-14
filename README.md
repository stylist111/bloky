# ABP SDK project

## Useful commands

- Update the sub modules: `git submodule update --init`
- Install: `npm i`
- Lint: `npm run lint`
- Bundle: `npm run bundle`
  - To debug the source code rather than the generated code run `npm run bundle -- -d inline-source-map`.

## How to run unit tests

- start the test pages server `node test/start-server.js`
- run `npm run bundle`
- reload the extension
- navigate to: `chrome-extension://{EXTENSION_ID}/test/index.html`
