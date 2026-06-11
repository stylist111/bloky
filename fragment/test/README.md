# Fragment functional tests

Functional tests for fragments. Tests run in a real browser against a minimal
browser extension (the "fragment test extension") that integrates all testable
fragments.

## Directory structure

```plaintext
fragment/test
├── suites/       # Test suites, one file per fragment
├── extension/    # Fragment test extension source
│   ├── api/      # Message API handlers (ewe.*, testing.*)
│   └── modules/  # Fragment init helpers
└── runner/       # Runner configuration and setup
```

## Fragment test extension

The test extension is a minimal browser extension that integrates every fragment
under test. Its background script starts each fragment and exposes an
`ewe.*` / `testing.*` message API so test suites can drive fragment
behavior from Selenium via `browser.runtime.sendMessage`.

To add a new fragment:

1. Add it as a dependency in `package.json`.
2. Import and call its `start()` in `extension/background.js`.
3. Add a suite file under `suites/` and register it in `suites/index.js`.

## Running tests

### Prerequisites

Build fragments and the test extension first:

```sh
npm run build -- --scope="fragments-functional-tests"
```

### Local run

To run the functional tests locally:

```sh
npm run test:fragments -- --scope=fragments-functional-tests -- {chromium|chrome|edge|firefox} {2|3}
```

Set `FORCE_HEADFUL=true` to run with a visible browser window.

### Docker run

```sh
docker build -t fragments -f fragment/test/Dockerfile .
docker run --shm-size=2g -it -e BROWSER={chromium|chrome|firefox|edge} -e MANIFEST_VERSION={2|3} fragments
```

### Troubleshooting

- Screenshots for failing tests are saved to `fragment/test/screenshots/`.
