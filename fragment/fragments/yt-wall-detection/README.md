# YouTube Ad Wall Detection fragment

## Intro

This fragment contains the content and background page (service worker) scripts needed to allowlist YouTube when the YouTube ad wall is detected.

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
`npm run ...`.

### End-to-end testing

End to end test are out of scope of this fragment because of the need for browser and an host extension to execute such tests.
