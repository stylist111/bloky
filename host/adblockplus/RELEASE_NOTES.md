# Unreleased

- Updated webext-ad-filtering-solution to 1.23.0
- Updated minimum Chrome version to 79 for MV2 extensions
- Updated minimum Opera version to 66 for MV2 extensions

# 4.10.1 - 2025-01-07

- Removed machine learning snippets from extension (refs EXT-541)
- This release also contains minor updates and under-the-hood changes.

# 4.10.0 - 2024-12-10

- Updated webext-ad-filtering-solution to 1.22.0
- Pass premium status in uninstall link (EXT-430)
- Updated snippets to 1.7.1
- Dropped support for Firefox versions older than 68 (EXT-541).
- Attached split experiments assignments data to uninstall URL (EXT-541).

# 4.9.4 - 2024-12-02

- This release contains mostly only minor updates and under-the-hood changes.
- Updated webext-ad-filtering-solution to 1.20.0
- Added skeleton for public API inside custom iframe. The API is currently inactive (EXT-567)

# 4.9.3 - 2024-11-19

This release fixes a severe performance bug that can occur when visiting certain
websites.

- Updated webext-ad-filtering-solution to 1.17.2

# 4.9.2 - 2024-11-11

- Updated webext-ad-filtering-solution to 1.17.0

# 4.9 - 2024-10-23

- This release contains mostly only minor updates and under-the-hood changes.
- Restored YouTube mention in extension description on the extension store listing.

# 4.8 - 2024-10-09

The highlights of this release is that the popup allowlisting button now does 7
day smart allowlisting. It also contains a potential fix for a bug where some
users are reporting no longer having any subscriptions.

- We no longer test the MV2 build of our extensions on Chrome 129 and later,
  since it disables MV2 extensions by defaults.
- Enable user counting functionality
- Updated snippets to 1.6.0
- Updated webext-ad-filtering-solution to 1.16.0
- Updated snippets to 1.7.0
- Changed popup allowlist behaviour to 7 days smart allowlist (EXT-339)
- Attempt to fix issue when no subscriptions are enabled (due to corrupted data), restoring to default subscriptions (EXT-375)

# 4.7.1.1 - 2024-09-27

This release changes the extension description.

- Removed YouTube mention from extension description.

# 4.7.1 - 2024-09-19

This release contains only minor updates and under-the-hood changes.

# 4.7 - 2024-09-04

- Upgraded to SDK version 1.12.0
- Updated snippets to 1.5.0

# 4.5.1 - 2024-08-13

This release contains only minor updates and under-the-hood changes.

# 4.5 - 2024-08-05

This release adds support for Sentry remote logging, Smart Allowlisting, and One Click Allowlisting with Filters expiration.

## User interface changes

- Added support for sending background page errors to Sentry.
- Fixed: Auto open the update campaign for FF users.

## Filter changes

Upgraded EWE to 1.10.0 (release notes: [1.10.0](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.10.0)), which includes the following changes:

- Added support for Smart Allowlisting.
- Added support for One Click Allowlisting with Filters expiration.
- Added an opt-out mechanism for the user counting telemetry.
- Fixed: Attempting to add a filter that has already been added no longer throws an error.

# 4.4 - 2024-07-16

New snippets, more blocked info, in product messaging fixes.

## Changes

