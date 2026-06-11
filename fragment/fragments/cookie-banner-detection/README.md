# Cookie banner detection fragment

## Intro

This fragment contains the background page (service worker) scripts needed to detect cookie banner dialogs, currently, in all the pages that make use of the [TCF API](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework).

## Running scripts

Please note that all scripts should be run from the root of the repository, not
this fragment folder.

## Building

See the [readme at the root of the monorepo](../../README.md) for general
instructions on prerequisites, dependency management, how to build the
extensions.

## Testing

### Unit testing

Unit tests can be found in the same directory of the related modules (`./src`) contained in `.spec.ts` files. They can be run via `npm run test`.

### End-to-end testing

End to end test are out of scope of this fragment because of the need for browser and an host extension to execute such tests.
