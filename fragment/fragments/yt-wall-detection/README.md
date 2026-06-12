# YouTube Ad Wall Detection fragment

This fragment contains the content and background page (service worker) scripts needed to allowlist YouTube when the YouTube ad wall is detected.

## Running scripts

Please note that all scripts should be run from the root of the repository, not
this fragment folder.

## Building

See the [readme at the root of the monorepo](../../README.md) for general
instructions on prerequisites, dependency management, how to build the
extensions.

## Testing

### Unit tests

Unit tests are contained in files in `tests/unit/`.

```bash
npm test -- --scope @eyeo-fragments/yt-wall-detection
```

### Functional tests

Functional tests run in a real browser against the test extension in `fragment/test/`. See [fragment/test/README.md](test/README.md) for full instructions.

```sh
npm run build -- --scope fragments-functional-tests
npm run test:fragments -- -- chromium 3
```

Additional functional / end-to-end tests are handled at the host level.
