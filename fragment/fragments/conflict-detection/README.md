# Conflict Detection fragment

This fragment contains the background page (service worker) scripts needed to detect:

- all of our extensions
- other extensions that may cause a conflict with the functionality our extensions provide

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
npm test -- --scope @eyeo-fragments/conflict-detection
```

### Functional tests

Functional / end-to-end tests are handled at the host level.
