# ABP SDK project

## Useful commands

- Update the sub modules: `git submodule update --init`
- Install: `npm i`
- Lint: `npm run lint`
- Bundle: `npx webpack`
- Generate docs: `npm run docs`

## Unit tests

### Manual run

- start the test pages server `node test/start-server.js`
- run `npx webpack`
- load the extension

Note: For the popup tests to work when running the tests manually,
you have to disable the browser's built-in popup blocking on `localhost`.

### Automated run

- start the test pages server `node test/start-server.js`
- run the tests: `node test/runner.js {chromium|firefox|edge} [version] [options]`
  - The `--timeout` option overrides the per-test timeout.
  - The `--grep` option filters the tests to run with a regexp.
