# Firefox AMO notes for reviewers

```md
On Debian or Ubuntu: Run the following commands using Node 22.14.0 and npm 10.9.2:
npm install
npm run build:release -- --scope=adblockplus -- firefox 2

## Data Transmission Consent

We have a user preference ("data_collection_opt_out"). This preference is used throughout Adblock Plus (including all of the telemetry modules) to disable the transmission of any data.

The default value for the user preference ("data_collection_opt_out") is true for all Firefox users. You can see this in the Preference module: host/adblockplus/adblockpluschrome/lib/prefs.js if you search for the get(preference) method definition.

The usage of this user preference can be seen in various places:

- host/adblockplus/src/bootstrap/background/bootstrap.entry.ts (for Sentry)
- host/adblockplus/src/ipm/background/start-info.ts (for in-product messaging)
- host/adblockplus/src/telemetry/background/cdp.ts (for telemetry)
- host/adblockplus/src/telemetry/background/user-counting.ts (for user counting and event logging)

Because of the above, no data is ever transmitted for Firefox users of this extension.

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
On Debian or Ubuntu: Run the following commands using Node 22.14.0 and npm 10.9.2:
npm install
npm run build:release -- --scope=adblockplus -- chrome 3
```
