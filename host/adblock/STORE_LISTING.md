# Extension store listing

## Single purpose

```
To block ads on all sites
```

## Permission justification

### Required permissions

```
# alarms
To allow AdBlock to reliably and periodically perform recurring tasks

# contextMenus
To allow users to interact with various settings and features of AdBlock

# declarativeNetRequestWithHostAccess
To allow AdBlock users to interact with features of AdBlock

# idle
To allow AdBlock to detect the current status of the browser which allows AdBlock to schedule tasks appropriately

# notifications
To allow AdBlock to inform users of various status updates

# scripting
To allow users to interact with various features of AdBlock

# storage
Data that is utilized by AdBlock to block and hide ads is downloaded periodically and saved to storage

# tabs
Injecting style-sheets into pages and providing contextual information, both required to block ads effectively

# unlimitedStorage
Large amounts of data is downloaded and saved to storage

# webNavigation
Discovering the usage of subdocuments on sites and discovering ad popups.  To capture history state changes on YouTube for the YouTube channel whitelisting feature

# webRequest
To prevent requests that load ads from being sent, capturing data / requests for the user opt in filter list data collection, and for redirecting requests for the 'local CDN' feature
```

### Optional permissions

```
# management
This is an optional permission that AdBlock requests when gathering debug information.
```

### Host permission

```
To block ads on all sites
```

## Firefox AMO notes for reviewers

```md
# AdBlock

A note regarding telemetry in AdBlock.
A few releases ago (version 5.20.0, Date: 2024-03-12), we added a user preference ("data_collection_opt_out"). This preference is used throughout AdBlock (including all of the telemetry modules) to disable the sending of any data to the AdBlock telemetry servers.

The default value for the new user preference ("data_collection_opt_out") is true for all Firefox users. You can see this in the Preference module: adblock-betafish/alias/prefs.js if you search for the get(preference) method definition.

The usage of this user preference can be seen in the Telemetry module:
adblock-betafish/telemetry/background/telemetry-ping.js
and IPM Telemetry module:
src/ipm/background/start-info.ts

## Intro

[AdBlock](https://getadblock.com/) is based on the
[Adblock Plus](https://adblockplus.org/) code.

AdBlock source code is available in the attached tar file.

## Requirements

node: 24.14.1
npm: 11.11.0

## Building on Windows

On Windows, you need a [Linux environment running on WSL](https://docs.microsoft.com/en-us/windows/wsl/install).
Then install the above requirements and run the commands below from within Bash.

## Updating the dependencies

In order to build the extension, run the following command (install the required npm packages)

    npm install

## Building the extension

Run the following command to build the Firefox version of AdBlock

    npm run build:release -- --scope=adblock -- firefox 2

This will create a build with a name in the form
_host/adblock/dist/release/adblock-firefox-n.n.n-mv2.xpi_. These builds
are unsigned. They can be submitted as-is or if unpacked,
loaded in development mode for testing.

## Third Party Libraries in AdBlock:

ChartJS (version 2.9.4)
https://github.com/chartjs/Chart.js/releases/tag/v2.9.4

jQuery (version 3.5.1)
https://code.jquery.com/jquery-3.5.1.min.js

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
npm run build:release -- --scope=adblock -- chrome 2
```
