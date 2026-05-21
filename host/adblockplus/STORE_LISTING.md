# Extension store listing

## Single purpose

```
Blocking ads everywhere
```

## Permission justification

### Required permissions

```
# alarms
Allow this extension to reliably and periodically perform recurring tasks.

# contextMenus
Providing users with quick access to blocking specific elements on the page.

# declarativeNetRequestWithHostAccess
- Blocking network requests that are related to ads
- Blocking network requests based on users' custom rules and other user settings

# notifications
Drawing users' attention to messages that would otherwise go unnoticed if shown in the extension UI.

# scripting
Injecting (user) style-sheets into pages and providing contextual information, both required to block ads effectively

# storage
Storing user settings (incl. rules necessary for blocking ads).

# tabs
Injecting (user) style-sheets into pages and providing contextual information, both required to block ads effectively

# unlimitedStorage
Storing thousands of rules necessary for blocking ads.

# webNavigation
Observing the frame structure (for contextual content blocking) and discovering ad popups

# webRequest
* Preventing requests from being sent that are loading ads.
* Inject Content-Security-Policy on some websites that attempt to circumvent ad blocking.
* Observing requests for diagnostics in the devtools panel.
```

### Optional permissions

```
# contentSettings
Optional permission, requested when submitting issue reports to include additional, relevant information.

# management
Optional permission, requested when submitting issue reports to include additional, relevant information.
```

### Host permission

```
* Blocking ads from any URL on any website.
* Detecting specific links on websites to make it easier for users to add additional rules.
```

## Firefox AMO notes for reviewers

```md
On Debian or Ubuntu: Run the following commands using Node 24.14.1 and npm 11.11.0:
npm install
npm run build:release -- --scope=adblockplus -- firefox 2

This will create a build with a name in the form
_host/adblockplus/dist/release/adblockplus-firefox-n.n.n-mv2.xpi_. These builds
are unsigned. They can be submitted as-is or if unpacked, loaded in development
mode for testing.

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

## Opera notes for reviewers

```md
On Debian or Ubuntu: Run the following commands using Node 24.14.1 and npm 11.11.0:
npm install
npm run build:release -- --scope=adblockplus -- chrome 3
```
