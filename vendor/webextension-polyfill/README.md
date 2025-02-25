# WebExtension `browser` API Polyfill

This is a fork of the [webextension-polyfill][webextension-polyfill] library,
which allows extensions that use the Promise-based WebExtension/BrowserExt API
being standardized by the [W3 Browser Extensions][w3-browserext] group to run on
Google Chrome with minimal or no changes.

The following modifications were made:
- Removed/replaced any files except:
  - src/browser-polyfill.js
  - api-metadata.json
  - LICENSE
- Added own package.json and README.md files.
- Use `require()` to import API metadata.
- fix: Errors from asynchronous API calls have incomplete stack traces

[w3-browserext]: https://www.w3.org/community/browserext/
[webextension-polyfill]: https://github.com/mozilla/webextension-polyfill
