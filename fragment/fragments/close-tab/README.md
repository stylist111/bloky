# Close Tab fragment

A fragment that provides web pages that are opened by the host to close their
own tab, as this cannot be done via `window.close()`. For example after
completing an onboarding or authentication flow, this provides a better user
experience by automatically cleaning up tabs that are no longer needed.

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
npm test -- --scope @eyeo-fragments/close-tab
```

### Functional tests

Functional / end-to-end tests are handled at the host level.
