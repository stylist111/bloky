# Firefox AMO notes for reviewers

```md
On Debian or Ubuntu: Run the following commands using Node 18.17.1 and npm 9.6.7:
npm install
npm run build:release -- --scope=adblockplus -- firefox 2

## Third Party Libraries:

webextension-polyfill 0.12.0 (fork of Mozilla's webextension-polyfill 0.12.0)
The fork fixes the stack trace for `browser.runtime.lastError`, this is intended as a temporary solution
until the original issue is fixed in the upstream repository.
Original: https://github.com/mozilla/webextension-polyfill/blob/0.12.0/src/browser-polyfill.js
Fork: /vendor/webextension-polyfill/src/browser-polyfill.js
Merge request: https://github.com/mozilla/webextension-polyfill/pull/719
```

# Opera notes for reviewers

```md
On Debian or Ubuntu: Run the following commands using Node 18.17.1 and npm 9.6.7:
npm install
npm run build:release -- --scope=adblockplus -- chrome 2
```
