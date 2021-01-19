# ABP SDK project

## Useful commands

- Update the sub modules: `git submodule update --init`
- Install: `npm i`
- Lint: `npm run lint`
- Bundle: `npm run bundle`

## Unit tests

### Manual run

- start the test pages server `node test/start-server.js`
- run `npm run bundle`
- reload the extension
- navigate to: `chrome-extension://{EXTENSION_ID}/test/index.html`

### Automated run

- start the test pages server `node test/start-server.js`
- run `node test/runner.js`
