# Conflict Detection fragment

## Intro

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

### Unit testing

The `./test/unit` folder contains various unit tests files
For `.ts` files we have unit tests that can be run via
`npm run test`.

### End-to-end testing

End to end test are out of scope of this fragment because of the need for browser and an host extension to execute such tests.
