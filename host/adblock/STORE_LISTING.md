# Firefox AMO notes for reviewers

```md
# AdBlock

A note regarding telemetry in AdBlock.
A few releases ago (version 5.20.0, Date: 2024-03-12), we added a user preference ("data_collection_opt_out"). This preference is used throughout AdBlock (including all of the telemetry modules) to disable the sending of any data to the AdBlock telemetry servers.

The default value for the new user preference ("data_collection_opt_out") is true for all Firefox users. You can see this in the Preference module: adblock-betafish/alias/prefs.js lines around lines 283 through 289.

The usage of this user preference can be seen in the Telemetry module:
adblock-betafish/telemetry/background/telemetry-ping.js
and IPM Telemetry module:
adblock-betafish/telemetry/background/telemetry-ipm.js

## Intro

[AdBlock](https://getadblock.com/) is based on the
[Adblock Plus](https://adblockplus.org/) code.

AdBlock source code is available in the attached tar file.

## Requirements

node: 18.17.1
npm: 9.6.7

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

## Development environment

For testing purposes, create an unpacked development environment with the following command:

    npm run build -- --scope=adblock -- firefox 2

This will create a _host/adblock/devenv/firefox-mv2_ directory. You can load
it as an unpacked extension under _about:debugging_ in Firefox. After making
changes to the source code re-run the command to update the development
environment, and reload the extension in the browser.

## Third Party Libraries in AdBlock:

DomPurify (version 2.2.6)
https://github.com/cure53/DOMPurify/releases/tag/2.2.6

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

# Opera notes for reviewers

```md
On Debian or Ubuntu: Run the following commands using Node 18.17.1 and npm 9.6.7:
npm install
npm run build:release -- --scope=adblock -- chrome 2
```