- Updated extension description
- Fix: Inject IPM-related script on document_start, not \_end
- Upgraded @eyeo/snippets to 1.4.0 ([release notes](https://gitlab.com/eyeo/anti-cv/snippets/-/releases/v1.4.0))
- Add number of blocked requests to injection info ([abp#1640](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1640 "Inject block count for marketing pages and experiments"))

# 4.3 - 2024-07-02

This release includes a notification to our Firefox users about recent changes about updates to the extension, improvements to our IPM system, support for CDP functionality and the latest webext engine version

## Latest changes

- Auto open the update campaign for FF users (EE-680)
- Updated the extension engine dependency to 1.8.0 (EE-632)
- Support CDP functionality (EE-632)
- Add special handling to allowlisting API for Softonic domains (EE-625, RL-181)
- Fix regression introduced by node-fetch upgrade (EE-630)
- Added further filter list diff update error messages ([abp#1678](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1678 "Add error messages for new EWE 1.5.0 subscription errors"))
- Introduce IPM delete command ([abp#1540](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1540 "ABP | IPM | `delete` command"))

# 4.2 - 2024-06-11

This release introduces support for showing premium features in the pop-up menu. [MR](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/merge_requests/1062 "feat: Add premium buttons to popup menu [EE 371]")

# 4.1 - 2024-05-28

This release reintroduces support for third-party filter lists for Manifest v3. It also contains various filter and snippets improvements and fixes.

## User interface changes

- Changed "Donate" text to "Contribute" ([abp#1452](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1452 'Change "Donate" text to "Contribute"')).
- Attempted to fix a problem with endless opening of tabs with Adblock Plus update information ([abp#1548](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1548 "problem with endless opening of tabs with ABP update information")).
- Fixed: Clicking the "Add" button after pasting multiple custom filters causes the multiple filter lists to be merged as one (Manifest v3 only) ([abp#1672](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1672 "Adding multiple custom filters not working as expected")).
- Fixed: Block element flow got stuck ([abp#1686](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1686 'The "Block" button in Block Element feature unresponsive')).

## Filter changes

Upgraded EWE to 1.6.1 (release notes: [1.3.0](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.3.0), [1.3.1](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.3.1), [1.3.2](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.3.2), [1.4.0](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.4.0), [1.4.1](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.4.1), [1.5.0](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.5.0), [1.6.0](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.6.0), [1.6.1](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.6.1)), which includes the following changes:

- Added support for third-party filter lists (Manifest v3 only).
- Added support for wildcard domains in element hiding filters.
- Added support for "remove" action on elemhide emulation filters.
- Improved ad-filtering quality on single page websites.
- Fixed: Unable to unallowlist allowlisted domain from filter list (Manifest v3 only).
- Fixed: Filter in filter list got removed when same custom filter got removed (Manifest v3 only).
- Fixed: Last updated column in settings got stuck when updating a filter list (Manifest v3 only).
- Fixed: Port ignored when using domain wildcards filter.
- Fixed: Blocked images not hidden on specific cases on Linux.

## Snippets changes

Upgraded @eyeo/snippets to 1.3.0 ([release notes](https://gitlab.com/eyeo/anti-cv/snippets/-/releases/v1.3.0)), which includes the following changes:

- Added support for Acceptable Ads in `hide-if-classifies` snippet.
- Added support for filter selectors with whitespaces.
- Added support for optional filter flags: `denoise`, `failsafe`, `frameonly`, `silent`
- Changed `mldebug:` option to separate filter flag.

# 4.0 - 2024-04-30

This is the first Adblock Plus version that is based on the Manifest v3 extension format. For now this change only affects users on Chrome. Users on Firefox, Microsoft Edge and Opera will remain on Manifest v2 for the time being, so this release only includes some minor changes for them. Eventually, we are going to switch over to Manifest v3 on all platforms and we are continuing to monitor and test support for Manifest v3 on those platforms.

## Snippets changes

Upgraded @eyeo/snippets to 1.2.2 ([release notes](https://gitlab.com/eyeo/anti-cv/snippets/-/releases/v1.2.2)), which includes the following changes:

- Changed optional parameter syntax of `skip-video` snippet.
- Updated `skip-video` snippet:
  - Added support for `race`.
  - Added support for optional named parameters.
  - Added optional parameters:
    - `-run-once`
    - `-stop-on-video-end`
    - `-wait-until`
  - Converted existing optional parameters to optional named parameters:
    - `-max-attempts`
    - `-retry-ms`
    - `-skip-to`

## Chrome-specific changes

- Switched to Manifest v3 ([initial support](https://gitlab.com/groups/adblockinc/ext/-/epics/27 "Have an ABP Manifest V3 MVP build"), [additional fixes and improvements](https://gitlab.com/groups/adblockinc/ext/-/epics/28 "ABP Manifest V3 Day-2 items"), [abp#1651](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1651 'ABP | "Extension failed to load properly"')).

#### [](#known-issues-due-to-manifest-v3-limitations)Known issues due to Manifest v3 limitations

- The size of the extension package has increased significantly. We are investigating various ways to reduce the size of future Adblock Plus versions.
- Filter lists from third-party sources have been disabled temporarily and won't show up in the extension's settings. Those filter lists will be restored with a subsequent update.
- Filter lists may fail to update. This problem is more likely to occur for users with many custom filters.
- Filter lists may fail to install. This problem is more likely to occur for users who have other content-filtering extensions enabled.
- Custom filters may fail to be added.

# 3.25.1 - 2024-04-02

This release contains various bug fixes, including ones related to the upcoming transition to Manifest v3

## User interface changes

- Made various improvements in preparation for the upcoming transition to Manifest v3 ([abp#1553](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1553 "Add filter list error messages related to diff updates"), [abp#1628](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1628 "Manifest v3: Delay when pasting multiple custom filters"), [abp#1632](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1632 "ABP | Tackle custom filter list subscriptions temporary unavailability")).
- Fixed: Premium access got lost when the extension was unable to reach our servers to verify that the Premium license is still active ([abp#1575](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1575 "Premium license gets reset when failing to resolve license server domain")).

# 3.25 - 2024-03-05

This release includes various bug fixes ahead of the upcoming transition to Manifest v3, as well as additional functionality for existing snippets. It also resumes support for Firefox, bringing the changes from Adblock Plus 3.24 to Firefox users.

## User interface changes

- Extended in-product messaging to allow usage of adblockplus.org subdomains ([abp#1485](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1485 "ABP | IPM update/additional subdomain command parameter")).
- Fixed: Developer tools panel displayed content filters as type OTHER ([abp#1626](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1626 "Element hiding filters shown as OTHER in developer tools panel")).

## Filter changes

Upgraded @eyeo/webext-ad-filtering-solution to 1.2.4 ([release notes](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.2.4)), which includes the following changes:

- Various fixes for upcoming transition to Manifest v3.

## Snippets changes

Upgraded to @eyeo/snippets 1.2.1 (release notes: [1.1.0](https://gitlab.com/eyeo/anti-cv/snippets/-/releases/v1.1.0), [1.2.0](https://gitlab.com/eyeo/anti-cv/snippets/-/releases/v1.2.0), [1.2.1](https://gitlab.com/eyeo/anti-cv/snippets/-/releases/v1.2.1)), which includes the following changes:

- Added support for `^^sh^^` and `^^svg^^` CSS selectors to various snippets.
- Added telemetry for machine learning snippets.

## Firefox-specific changes

- Disabled data collection for all Firefox users while we're working on an opt-out experience that complies with Mozilla's requirements ([abp#1621](https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1621 "Disable in-product messaging for Firefox users")).

# 3.24.1 - 2024-02-20

This release removes an experimental snippet.

## Snippet changes

Upgraded @eyeo/snippets to 1.0.0 ([release notes](https://gitlab.com/eyeo/anti-cv/snippets/-/releases/v1.0.0)), which includes the following changes:

- Removed experimental `simulate-event-poc` snippet in favor of `simulate-mouse-event`.

# 3.24 - 2024-02-05

This release includes various improvements to the out-of-the-box ad-filtering experience and it enhances the Premium cookie wall blocking feature.

## User interface changes

- Extended in-product messaging to allow for more targeted messages ([ui#1424](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1424), [ui#1577](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1577), [ui#1597](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1597)).
- Made Premium cookie wall blocking feature more capable and versatile ([ui#1464](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1464), [ui#1591](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1591)).
- Added global filter list recommendation for various languages for which there is no language-specific filter list recommendation yet ([ui#1495](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1495)).
- Added filter list recommendations for Hungarian ([ui#1554](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1554)).

## Filter changes

Upgraded EWE to 1.2.3 ([release notes](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.2.3)), which includes the following changes:

- Fixed: `$document` filter option was ineffective for frames ([ui#1586](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1586)).

# 3.23 - 2024-01-23

This release contains new filtering capabilities and it fixes various problems for users across some languages and websites.

## User interface changes

- Fixed: Extension failed to initialize for browser languages without a recommended filter list ([ui#1410](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1410)).

## Filter changes

Upgraded EWE to 1.2.2 (release notes: [1.2.0](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.2.0), [1.2.1](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.2.1), [1.2.2](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.2.2)), which includes the following changes:

- Added domain wildcard syntax for element hiding filters.
- Fixed: Incorrect handling of first-party requests in third-party frames ([ui#1578](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1578)).

# 3.22.1 - 2024-01-15

This release fixes a major performance problem that was introduced in Adblock Plus 3.22 ([ui#1576](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1576)).

# 3.22 - 2024-01-09

This release resumes support for Firefox, adds support for blocking ads in more languages and introduces differential filter list updates, which are crucial to continue delivering frequent updates to filter lists under Manifest v3. Additionally, it includes further support for users who encounter YouTube's anti-adblock wall.

## User interface changes

- Added filter list recommendations for Japanese, Kazakh, Turkish and Uzbek ([ui#1462](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1462), [ui#1497](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1497)).
- Show a dialog to help users who encounter YouTube's anti-ad blocker wall ([ui#1513](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1513)).

## Filter changes

Upgraded EWE to 1.1.1 (release notes: [0.11.0](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/0.11.0), [0.12.0](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/0.12.0), [0.13.0](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/0.13.0), [0.13.1](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/0.13.1), [0.13.2](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/0.13.2), [1.0.0](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.0.0), [1.1.0](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.1.0), [1.1.1](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/1.1.1)), which includes the following changes:

- Added support for partial filter list updates in preparation for Manifest v3.
- Fixed: CSP filters were ignored, if no domain was included in the filter's URL pattern ([ui#1138](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1138)).
- Fixed: Element hiding filter hits broke when an invalid CSS selector was used ([ui#1471](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1471)).

## Snippet changes

Upgraded EWE to 1.1.1, which includes the following changes:

- Removed domain requirement from `hide-if-classifies` snippet.

## Firefox-specific changes

- Added the option to opt-out of data collection for the in-product messaging feature that was introduced in Adblock Plus 3.18 ([ui#1416](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1416)).

# 3.21.1 - 2023-11-28

In an effort to bring new features and bug fixes to Adblock Plus users more quickly, we are working on increasing the frequency at which we publish new extension versions. Consequently, this release mostly contains some under-the-hood improvements and fixes an in-product messaging problem that caused an error message to be shown on websites ([ui#1494](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1494)).

# 3.21 - 2023-11-09

This release adds functionality for skipping video ads, as well as improvements and fixes for various snippets.

## Snippets changes

Upgraded @eyeo/snippets to 0.10.0 (release notes: [0.9.1](https://gitlab.com/eyeo/anti-cv/snippets/-/releases/v0.9.1), [0.10.0](https://gitlab.com/eyeo/anti-cv/snippets/-/releases/v0.10.0)), which includes the following changes:

- Added `skip-video` snippet.
- Added optional `autoRemoveCookie` parameter to `cookie-remover` snippet.
- Added optional `setConfigurable` parameter to `override-property-read` snippet ([snippets#20](https://gitlab.com/eyeo/anti-cv/snippets/-/issues/20 "abort-on-property-read, override-on-property-read not working properly")).
- Fixed: Snippets could overwrite each other, if they used the `waitUntil` parameter.
- Fixed: `hide-if-matches-xpath3` snippet behaved differently in Firefox (see [issue](https://github.com/FontoXML/fontoxpath/issues/605)).
- Fixed: `prevent-listener` snippet failed to target certain listeners ([snippets#16](https://gitlab.com/eyeo/anti-cv/snippets/-/issues/16 "prevent-listener not working properly")).
- Fixed: `cookie-remover` was unable to determine frame domain, if cookies get reset after removal ([snippets#18](https://gitlab.com/eyeo/anti-cv/snippets/-/issues/18 "cookie-remover not working properly")).

# 3.20 - 2023-10-23

This release contains various filtering improvements, such as a more capable integration of machine learning, and the ability to block [web bundles](https://github.com/WICG/webpackage).

## User interface changes

- Extended in-product messaging to allow for domain-specific messages ([ui#1470](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1470)).
- Fixed: In-product messages weren't displayed properly ([ui#1493](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1493)).
- Fixed: Switching tabs using the keyboard was broken ([ui#1135](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1135)).

## Filter changes

Upgraded EWE to 0.10.1 (release notes: [0.9.0](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/0.9.0), [0.10.0](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/0.10.0), [0.10.1](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/0.10.1)), which includes the following changes:

- Made filter hits for the developer tools panel and for issue reports compatible with Manifest v3 ([ewe#389](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/issues/389 "Filter hits / blocked counter support on MV3")).
- Added `$webbundle` filter option ([ewe#495](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/issues/495 "Support blocking web bundles in MV2")).

## Snippets changes

Started using [@eyeo/mlaf](https://gitlab.com/eyeo/mlaf) 0.3.3 for machine learning functionality, and upgraded @eyeo/snippets to 0.9.0 (release notes: [0.8.0](https://gitlab.com/eyeo/snippets/-/releases/v0.8.0), [0.8.1](https://gitlab.com/eyeo/snippets/-/releases/v0.8.1), [0.9.0](https://gitlab.com/eyeo/snippets/-/releases/v0.9.0)), which includes the following changes:

- Added `hide-if-classifies` snippet.
- Added `hide-if-matches-xpath3` snippet.
- Removed `hide-if-graph-matches` snippet.

## Firefox-specific changes

- Fixed: No favicon is shown for extension pages ([ui#1105](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1105)).
- Fixed: Injected UI remains in web page after the extension gets unloaded ([ui#1404](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1404)).

# 3.19 - 2023-08-24

This release adds a new Premium feature for blocking cookie consent pop-ups. It also contains various bug fixes and under-the-hood improvements.

## Premium changes

- Added a new Premium feature for blocking cookie consent pop-ups ([ui#1347](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1347), [ui#1454](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1454)).
- Added a new page for onboarding new Premium users ([ui#1444](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1444), [ui#1453](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1453)).

## User interface changes

- Made "Block element" feature compatible with Manifest v3 ([ui#1275](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1275)).
- Fixed: Issue reporter draws hiding/highlighting sections with an offset ([ui#1185](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1185)).
- Fixed: Developer tools panel mistakes filters from filter lists as custom filters ([ui#1323](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1323)).
- Fixed: Icon falsely indicates that extension is inactive under some circumstances ([ui#1330](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1330)).

## Filter changes

Upgraded EWE to 0.8.1 (release notes: [0.8.0](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/0.8.0), [0.8.1](https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/releases/0.8.1)) ([ui#1317](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1317), [ui#1327](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1327), [ui#1328](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1328), [ui#1352](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1352)), which includes the following changes:

- Made functionality compatible with Manifest v3 ([ewe#320](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/320), [ewe#321](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/321), [ewe#325](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/325), [ewe#380](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/380), [ewe#404](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/404)).

# 3.18.1 - 2023-07-24

This release contains various improvements to snippets.

## Snippet changes

Upgraded @eyeo/snippets to 0.7.0 (release notes: [0.6.1](https://gitlab.com/eyeo/snippets/-/releases/v0.6.1), [0.7.0](https://gitlab.com/eyeo/snippets/-/releases/v0.7.0)), which includes the following changes:

- Deprecated `hide-if-graph-matches` snippet.
- Added `hide-if-matches-computed-xpath` snippet.
- Added optional parameters to `hide-if-contains-visible-text` snippet.
- Added optional `setConfigurable` parameter to `abort-on-property-read` and `abort-on-property-write` snippets.
- Added optional `waitUntil` parameter to `hide-if-has-and-matches-style`, `hide-if-contains-and-matches-style` and `hide-if-matches-computed-xpath` snippets.
- Added optional parameters `windowWidthMin` and `windowWidthMax` to `hide-if-has-and-matches-style` and `hide-if-contains-and-matches-style` snippets.
- Improved performance of `hide-if-matches-xpath` snippet.
- Improved debug logs.

# 3.18 - 2023-07-13

This release introduces in-product messaging functionality to raise awareness for relevant features, products and Premium in a less intrusive manner than is currently possible ([ui#1368](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1368), [ui#1385](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1385), [ui#1393](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1393)).

# 3.17.1 - 2023-06-16

This release fixes a bug that prevents the activation of some functionality when the extension starts up ([ui#1421](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1421)).

# 3.17 - 2023-04-25

This release includes some improvements to snippets and expands on experimental APIs that some websites can use to provide a better experience for Adblock Plus users.

## User interface changes

- Automatically enable additional distraction blocking when activating Premium ([ui#1326](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1326)).

## Snippet changes

Upgraded @eyeo/snippets to 0.6.1 (release notes: [0.6.0](https://gitlab.com/eyeo/snippets/-/releases/v0.6.0), [0.6.1](https://gitlab.com/eyeo/snippets/-/releases/v0.6.1)), which includes the following changes:

- Added `simulate-mouse-event` snippet ([snippets#12](https://gitlab.com/eyeo/snippets/-/issues/12)).
- Improved performance, added support for selecting sub-targets, and added optional debug output to `hide-if-graph-matches` snippet.

## Other changes

- Provide experimental Flattr API to some websites ([ui#1370](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1370)).
- Expanded partner access to experimental allowlisting API ([ui#1387](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1387)).

# 3.16.2 - 2023-03-08

This release adds further information to pass along to the uninstall page ([ui#1355](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1355)).

# 3.16.1 - 2023-02-06

This release turns off notifications for Adblock Plus Premium users that aren't relevant to them ([ui#1300](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1300)).

# 3.16 - 2023-01-25

This release includes further under-the-hood changes to make Adblock Plus compatible with Manifest v3, as well as some bug fixes.

## User interface changes

- Made user interface compatible with Manifest v3 ([ui#1069](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1069), [ui#1190](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1190), [ui#1249](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1249), [ui#1276](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1276), [ui#1277](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1277)).
- Temporarily removed link behind the Premium label in the icon popup in order to reduce confusion ([ui#1293](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1293)).
- Fixed: Developer tools panel only showed one element hiding filter hit ([ui#1309](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1309)).

## Filter changes

Upgraded EWE to 0.7.2 (release notes: [0.7.0](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/releases/0.7.0), [0.7.1](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/releases/0.7.1), [0.7.2](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/releases/0.7.2)) ([ui#1183](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1183)), which includes the following changes:

- Made functionality compatible with Manifest v3 ([ewe#316](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/316), [ewe#319](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/319), [ewe#323](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/323), [ewe#380](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/380)).
- Implemented migration of user data from Manifest v2 to v3 ([ewe#344](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/344), [ewe#345](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/345), [ewe#378](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/378)).
- Upgraded adblockpluscore to 0.10.1 (release notes: [0.10.0](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/releases/0.10.0), [0.10.1](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/releases/0.10.1)) ([ewe#377](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/377), [ewe#394](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/394)).

## Firefox-specific changes

- Fixed: Unable to report issues using the issue reporter ([ui#1173](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1173)).

# 3.15.2 - 2022-12-05

This release fixes a problem that caused the "Block element" button to disappear from the icon popup ([ui#1303](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1303)). It also fixes a problem in 3.15.1 that prevented us from publishing it to the Firefox Add-ons store ([ui#1306](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1306)).

# 3.15.1 - 2022-12-05

## Snippet changes

Upgraded @eyeo/snippets to 0.5.5 (release notes: [0.5.4](https://gitlab.com/eyeo/snippets/-/releases/v0.5.4), [0.5.5](https://gitlab.com/eyeo/snippets/-/releases/v0.5.5)), which includes the following changes:

- Made the `hide-if-graph-matches` snippet compatible with Manifest v3.
- When `debug` directive is used, `race` provides the winner name when any snippet wins a race.
- Fixed: `override-property-read` snippet broke when used with multiple non-existent references.

# 3.15 - 2022-11-23

This release introduces [Adblock Plus Premium](https://accounts.adblockplus.org/premium) with the Premium-exclusive Distraction Control functionality. It also includes significant under-the-hood changes to make Adblock Plus compatible with Manifest v3, as well as various important bug fixes.

## User interface changes

- Introduced Adblock Plus Premium ([ui#981](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/981), [ui#985](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/985), [ui#1139](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1139), [ui#1200](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1200)).
- Improved on how idle state is shown in icon popup ([ui#842](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/842)).
- Added filter validation error message when adding too many custom filters under Manifest v3 ([ewe#243](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/243)).
- Made user interface compatible with Manifest v3 ([ui#1070](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1070), [ui#1071](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1071), [ui#1079](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1079), [ui#1080](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1080), [ui#1086](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1086)).
- Fixed: Acceptable Ads survey dialog was flickering when disabling Acceptable Ads ([ui#581](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/581)).
- Fixed: When navigating from an allowlisted page, the toolbar icon continued to indicate that the page is allowlisted ([ui#1120](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1120)).
- Fixed: Filters with `$popup` option were not shown in developer tools panel ([ui#1128](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1128), [ewe#234](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/234)).

## Filter changes

Upgraded EWE to 0.6.1 (release notes: [0.5.0](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/releases/0.5.0), [0.6.0](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/releases/0.6.0), [0.6.1](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/releases/0.6.1)) ([ui#1176](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1176), [ui#1195](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1195), [ui#1257](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1257)), which includes the following changes:

- Snippet changes
  - Upgraded @eyeo/snippets to 0.5.3 ([release notes](https://gitlab.com/eyeo/snippets/-/releases/v0.5.3)) ([ui#1195](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1195)).
  - Made snippets compatible with Manifest v3 ([ewe#143](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/143)).
- Upgraded adblockpluscore to 0.9.1 (release notes: [0.8.0](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/releases/0.8.0), [0.9.0](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/releases/0.9.0), [0.9.1](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/releases/0.9.1)) ([ewe#309](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/309), [ewe#341](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/341)).
- Fixed: Allowlisting filter with `$document` option was not applied to aborted frames ([ewe#230](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/230)).

## Chromium-specific changes

- Fixed: Acceptable Ads checkboxes had visual glitch in older Chromium versions ([ui#1178](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1178)).

## Firefox-specific changes

- Fixed: Adblock Plus failed to initialize when using Firefox in Private Browsing mode ([ui#1129](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1129), [ewe#231](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/231), [ewe#369](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/369)).

## Yandex Browser-specific changes

- Fixed: Adblock Plus failed to initialize when Yandex search page was open on browser start ([ui#1160](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1160), [ewe#309](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/309)).

# 3.14.2 - 2022-08-29

## Snippet changes

Replaced abp-snippets with [@eyeo/snippets](https://gitlab.com/eyeo/snippets) and upgraded it to 0.5.2 (release notes: [0.5.0](https://gitlab.com/eyeo/snippets/-/releases/v0.5.0), [0.5.1](https://gitlab.com/eyeo/snippets/-/releases/v0.5.1), [0.5.2](https://gitlab.com/eyeo/snippets/-/releases/v0.5.2)), which includes the following changes:

- Added `hide-if-contains-similar-text` snippet.
- Removed `hide-if-contains-image-hash` snippet.
- The `json-prune` snippet now exposes more details when the `debug;` directive is added before its execution within the filter (e.g. `#$#debug; json-prune ...`).
- The `hide-if-contains-visible-text` snippet now accepts `-snippet-box-margin:x` as an attribute, where `x` should be a number that represents the surrounding pixels margin.
- Various performance improvements.

# 3.14.1 - 2022-07-05

## Snippet changes

Upgraded abp-snippets to 0.4.1 ([update notes](https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1076)), which includes the following changes:

- Improved support and performance for running multiple snippets on the same page.
- Added `race` snippet directive for running only some of a given list of snippets.
  _e.g. example.com#$#race start; snippet 1 2 3; other 4 5 6; another 7 8 9; race stop;_
- Added case insensitive matching support for snippet parameters.
  _e.g. #`#snippet /test/ can now be #`#snippet /test/i_
- Changed `hide-if-contains-visible-text` to ignore elements offset from user visible areas.
- Changed `hide-if-contains-visible-text` to support specifying an optional attribute array for CSS attributes that should be interpreted as hiding an element.
- Fixed: `hide-if-shadow-contains` did not always use the expected target.
- Fixed: `hide-if-graph-matches` did not work properly on Chromium.

# 3.14 - 2022-05-31

This release provides an experimental allowlisting API to some websites.

## Changes

- Upgraded EWE to 0.4.1 (release notes: [0.3.0](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/releases/0.3.0), [0.4.0](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/releases/0.4.0), [0.4.1](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/releases/0.4.1)) ([ui#1111](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1111), [ui#1121](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1121)), which includes the following changes:
  - Upgraded adblockpluscore to 0.7.2 (release notes: [0.7.0](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/releases/0.7.0), [0.7.1](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/releases/0.7.1), [0.7.2](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/releases/0.7.2)) ([ewe#197](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/197), [ewe#213](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/213), [ewe#225](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/225)).
  - Added support for experimental allowlisting API ([ewe#171](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/171)).
  - Fixed: Sitekey filters stopped working after reloading the page ([ewe#221](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/221)).
- Enabled experimental allowlisting API for trusted partners ([ui#1115](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1115)).
- Fixed: Language names aren't shown in settings page General tab ([ui#976](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/976)).

# 3.13 - 2022-05-20

This release contains substantial under-the-hood changes in preparation for making the extension compatible with [Manifest v3](https://developer.chrome.com/blog/mv2-transition/) later this year, as well as additional features for extended element hiding filters. It also drops support for some old browser versions, namely Chromium 76 and Firefox 62.

## User interface changes

- Developer tools panel no longer reflects changes to filters that were made elsewhere while it's open ([ui#1003](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1003)).
- Filters added via Block element dialog will only be applied after the page is reloaded ([ui#1031](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1031)).
- Developer tools panel now also shows unmatched top-level frame requests ([ui#1060](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1060)).
- Fixed: Developer tools panel no longer suggests allowlist filters for snippet filters ([ui#1023](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1023)).

## Filter changes

Started using [eyeo's Web Extension Ad Blocking Toolkit (EWE)](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/) (release notes: [0.1.0](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/releases/0.1.0), [0.1.1](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/releases/0.1.1), [0.2.0](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/releases/0.2.0), [0.2.1](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/releases/0.2.1)), which includes the following changes:

- Upgraded adblockpluscore to 0.6.0 (release notes: [0.5.0](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/releases/0.5.0), [0.5.1](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/releases/0.5.1), [0.6.0](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/releases/0.6.0)), which includes the following changes:
  - Added support for `:has()` alias for `:-abp-has()` to extended element hiding filters ([core#229](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/issues/229 'Make ":has"/":has-text" equivalent to ":-abp-has"/":-abp-contains"')).
  - Added support for `:has-text()` alias for `:-abp-contains()` to extended element hiding filters ([core#229](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/issues/229 'Make ":has"/":has-text" equivalent to ":-abp-has"/":-abp-contains"')).
  - Added support for `:xpath()` to extended element hiding filters ([core#308](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/issues/308 "Implement :xpath syntax")).
  - Added support for `:not()` to extended element hiding filters ([core#369](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/issues/369 "Inversing element hiding emulation using `:not()`")).
  - Reject filters that are too broad ([core#264](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/issues/264 "Investigate rejecting too broad filters"), [ui#1063](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1063)).
  - Indicate which filter option is invalid ([core#305](https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/issues/305 "Access invalid option from the `InvalidFilter` instance")).
  - Various performance improvements.
  - Various bug fixes.
- Fixed: Elements for blocked requests in about:blank frames aren't hidden ([ewe#152](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/152), [ui#961](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/961)).
- Fixed: Page-specific filters remained active after URL was rewritten ([ewe#109](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/109), [ui#1037](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1037)).

## Other changes

- Replaced adblockpluscore with EWE ([ui#972](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/972), [ui#998](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/998), [ui#1021](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1021), [ui#1060](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1060), [ui#1097](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1097)).
- Fixed: Messages from content scripts are ignored unless they are known to be safe ([ui#1092](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1092)).

## Chromium-specific changes

- Dropped support for Chromium 76 and below ([ui#1028](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1028)).
  _This includes Chrome 76, Microsoft Edge 76 and Opera 63._

## Firefox-specific changes

- Dropped support for Firefox 62 and below ([ui#1028](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1028)).

## Known issues

- When navigating from a page where Adblock Plus is disabled to one where it's enabled, the toolbar icon doesn't change ([ui#1120](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1120)).

# 3.12 - 2022-01-14

This release contains some general user interface improvements and introduces a feature that notifies users who frequently visit websites in other languages, if they don't have the necessary filter list installed to block ads on those sites. It also provides them with the option to add that filter list, so that Adblock Plus can block ads specifically for websites with that language.

## User interface changes

- Added language filter list recommendations ([ui#9](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/9), [ui#967](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/967), [ui#1062](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1062)).
- Added an error message that's shown when a filter list contains disabled filters, and which allows reenabling them ([ui#210](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/210)).
- Made custom filter error messages more descriptive ([ui#228](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/228)).
- Added more topics to the icon popup footer ([ui#716](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/716)).
- Updated our terminology to use "allowlist"/"blocklist" instead of "whitelist"/"blacklist" ([ui#827](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/827)) and made various other wording adjustments ([ui#183](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/183), [ui#696](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/696)).
- Removed NEW label from "Recommended filter lists" section ([ui#915](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/915)).
- Fixed: Settings page did not reflect filter state changes that occurred elsewhere ([ui#866](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/866)).
- Fixed: Overflowing custom filter error messages ([ui#946](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/946)).
- Fixed: Missing ARIA labels for settings page tabs ([ui#954](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/954)).

## Filter changes

- Added abptestpages.org to list of trusted websites that are allowed to use subscribe links ([ui#911](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/911)).

## Microsoft Edge-specific changes

- Fixed: "Rate it" button on updates page opens Chrome Web Store ([ui#895](https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/895)).
