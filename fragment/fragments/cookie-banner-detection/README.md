# Cookie banner detection fragment

This fragment contains the background page (service worker) scripts needed to detect cookie banner dialogs, currently, in all the pages that make use of the [TCF API](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework).

## Running scripts

Please note that all scripts should be run from the root of the repository, not
this fragment folder.

## Building

See the [readme at the root of the monorepo](../../README.md) for general
instructions on prerequisites, dependency management, how to build the
extensions.

## Testing

### Unit tests

Unit tests are contained in `src/**/*.spec.ts` files.

```bash
npm test -- --scope @eyeo-fragments/cookie-banner-detection
```

### Functional tests

Functional / end-to-end tests are handled at the host level.
