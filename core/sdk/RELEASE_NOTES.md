# Unreleased

# 3.0.0 - 2025-11-26

- Added the `EWE.account` API to handle user accounts. (EXT-1013)
- Added `EWE.remoteConfig.getIpmCommands()` API (EXT-977).
- Added `EWE.remoteConfig.setUrl()` API (EXT-977).
- Moved the initialization of logging components to earlier in the SDK
  initialization process (EXT-1036).
- Updated user account log in request pattern (noissue)
- The script `subs-generate` has a new parameter for specifying default enabled
  rulesets
- Behavior logs can now optionally have an IPM ID associated with
  them. (EXT-920)
- Add support for $addheader filter type (EXT-1098).

## Fixes

- Added a check on extension update that DNR and our dynamic filters are in
  sync. If they are not, all DNR dynamic rules will be recreated. (EXT-938)
- Allow dnr-filters to initialize without error even if the data in prefs has
  certain type issues. This includes not reusing dynamic rules IDs for any
  existing rule, even if that is not a rule linked to one of our dynamic
  filters. (EXT-938)
- Fixed an issue where certain invalid DNR filters in a custom user subscription
  would prevent the other filters in the subscription from
  functioning. (EXT-1074)
- On extension update, if a ruleset is enabled that shouldn't be, it will now
  be disabled.

## Breaking Changes

- Removed `EWE.cdp.onCdpItem`, `EWE.cdp.isOptOut`, and
  `EWE.cdp.printLog`. (EXT-920).

# 2.1.0 - 2025-07-31

- Added cohorts to telemetry and CDP. (EXT-980)
- Added limited Safari support (NASA-739)
- Fixed initialization of experiments, cohorts, and logger after the service
  worker restarts (noissue)

# 2.0.0 - 2025-07-15

- Added the `EWE.experiments.getFlags()` method to retrieve a list of all
  current split experiment flags and their values. (EXT-867)
- Added the ability to retrieve an experiment flag from content/ui scripts. (EXT-877)
- Added new `ewe-content-api.js` to be used when importing inside
  content scripts. (EXT-897)
- Updated the minimum supported version of Node to 22. Node 22 is the current
  LTS version of Node. This only affects code that runs in Node, such as build
  scripts. This does not affect extension code running in the browser. (EXT-778)
- Added the `EWE.experiments.getFlags()` in Content and UI APIs. (EXT-880)
- Added a new event, `EWE.cdp.onBTAADetectionEvent`, which can be used to
  inspect and debug the status of the Blockthrough tag.
- Remove I don't care about cookies recommended list. (EXT-843)
- Added remote configuration support `EWE.remoteConfig` API. (EXT-946)
- Added the `EWE.cohorts` API to retrieve the current user cohort. (EXT-946)
- Add semver operator to be used in cohorts. (EXT-960)
- Skip cohort evaluation when facts haven't changed (noissue)
- Send a facts snapshot event every 12h for cohort estimations (EXT-978)
- Exposed `EWE.cohorts.getEncodedCohorts()` method to retrieve the assigned cohorts
  encoded as base64-encoded bitmap. (EXT-979)
- Exposed `EWE.experiments.getEncodedExperiments()` method to retrieve the
  experiment assignments encoded as base64-encoded bitmap.
- Added the `EWE.experiments.getAssignments()` in Content and UI APIs. (EXT-991)

## General

- Release builds are now unminified, and have inline source maps. This matches
  the configuration that we were uploading to NPM. (EXT-741)
- Added `EWE.sentry.*` API for reporting errors to Sentry (EXT-754).
- Removed "blocking" events from CDP, as they were not currently being used
  anywhere. Any code that was using `EWE.cdp.onCdpItem` to watch for blocking
  events should rather be using `EWE.reporting.onBlockableItem`.
- Now sending Blockthrough Acceptable Ads Page Views to CDP data payload. (EXT-739)
- `EWE.cdp.setPremiumStatusCallback(callback)` now accepts boolean instead of
  "premium"/"free" as a callback return. (EXT-779)
- Several errors which would have previously only been logged to the console are
  now reported to our Sentry instance. (EXT-742)
- Added the `EWE.telemetry.ServerLogger` core utility. (EXT-884)

## Fixes

- Saving of downloaded filters to IndexedDB can now continue if the database was
  previously corrupted. (EXT-679)
- `EWE.experiments.onChanged` will now also emit events when the flag values are
  overridden.
- In CDP, page views are now counted based on onCommitted events rather than
  onBeforeNavigate. This prevents double counted page view on redirect in
  Firefox.
- Fixed a bug where previously-disabled filters that are readded would be still
  be considered disabled by the DNR rules subsystem but not by other parts of
  the engine, leading to inconsistent behaviour. (EXT-926)

## Updating your code

- For automatic error reporting to be active, make sure to do the following
  (EXT-754):
  - Call `EWE.sentry.start()` as early in the initialization flow as possible.
  - Call `EWE.sentry.reportError()` whenever an error should be reported that
    are caught before they can propagate further, where they could be caught
    by Sentry automatically.
- Callback used in `EWE.cdp.setPremiumStatusCallback(callback)` has to return
  boolean instead of string. (EXT-779)
- In the `EWE.start()` parameters should replace `experiments` with
  `remoteConfig`. In addition, the `remoteConfig` can contain `getFacts` a
  function that returns an object with information to be used in the cohorts
  and experiments engine e.g. hasPremium, installDate, etc. (EXT-946)

# 1.23.1 - 2025-01-15

## General

- Moved the declared TypeScript types for webext-ad-filtering-solution
  from the extensions repo into the SDK. (EXT-662)

# 1.23.0 - 2025-01-13

## Fixes

- Fix bug where user filters that also appeared as diff updates on subscriptions
  could not be removed. (EXT-231)

## Updating your code

- Now we test starting Chromium 79 for MV2. Update required minimum browser versions,
  eg. "minimum_chrome_version" and "minimum_opera_version". (EXT-667)
- Feature flag for UCID in telemetry data is removed and it's sent by default,
  don't use it anymore. Now telemetry ping data contains `UCID` field. (DATA-2841)

# 🔿 1.22.0 - 2024-12-10 🔿

## General

- Now sending page views in CDP data. (EXT-653)
- Added `EWE.experiments.getExperiments()` method to retrieve a list of all
  current split experiments and their variants. (EXT-658)
- Added `EWE.experiments.getRevisionId()` method to retrieve the unique ID for
  the current split experiments. (EXT-658)
- Added `EWE.experiments.onChanged` API to listen to incoming split experiments
  changes. (EXT-658)

## Fixes

- Array items returned from `EWE.experiments.getAssignments()` and
  `EWE.experiments.getFlag()` methods were being duplicated. We now check
  whether the data is already being loaded before attempting to load it, so that
  parallel data accesses during initialization don't lead to multiple attempts
  to load data from storage. (EXT-658)

## Updating your code

- As CDP is switched to Phase 3, Phase 1 & 2 code is removed.
  CDP-related feature flags are removed, don't use them anymore. (EXT-615)

# 👵 1.21.0 - 2024-12-04 👵

- Added functionality to remove temporary document allowlisting filters
  when a user closes a tab or navigates away from the domain in the allowlist
  rule.
  To use this functionality, the "expiresByTabId" needs to be included
  in the rules metadata when the filter is added. (EXT-413)

## General

- Now exposing `EWE.subscriptions.hasAcceptableAdsEnabled()` method. (EXT-607)

# 🐄 1.20.0 - 2024-12-02 🐄

## General

- Added `premiumStatus` to the CDP and active ping payload. This status is
  retrieved from extension by calling callback set by extension through
  `EWE.cdp.setPremiumStatusCallback(callback)`. (EXT-543)
- Added split experiments assignments to CDP and telemetry pings. (EXT-540)

## Fixes

- `EWE.experiments.getAssignments` will now always return an object, even if the
  experiments have not been downloaded yet. (EXT-622)
- Calling `EWE.experiments.sync()` when the experiments module has not been
  started will now be treated as a network error, instead of trying to fetch an
  undefined url. (EXT-622)

## Updating your code

- `EWE.cdp.setPremiumStatusCallback(callback)` has to be called once the
  extension initialize to set a callback for premium status check, use it in CDP
  and active ping payload. (EXT-543)
- This update requires also updating to the specified versions of the Telemetry
  active ping URL to version 3. This new URL version is backwards compatible,
  and so the update can be done at any time before the upgrade to this version
  of the SDK. (EXT-540)

# 💾 1.19.0 - 2024-11-25 💾

## Fixes

- Fixed disabling filters in MV3 only updating the rules but not updating the
  engine's filter state. This lead to inconsistent reporting, since the engine
  thought that filters were active even if they had been disabled. (EXT-249)

## Updating your code

- CDP payload is now shrinked and compressed, the retry count is limited.
  It requires CDP active ping backend URL schema #3. (EXT-452)
- Added CDP request property whether AA is active and it requires CDP active ping
  backend URL schema #4. (EXT-428)

# 📔 1.18.0 - 2024-11-20 📔

## Split experiments

- Added a mechanism to dynamically run split experiments. Users are assigned to
  experiments and variants uniformly. Functionalities for interacting with split
  experiments are exposed through the `EWE.experiments` API. (EXT-531)

# 🗧 1.17.2 - 2024-11-19 🗧

## Fixes

- Fixed the bug of printing too much of CDP log which slowed down
  user devices. (EXT-588)

# 👄 1.17.1 - 2024-11-13 👄

- Extended the error message with the ruleset ID, in case of a failure when
  trying to update the enabled rulesets.

# 🎥 1.17.0 - 2024-10-24 🎥

## General

- Added CDP event logging to fix numbers anomaly. A new feature flag for it is
  introduced while staying disabled by default. (EXT-414)

# 🐱 1.16.0 - 2024-10-10 🐱

## General

- Added `-p`/`--pretty-print` argument (default: `false`) to `subs-convert`
  script to specify whether generated JSON files should be pretty-printed or
  minified (EXT-395).
- Ruleset files no longer include `"isUrlFilterCaseSensitive": false` for
  filters that don't specify `$match-case` because it is no longer needed
  (EXT-383).
- Added 2 more events for smart allowlisting, that are sending the filter with
  it's metadata (EXT-376):
  - `EWE.filters.onRenewed` emitted when a smart allowlist filter is extended.
  - `EWE.filters.onExpired` emitted when a smart allowlist filter has expired.

## Updating your code

- If JSON files generated via the `subs-convert` script should not be minified,
  pass the `-p`/`--pretty-print` argument to the `subs-convert` script.

# 🎄 1.15.0 - 2024-10-01 🎄

## General

- Add a `force` flag to `EWE.subscriptions.addDefaults()`, to allow re-adding
  the default subscriptions regardless of any current subscriptions or user
  filters. (EXT-375)
- Now passing web extension id as `extension_name` CDP phase 3 pings. (EXT-74)

## Fixes

- Fix a bug where dynamic rule state was not being properly persisted when a
  subscription is removed, potentially causing issues if the subscription is
  readded.

# 🏇 1.14.0 - 2024-09-26 🏇

## General

- Add a type of exported code to the SDK: utilities which can run in any
  Javascript context. These are exported in the
  `@eyeo/webext-ad-filtering-solution/all/*` namespace. See the "Module
  bundlers" section of the readme for more details. (EXT-121)
  - The Scheduler utility can be used for repeatedly calling functions with a
    large timeout.
  - The Errors utility has functionality for suppressing communication errors
    between the background script and pages which may no longer exist.
- Now using the actual timestamp instead of request timestamp for CDP. (EXT-266)
- Now if user was inactive for more than 30 minutes on a website and then
  became active, we consider it as a new CDP session. (EXT-323)
- Now user cursor move does not extend the CDP session. (EXT-328)
- Now eyeometry request includes UCID (unique client identifier).
  A new feature flag for it is introduced while staying disabled by default.
  (EXT-347)

# 👕 1.13.0 - 2024-09-12 👕

## General

- Now tracking all the domains sessions for CDP and apply all the phase 3 logics
  including domains trimming, splitting and data encryption. A new feature flag
  for it is introduced while staying disabled by default. (EXT-175)

## Fixes

- `EWE.filters.getMigrationErrors()` and
  `EWE.subscriptions.getMigrationErrors()` will now always return a promise that
  resolves to an array. Previously, if the user had the wrong type in storage,
  then the wrong type could be returned, which lead to type errors downstream in
  the extensions. (EXT-118)

# 🗃 1.12.0 - 2024-08-27 🗃

## General

- Now we count Expedia visitors for CDP. (EXT-132)
- Enable using the `browser.scripting` API for injecting snippets in Firefox MV2
  extensions. This allows injecting snippets in pages which set a restrictive
  content security policy against inline scripts. If the scripting API is not
  available, the engine will still fallback to the previous approach. This
  requires adding the `scripting` permission. The `browser.scripting` API is not
  available MV2 for Chromium-based browsers, so this is only needed for
  Firefox. (CV-3174)

## Updating your code

- Add the `scripting` permission for Firefox MV2 extensions, to allow snippets
  to be injected using the `browser.scripting` API. (CV-3174)

# 🐫 1.11.0 - 2024-08-08 🐫

## General

- Reverted a new query parameter in `downloader`. (EE-511, EE-837)

## Fixes

- In MV3, use the `requestDomains` condition in DNR rules for main frames, so
  that `$document` filters work correctly together with the `$domain` filter
  option. (EXT-55)
- Fixed the CDP sessions counting (now using the correct time frame and
  deferring the browser events processing until the sessions data is
  loaded). (EXT-10)
- Fix issue where diff updates in MV3 would sometimes get into a state where
  diffs would no longer be applied because the system had stored that
  update had already been applied. The diff update mechanism will now always
  apply the diff to the base version of the subscription that is bundled with
  the extension. If the base version cannot be loaded, then the update will fail
  with a `downloadStatus` of `synchronize_diff_error`. (EXT-54)

# 🙈 1.10.0 - 2024-07-09 🙈

## Smart Allowlisting

- Added 2 special optional properties to the filter's metadata.
  `metadata?.expiresAt` allows to set an expiration timestamp for the
  associated filter. (EE-735)
  `metadata?.autoExtendMs` used together with `metadata?.expiresAt` (applicable
  only to allowlisting filters), this property will automatically extend the
  filter's expiration time by the specified number of milliseconds if the user
  visits the associated allowlisted website before filter expiration. (EE-735)

## One Click Allowlisting

- Added support for time bound filters added via 1 click allowlisting. Pages can
  send an additional `options` object which contains an `expiresAt` timestamp.
  The default allowlisting callback will add this as filter metadata, so that
  the filter will automatically expire. (EE-752)
- Added a new reason `invalid_options` for `AllowlistingAuthorizationError`. (EE-752)

## General

- Attempting to add a filter that has already been added no longer throws an
  error. Instead, those filters are ignored and not added again. If the new
  filter has different metadata from an existing filter, the metadata will not
  be updated. The error reason `storage_duplicate_filters` is no longer
  used. (EE-361)
- User counting telemetry now has an opt-out mechanism. Users are opted out of
  telemetry by default, to avoid accidentally sending pings for users who have
  opted out before an extension can set the opt-out status. Set opt-out by
  calling `EWE.telemetry.setOptOut`. (EE-579)

## Updating your code

- All extensions that provide `telemetry` credentials to `EWE.start` should now
  be calling `EWE.telemetry.setOptOut` as well to opt users in for sending
  user counting telemetry. (EE-579)
- If you provide your own 1 click allowlisting callback with
  `EWE.allowlisting.setAllowlistingCallback`, then your callback should be
  updated to accept the new optional `options` parameter, and add
  `options.expiresAt` as metadata on the allowlisting filter it creates. (EE-752)

# 💅 1.9.0 - 2024-06-25 💅

## General

- Implemented a new query parameter in `downloader` to support safe filter
  lists. (EE-511)

## Updating your code

- This change will require rebuilding on the rules list to apply new safe
  query parameter for easylist.

## Fixes

- Fixed failing `npm run build -- --force-subscription-update` script.
- When updating subscriptions in MV3 (both diff updates and full updates), no
  longer fail the update if there are invalid filters. Valid filters will
  now be applied, and the invalid filters will be ignored. (EE-565)
- Fix validation of regex filters in DNR rule conversion. It was previously
  marking all regexes as valid when using the browser's `isRegexSupported`
  function, which would then result in an unexpected error later in the process
  when trying to add the resulting DNR rules. (EE-565)

# 🏰 1.8.0 - 2024-06-11 🏰

## Fixes

- Now we handle "Failed to fetch subscription content" and eyeometry
  is started anyway. (EE-556)

## CDP

- The CDP feature flag has been removed. It is now enabled by default. See
  <https://gitlab.com/adblockinc/ext/adblockplus/adblockplus/-/issues/1683> for
  more information on CDP.
- A new property has been added to the argument object passed to
  `EWE.start()`. The `cdp` property is used to specify URLs and credentials for
  the CDP telemetry server. (EE-473)
- A ping is made to the telemetry server the first time a partner's domain is
  visited each day, to allow tracking the number of users who visit partners'
  domains. (EE-474)
- The number of sessions for configured partner's domains is now gathered to be
  sent to the CDP telemetry server. (EE-473)
- Exported `EWE.cdp` namespace with `onCdpItem` dispatcher, `setOptOut()`, and
  `isOptOut()` methods for allowing users to opt out of data
  collection. (EE-461)
- Firefox users are opted out of CDP by default. Chrome and other browser users
  are opted in by default. (EE-461)
- Now we count Amazon visitors for CDP. (EE-474)
- Now we count Yahoo visitors for CDP. (EE-529)
- CDP events performance improvement (debouncing). (EE-473)
- Count only CDP events for outer most frames. (EE-473)

# 🍿 1.7.0 - 2024-05-20 🍿

## General

- Restrict the syntax for inline CSS filters to only values known to be
  safe. Inline CSS filters are still restricted to privileged filter lists, and
  are still behind a feature flag which disables them by default. (EE-341)
  - Two new reasons have been added for `InvalidFilter`
    - `filter_elemhide_invalid_selector` indicates that an element hiding or
      element hiding emulation filter's selector is invalid. Currently,
      selectors that begin with an `@` are considered invalid.
    - `filter_elemhide_invalid_inline_css` indicates that the inline CSS is
      invalid. This could be from using invalid syntax, or by using a CSS value
      which is not allowed.
  - See the filter syntax spec for details on which values are allowed: <https://gitlab.com/eyeo/adblockplus/ad-filtering-working-group/-/blob/da0f0d97a5e7b4717788676c6c0091cdd1ec8bee/filter-syntax.md#element-hiding>
- Removed `declarativeNetRequest.updateStaticRules` checks, since Chrome 124 is
  the minimum required version for MV3. (!1036)
- We no longer rerun the snippets on History event pushed to prevent
  performance drop. (EE-507)
- Introduced CDP feature flag and "user opted out" setting
  (opted out by default). It does not have an effect if turned on. (EE-473)

## Fixes

- We now save the sitekeys in `browser.storage.local` to avoid filling
  `browser.storage.session` fully and clean the outdated frames
  sitekeys early. (EE-64)
- Fixed adding dynamic rules twice after subscription enabling. (EE-428)
- Fixed issue where `EWE.filters.validate` reported filters as invalid when in
  fact the filters were just not normalized. (EE-444)

# 🍥 1.6.0 - 2024-04-08 🍥

## General

- Start generating type definitions and include type checks in CI. (!941)
- Remove unused minification build of the core project. (EE-314)
- Changed the default output of the scripts from `scriptsOutput/custom-subscriptions.json`
  to `scriptsOutput/custom-mv3-subscriptions.json` (!1017)

## Fixes

- We now wait for 2 seconds more (configurable in
  `Prefs.edge_one_click_allowlisting_delay`) in the one click allowlisting
  scenario on Edge to let it actually finish adding allowlisting DNR rules.
  This is an increase from 1 second. (EE-258)
- No longer log an error to the console when the history state updates on a page
  where our content script is not injected, for example on an extension
  page. (EE-349)
- Events are no longer emitted for removed subscriptions. (EE-355)
- When a subscription update fails because the limit on disabled static DNR
  rules is reached, the subscription's download status will now be set to
  `synchronize_diff_too_many_filters`. (EE-356)
- Disabled static DNR rules no longer contribute to the disabled static DNR rule
  limit after the subscription is disabled or removed. (EE-356)
- The wildcards in the URL portion of request filters are now working in MV3 as
  before 1.2.4. This impacts the generation of DNR rules. (EE-366)
- Fixed documentation errors. (!1021)
  - `saveMigrationError` is not publicly accessible and should not have appeared
    in the API docs.
  - The snippets injection code example in the readme was incorrectly updated
    suggesting that the parameters passed to `EWE.snippets.setSnippetLibrary`
    had changed when they had not.
  - Added the `synchronize_invalid_data` status to the documented list of values
    for `downloadStatus` on subscriptions.

# 🌳 1.5.0 - 2024-03-06 🌳

## General

- Subscriptions now have a new property `lastModified` to match the
  `! Last modified:` header from the filter lists. It is used to determine when a
  subscription is too old to receive new diffs. (EE-297)
- The `downloadStatus` of the subscription has a new possible value. When the
  download of a diff fails, `downloadStatus` will be set to the new error
  `synchronize_diff_too_old` if the diff is over 6 weeks old, or
  `synchronize_connection_error` otherwise. (EE-297)
- Allow subscriptions on abptestpages.org for testing purpose. (EE-323)
- Use the actual dynamic filters quota API property
  (increase from 5K to 30K dynamic rules limit on Chrome/Edge 121+). (EE-315)
- Bundled subscription information (including diffUrl) is now updated when the
  extension is updated. (EE-328)
- Now we check whether snippets are initialized with `setSnippetLibrary()` and warn
  if necessary. (EE-342)
- Added a new feature flagging mechanism. This adds a new property to the
  configuration passed to `EWE.start()`, which can be used to turn on
  features which are still in development. (EE-337)
- Support for inline CSS filters is now behind a feature flag, and is disabled
  by default. If you try to add an inline CSS filter with this feature disabled,
  it will be an `InvalidFilter` with a reason of `filter_unknown_option`. This
  can be enabled by setting the `inlineCss` feature flag to `true` when calling
  `EWE.start()`. (EE-337)

## Fixes

- Port is now ignored when matching with wildcards. (EE-288)
- Subscription now have their diffs downloaded immediately after migration. We
  no longer migrate `lastDownload` when going from MV2 to MV3. (EE-326)
- Fixed a bug where blocked images might be not hidden in some cases. (EE-325)
- We now wait for 1 second more (configurable in
  `Prefs.edge_one_click_allowlisting_delay`) in one click allowlisting scenario
  on Edge to let it actually finish adding allowlisting DNR rules. (EE-258)
- Fixed a bug where filter normalization was incorrectly applied when using diff
  updates in MV3. Un-normalized `remove` filters were not being applied.

## Custom User Subscriptions in MV3

- Enabled custom user subscriptions in MV3 extensions. (EE-117)
- If `EWE.subscriptions.add()` is called with a subscription URL that is not one
  of the subscriptions bundled with the extension, the subscription will be
  added as a custom user subscription. The filter text will be downloaded from
  the provided URL in the same manner as MV2 subscriptions.
- Declarative Net Request rules applied by custom user subscriptions use dynamic
  rules, and so there is a limit to how big these subscriptions can be. If the
  subscription requires more rules to update than are available, it will no
  longer update, and will have a `downloadStatus` of
  `synchronize_too_many_filters`.
- If there is an unexpected unknown error when applying the DNR updates,
  `downloadStatus` will be set to `synchronize_dnr_error`.
- When an extension migrates from MV2 to MV3, any subscriptions that the user
  had in the MV2 extension which are not bundled in the MV3 extension are
  migrated to custom user subscriptions.
- If an extension had previously upgraded from MV2 to MV3, these custom
  subscriptions would have been saved as subscription migration errors. When
  updating the extension to this version of the SDK, these migration errors will
  now be recovered into custom subscriptions. If you have not upgraded to this
  version of the SDK yet, please avoid clearing the migration errors until after
  updating and calling EWE.start.
- When an MV3 extension is updated, and a previously bundled subscription is no
  longer bundled in the new version of the extension, the subscription will not
  be migrated to a custom user subscription. It will be removed entirely.
- When an MV3 extension is updated, and user's custom subscription is now
  bundled with the extension, their custom subscription will be converted into a
  normal MV3 subscription, including using the bundled subscription's metadata,
  static rules, and diff updates.

## Browser Support Updates

- From now on, the latest versions of Chromium, Firefox, and Edge are supported
  by the engine (latest versions at the time of release).

# 📠 1.4.1 - 2024-02-02 📠

## Fixes

- Fixed a bug where elements to be collapsed would stay visible on edge cases. (EE-282)
- Fixed a crash on message sent from a popup. (EE-320)

# 🔽 1.4.0 - 2024-01-26 🔽

## General

- Add support for an inline CSS action on elemhide emulation filters with the
  syntax `example.com#?##elem-id {property: value;}`. Multiple properties can be
  included inside the curly braces. These filters are only allowed for privileged
  subscriptions. (EE-261)
- Dramatically improved the performance on single-page websites that are
  using History API (eg. Youtube). Reapplied "Content filters are now
  updated via the `history.pushState()` event, when single page apps
  navigate using the browser's history API (EE-14, EE-90)". (EE-300, EE-303)

## Fixes

- Fixed a bug where $document filters were not being applied to iframes if the
  source URL of that iframe is set via javascript. (EE-307)

# 📘 1.3.1 - 2024-01-19 📘

## Fixes

- Added the `injectImmediately` flag when injecting main context snippets in
  MV3. This applies the snippets earlier in the page loading lifecycle. See
  [MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript#injectimmediately)
  for more details. (CV-2037)
- Handle first party requests in third party iframes correctly. (EE-304)
- Reverted "Content filters are now updated via the `history.pushState()` event,
  when single page apps navigate using the browser's history API (EE-14,
  EE-90)". (EE-300)
- Fixed not disabling rules from static rulesets. (EE-294)
- Fixed a bug where removing a user filter ends up removing it from a subscription.
- `EWE.subscriptions.addDefaults()` no longer throws an error when there are no
  subscriptions tailored to the user's language. (EE-301)
- Fixed a bug of not allowlisting with sitekey in case of unhappy events order
  from the browser. (EE-281)

# 📣 1.3.0 - 2024-01-03 📣

## General

- Added wildcard domains support for content filtering in elemHide. (EE-248)
- URL filters with wildcards (.*) are no longer converted into DNR rules
  as Chromium does not support it. (EE-274)
- Exposed a new `EWE.filters.normalize()` function. (EE-11)
- Add support for a "remove" action on elemhide emulation filters with the
  syntax `example.com#?##elem-id {remove: true;}`. Matched elements will be
  removed from the DOM, rather than just hidden. (EE-255)
- Elemhide emulation filters with the "remove" action now emit `onBlockableItem`
  events when the element is removed, the same as normal element hiding
  filters. They can be distinguished from normal element hiding because the
  filter has the property `remove` set to `true`. (EE-293)

## Fixes

- Fixed not sending a notification when subscription downloading is finished. (EE-285)

## Browser Support Updates

- This engine now supports up to:
  - Chromium 120
  - Edge 120
  - Firefox 120

# 🌻 1.2.0 - 2023-11-27 🌻

## General

- Added wildcard domains support for content filtering in elemHideEmulation. (EE-248)
- There is now a new method for getting a list of active subscriptions,
  `EWE.subscriptions.getSubscriptions()`. This replaces
  `EWE.subscriptions.getDownloadable()`. The data returned by `getSubscriptions`
  is the same as `getDownloadable`, but with `updatable` and without
  `downloadable` property. Some other functions that return subscriptions
  (eg. `getForFilter`) or events that contain subscription object also provide
  `updatable` property, while still having `downloadable`. (EE-212)

## Updating your code

- If you were using `EWE.subscriptions.getDownloadable`, switch to using
  `EWE.subscriptions.getSubscriptions`. `getDownloadable` has been deprecated
  and will be removed in the next major version.

## Fixes

- Fixed an edge case where onBlockableItem events in MV3 would be missing their
  allowlisting filter if the browser was loading resources before committing the
  frame the requests were for. (EE-221)
- The declared "adblockpluscore" dependency is removed, though it still
  uses it behind the scene during the building. (EE-219)
- The rulesets-related scripts for MV3 are fixed and are working from command-line
  (eg. `npx subs-convert`). (EE-267)

## Browser Support Updates

- Upgraded stable browser versions running in the CI. (EE-213)
- This engine now supports up to:
  - Chromium 118
  - Edge 118
  - Firefox 119

# 0.13.3 - 2023/11/23

## Fixes

- The rulesets-related scripts for MV3 are fixed and are working from command-line
  (eg. `npx subs-convert`). (EE-267)

# 0.13.2 - 2023/11/15

## General

- Integrators should now be able to run npm install multiple times.
  The declared "adblockpluscore" dependency is removed, though
  the engine still uses it during building. (EE-219)

# ☀ 1.1.1 - 2023/10/26 ☀

## Fixes

- The engine no longer throws an exception when checking if the a request made
  from an opaque domain should be blocked. (EE-215)
- The engine no longer sometimes throws a TypeError from the popup blocker in
  MV3 when the service worker starts in response to a tab being closed. (EE-229)
- When converting filters to MV3 rules, the `isUrlFilterCaseSensitive` property
  is now always set. This previously relied the default value if the filter was
  case sensitive, but the default value was changed in Chromium 118 leading to
  inconsistent behaviour. This affected filter texts that use the `match-case`
  option. (EE-233)
- No longer throw a TypeError from the popup blocker if we don't have frame info
  for the opener yet. Similarly avoid other unhandled TypeErrors caused by the
  frame info not being available yet. (EE-228)
- No more "Message manager disconnected" error message in the log on Firefox
  prior version 79. (EE-227)
- The `onBlockableItem` event will now use the initiator when setting the request's
  `docDomain` when loading cross-domain iframes in MV3. (EE-217)

# 🎃 1.1.0 - 2023/10/10 🎃

## Documentation

- Improved the API docs for telemetry. (!837)
- Improved documentation for the `--recommended-subscriptions` flag (!838)

## General

- Privileged is now a property of a subscription and not purely based on the
  type of that subscription. The privileged property allows for subscriptions
  to run snippets. You can add a privileged subscription by passing the
  `privileged` property in the options.
  Ex: `EWE.subscription.add(url, {privileged: true})`
  You can also add the privileged property to the recommendations file, and the
  subscriptions added by calling `EWE.subscriptions.addDefaults()` will have
  the specified privilege. If not provided, privileged will be true for
  circumvention subscriptions. (EE-182, !840)
- We now test on Edge 111. (!839)
- All the public API methods (eg. `EWE.filters.add(...)`) wait for the data
  to be saved. (EE-44)
- The `alarms` permission is no longer required to use telemetry. (EE-159)

## Fixes

- When a filter uses the `~third-party` flag, the `filter.thirdParty` property
  will now correctly be set to `false`. This bug was only in returning the
  filter externally, and did not affect request filter matching. (EE-220)
- We no longer accidentally return the internal 'originalUrl' property on
  a subscription.

# 🚀 1.0.0 - 2023/09/21 🚀

## General

- We updated the product name in the documentation and old release notes.
  The term "SDK" has broadly been replaced with "Engine". There's a new npm
  module called `@eyeo/webext-ad-filtering-solution/`. (EE-189)

### Diff Updates

- Added two new possible statuses to the subscription property `downloadStatus`:
  `"synchronize_diff_too_many_filters"` and `"synchronize_diff_error"`.
  The first one is emitted when a diff update reaches the limit number of
  dynamic rules, and the second is when any other error happens during the diff
  update. (EE-85)
- To ensure user counting still works, we now send `firstVersion`
  and `lastVersion` request arguments for diff updatable
  subscriptions. (EE-153)
- If the same filter is present and active in subscription and in user filters,
  it ends up in correct state when disabled. (EE-97)

### Telemetry

- Telemetry pings are now repeated every 12 hours if telemetry is enabled. If
  the extension isn't running when it is time for the next ping, then the ping
  happens the next time the extension starts up. This requires the `alarms`
  permissions to be added to the manifest file. If the telemetry server has an
  error, then the next retry will happen in 1 hour instead of 12. (EE-159)
- Added a new event emitter, `EWE.telemetry.onError`, which will emit an event
  whenever a call to the telemetry server fails. (EE-159)

## Fixes and improvements

- Fix a bug that was making the element hiding filters not work when
  the extension doesn't add a listener to `onBlockableItem` with
  `includeElementHiding: true`. (EE-204)
- `isResourceAllowlisted()` is now consistent with `getAllowingFilters()`. (EE-141)
- No more duplicates in element hiding filter hits reporting and invalid
  CSS selectors will not break element hiding filter hits reporting anymore.
  (EE-187 and EE-185)
- Updated the minimum supported version of Node to 18. Node 18 is the current
  LTS version of Node. This only affects code that runs in Node, such as build
  scripts, and the scripts used to download MV3 subscriptions for bundling. This
  does not affect extension code running in the browser. (EE-192)

## Update your code

- If you're using the npm module you should now use
  `@eyeo/webext-ad-filtering-solution/` instead. (EE-189)
- If you're building your product using the `--config-name` option please update
  the value accordingly to using the correct name(s). (EE-189)
- If you're using the `EWE.subscriptions.onChanged` API to listen to changes
  in `downloadStatus`, you might want to handle the new status values
  `"synchronize_diff_too_many_filters"` and `"synchronize_diff_error"`. (EE-85)
- Add the newly required `alarms` permission to the manifest file if you're
  using telemetry. (EE-159)
- If you are using npm scripts, ensure you are using Node version >=18 and npm>=9.
  (EE-192)

## Internal

- Reduce unnecessary CI logs in Windows builds by not printing progress logs
  from Choco.
- Ensure tests for func:v2:windows:edge:stable and func:v2:windows:edge:incognito
  are run in the CI pipeline. (EE-169)
- Fix flaky Fuzz Edge test in MV3 "does not hide an element on a sitekey
  allowlisted page". (EE-120)

# 🌶 0.13.1 - 2023/09/27 🌶

## Fixes

- Fix a bug that was making the element hiding filters to not work when
  extensions didn't add a listener to onBlockableItem with
  `includeElementHiding: true`. (EE-204)

# 0.13.0 - 2023/08/28

## General

- Diff updates are now not wiped out during web extension restart
  in a new browser session. Web extension version (in manifest)
  now needs to be updated to let the Engine know to reload bundled
  subscription data (EE-166).
- `hide-if-classifies` snippet does not require domains now, the new syntax now
  accepts filters that follow this pattern: `#$#hide-if-classifies .selector`
  (EE-138).
- We now gather and send all the correct information to the telemetry server. We
  don't yet handle any timing or retry logic. (EE-159)

## Fixes

- Enabling a ruleset no longer emits a "subscription.updated" event
  unless a subscription is updated (EE-153).
- Fixed a bug where diff updatable subscriptions would not use the correct
  expiration date present in the header and instead use the default value of
  5 days. The `covertSubscriptions.js` script was updated to handle the expires
  property in a similar way to the `diff_url`, adding the `expires` property to
  the recommendations that are passed to `EWE.start()`. If this property is
  omitted they will use the default 5 days, but no change is required from the
  integrators at the moment since the new version of the script should handle
  everything automatically. (EE-167)

## Internal

- We have a new dev dependency 'webpackDotenvPlugin' for getting the correct
  package version for telemetry purposes.
- EWE.start now logs start-up warnings in our test extension. (EE-159)
- Add test to make sure that subscriptions with diffs are updated correctly when
  they expire. (EE-164)
- Our internal method for testing requests sent to a server now has automatic
  URL filtering to better decouple tests.
- `Subscription.insertFilterAt()` is deprecated in favour of
  `Subscription.insertFilterTextAt()`,
  `Subscription.findFilterIndex()` is deprecated in favour of
  `Subscription.findFilterTextIndex()` for better performance (EE-114).

## Tests

- Now skipping "fixes the IO/Prefs prefixes" test on FF 115+ as it's not using
  `browser.storage.local` in private mode (due to IndexedDB support) (EE-154).
- Few tests added to make sure user that counting is working for diff updatable
  subscriptions on MV3 (EE-153).
- Update get-browser-binary version to 0.13.0

# 0.12.0 - 2023/08/03

## Fixes

- Prevent racy subscription updates in MV3 (EE-156).
- Subscription properties are now updated for MV3 subscriptions (EE-157).

## Internal

- Added security static analysis and codeclimate analysis for better code
  quality.
- Exclude Fuzz Edge tests from Branch runs.
- Upgrade get-browser-binary.
- Add timeout to "does not block a popup opened by a document" tests if fuzz
  test runs in edge. (EE-100)
- Add popup tests for diff update scenario. (EE-158)

## Eyeometry implementation

Don't use this yet unless you want an initial sense of what the integration will
be like.

Assuming you want to start using it. Integrators need to add a new property to
the addonInfo object passed into the EWE.start function.

```js
addonInfo.telemetry = { url: "", bearer: "" };
```

The current implementation pings the specified server once at startup. Nothing
happens if the telemetry object isn't provided. (EE-159)

# 0.11.0 - 2023/07/13

This release also includes fixes from 0.10.1

## General

**This version introduces DiffUpdates. More details on the exact
changes and integration notes can be found below. If you start
integrating this version, please get in touch with the DATA team
immediately to sync on potential implications on the user counting.
Reach out to [Maria Henkhaus](mailto:m.henkhaus@eyeo.com).**

- Added mechanism to update the static rulesets in Manifest V3 when a
  diff update is received. That change provides users with the ability
  to have DNR rules added and removed in between extension releases,
  as long as the limits imposed by the browser are not surpassed.
  (#503, #505, #528, EE-26, EE-84, EE-86, EE-88, EE-89, EE-92)
- The script `subs-convert` now also rewrites the recommended subscriptions file.
  While converting the filters in DNR rules, it also reads the diff url from the
  subscription and, after converting, rewrites the recommended subscriptions
  file adding a `diff_url` property to the related subscription. A new option
  `--recommended-subscriptions` was added to the script, and should receive the
  path to the recommended subscriptions file.
- The minimum tested version of Chrome for Manifest V3 is 111. (#563)
- The following APIs now accept a single string as a parameter in
  addition to an array: `filters.add()`, `filters.enable()`,
  `filters.disable()`, and `filters.remove()`. (#188)
- A tolerance for clock skewing has been added to one click
  allowlisting signature verification. The signature includes a
  timestamp of when the signature was generated, and the signature is
  invalid if the timestamp is in the future or an hour in the
  past. Previously, we assumed that clocks were perfectly synchronised
  between the signature generating server and the signature verifying
  client. Now we allow the clocks to be out of sync by up to 5
  minutes. (#523)
- `filters.onChanged` is also called when filter metadata is changed.
  (#524)
- `filters.getMetadata` will now return `null` rather than throwing an
  error if the filter has no metadata or if the filter does not
  exist. (EE-17)
- `filters.add()` will now enable the added rules if they were
  disabled previously. (EE-13)
- Content filters are now updated via the `history.pushState()` event, when
  single page apps navigate using the browser's history API (EE-14, EE-90)

## Fixes

- Fix performance issues when adding 5000 dynamic rules. (#538, #553)
- Amend maximum number of filters allowed to be added from 4999 to
  5000 (#539)
- Requirement to have the `declarativeNetRequestFeedback` permission
  has been removed as it was not used. (#440)
- Unexpected response from `filters.isResourceAllowlisted()` during
  the tab loading in some cases (EE-16)
- CSP filters ignored if domain isn't provided in the filter text (EE-25)

## Documentation

- Clarify the minimum tested versions (#460)
- Permissions we need, and why we need them, have been added to our
  documentation. (#440)
- Documentation aimed at understanding the diffing process (EE-84)

## Internal

- Update issue templates for the acceptance checklist (#534).
- Added a top level `updatepsl` npm script to call the one from
  core. (!635)
- Added `markdownlint` npm script to lint the documentation. (!683)
- Changed code style rules to require curly braces. (EE-119)
- Refactor start-server, splitting the logic for each server and
  request logging into separate modules. (#543)
- Webpack extension reload mechanism added for local development (#560)
- Core: Added API `Subscription.addFilterText` and
  `Subscription.findFilterTextIndex` for when you only have a filter
  text. (EE-26)
- Core: Added filter notification `subscription.dnrUpdate`. (EE-26)

## Tests

- Wait for the subscription to download before doing any assertions (#557).
- Add the test to allow popup if opener is allowlisted (#475)
- Wait until saving is completed before suspending service worker (#364).
- Remove "manual jobs" from branch pipelines.
- Reflect CI pipelines setup & change how we check if subscription is
  synchronized (EE-101)
- Increase tolerance for waiting for tab to be blocked (EE-93)
- Fix failing test, not downloading subscription due to
  header invalid data. (#561)
- Fix skip-build flag not working properly on "npm measure flakiness"
  and move test check to not run on branch.
- Run tests in isolation on "check tests" pipeline.
- Added compliance testing against testpages. (#558)
- Add default false value for `RUN_ONLY_FLAKY` in Dockerfile.
- Ensure everything is saved when adding default subscription. (#536)
- Extract API subscriptions tests into a separate file. (#259)
- Increase timeout for Allowlisting test & increase webdriver script
  timeout. (#532)
- Run all tests on nightly run.
- Optimize runs by using build from runner, fix caching
  browsers. (!688, !693)
- Set timeout for `resource.expectToBeBlocked()` and remove
  `shouldBeBlocked()`. (#544)
- Document tests properly. (#417)
- Some no longer used testing code removed (!679).
- Stabilise `reload` tests by adding sleep & increasing one of the
  timeouts. (#544)
- Optimize the CI pipeline and measure test flakiness on nightly
  pipeline runs. (#436)
- Run chromium tests using the new headless mode. (#535)
- Remove unneeded incognito parameter in `startRun()` method in runner.
- Display the proper version for Edge testing on Windows.
- Use proper monotonic clock for the testing measurements.
- Increase the timeout for "logs element hiding filter dynamically"
  test. (#480)
- Increase timeout for flaky "subscribe to a link". (#537)
- Increase timeout for flaky "updates the subscription filter text when
  updating the extension". (EE-71)
- Improve reliability of the filter list updates test. (#510)
- The core browser test now also uses webpack 5. (#490)
- Tests which test events in the background page / service worker now
  send those events to the test extension page immediately. (#414)
- Fix mocking of network requests in the MV3 filter list fetching
  script unit tests. (#492)
- Improve reliability of several "reload" tests. (#512)
- Added a mechanism for fuzz tests to wait for the service worker to
  fully initialize before running assertions. (#513)
- Improve reliability of test "createKeypair script". (#533)
- Remove a test retry forgotten from 0.9.0. (#401)
- Update log tests to account for some logs which are correct but only
  emitted in certain edge cases. (#522, #530)
- Improve console logging test mechanism test to continue working when
  other debugging logging is used. (#531)
- Tests now wait for filters to save after adding them before
  proceeding. (#517)
- Wait longer for service worker to start up again in test. (#532)
- Unskip the "ignores messages without a type property" test. (#191)
- Added a mechanism for dynamically mocking url endpoints in our test
  server. (#427) Adapted tests to use the new mechanism.
- Test "gets user subscriptions for a filter" is now run on
  MV3. (#339)
- Skip the test "fixes the IO/Prefs prefixes" in non-incognito
  mode. (#551)
- Fuzz tests now run a representative subset of the functional tests,
  rather than all of them. (#550)
- Fuzz tests for onBlockableItem now wait for the service worker to
  have started up before checking for the expected events. (#542,
  #546)
- Add test to check prioritising allowing filter rules over
  subscription rules (#293)
- New NPM script "build-then-test" created to build project and run
  tests in a single command (#560)
- "npm run test" and "npm run build" automatically run test server if
  not already running (#560)
- Fix a test pointing at an external resource (testpages) instead of
  using its own test data (EE-123)
- Update the domain of the testpages from the old
  testpages.adblockplus.org to the new abptestpages.org (EE-126)
- Add the test to make sure adblockpluscore subscription list works (EE-41)
- The "Diagnostics" tests sometimes fail in Edge, we added 3 retries
  to keep them green while we are still working to solve the underlying
  cause of the issue (#559, EE-21)
- Unskip the test "remove custom filter that is already on subscription
  as a custom filter only" for mv2. The test is also updated to ensure
  that assertions are accurate. (EE-79)
- Reduced the amount of memory used by the Core unit test suite. (EE-24)

## Updating your code

- No change is necessary but `filters.add()`, `filters.enable()`,
  `filters.disable()`, and `filters.remove()` can now accept a single
  string as a parameters if you only need to apply it to a single
  filter. (#188)
- The static DNR ruleset must be regenerated with `npm run
subs-convert`. Make sure your build process also copies the
  corresponding `.map` files. (#528)
- The scripts were updated to read the `DiffUrl` property in the
  subscriptions and add a `diff_url` property to the generated
  files. Make sure that the generated subscription objects have
  this new `diff_url` property. (#503)
- For MV3, Chromium 111 is the new minimum supported version. (#563)

# 0.10.1 - 2023/02/24

## Fixes

- Fix import errors when running the scripts and when importing
  individual Engine modules: adblockpluscore is again a dependency with
  internal file location. (#518)

# 0.10.0 - 2023/02/20

## General

- The `$webbundle` filter type is now supported. (#495)
- `adblockpluscore` is no longer a dependency in the `package.json`,
  while still exported. This fixes issues installing the package using
  yarn. (#511)

## Fixes

- When a subframe is allowlisted using a `$document` filter on its
  parent frame, `onBlockableItem` will now correctly report its
  `docDomain` as the domain of the parent frame. (#494)

## Tests

- Fixed some flaky tests:
  - API > Subscriptions > Filter list updates > block content after
    the filter list update. (#496)
  - Notifications -> returns the correct state for ignored categories
    after unignoring. (#448)
  - Make the "get the first version" test more reliable. (#508)

## Updating your code

- If you want to use the exported `adblockpluscore` code, import
  `@eyeo/webext-ad-filtering-solution/adblockpluscore/` instead of just
  `adblockpluscore`.
- For web bundle support in MV3, the static rulesets must be
  re-generated. In MV2, an unreleased (at the time of writing) version of
  Chrome is necessary. We're confident that this release will work once
  <https://chromium-review.googlesource.com/c/chromium/src/+/4199620> is
  merged.

# 0.9.0 - 2023/02/14

This release also includes fixes from 0.8.1

## General

- MV2 to MV3 migration is guaranteed to be done before `EWE.start()`
  is finished, so the migration errors are available as soon as EWE is
  started. (#385)
- A new approach has been taken to emitting the
  `EWE.reporting.onBlockableItem` events in MV3 extensions. This is
  now more responsive and continues working correctly when the service
  worker is suspended. (#389)

## Internal

- Small refactoring of the scripts: added function `isMain()` to check
  whether or not a script is run from the CLI. (#391)
- Supported logging events (no actual output added, only mechanism
  in-place) and documented existing events. (#389)
- adblockpluscore has been integrated into the
  webext-ad-filtering-solution repository. (#267)

## Fixes

- The deferred element collapsing listener could throw an error if
  called more than once. (#481)
- One click allowlisting: add a tolerance for clock drift in the
  signature checks. (#479)
- The following issues have also been solved by the changes to how
  `EWE.reporting.onBlockableItem` now gets emitted in #389. (#468,
  #482, #483)

## Tests

- Test reliability improvements:
  - Increased mocha global timeout from 2000ms to 4000ms.
  - Added an option to help testing test flakiness. (#463)
  - Automatically retries known flaky tests.
  - Fixed version flaky test by increasing timeouts. (#474)
  - Fixed flaky tests for: updates the subscription filter text when
    updating the extension. (#466)
  - Increased timeout for the test: blocks a request using
    subscriptions. (#501)
  - Verify that the synchronization happen for more reliable
    testing. (#450, #471)
  - Fixed flaky test: migrates user subscriptions. (#498)
- Pipeline runs tests now on specified versions of browsers.
- Added test to check that ignored notification categories are
  saved. (#456)

# 0.8.1 - 2023/02/01

## General

- Updated to adblockpluscore 0.11.1. This is necessary for some of the
  changes. (#456, #458, #462)

## Fixes

- Manifest V3:
  - DNR subscription will have the `homepage` properly set
    (adblockpluscore). (#458)
  - Ignored notifications are now saved (adblockpluscore). (#456)
- Documentations updates and clarifications. (#455, #459)
- Manifest V2:
  - `EWE.subscriptions.recommendations()` will return a
    `Recommendation` object with the `url` property set to the proper
    one, i.e. the one from `url_mv2`. (#437)

## Tests

- Fixed version flaky test by increasing timeouts. (#428, #446)
- Limit the Edge fuzz test to Edge 108.

# 0.8.0 - 2023/01/10

This release includes the changes in 0.7.1, 0.7.2 and 0.7.3. Please
see also the corresponding sections below.

## General

- Updated to adblockpluscore 0.11.0. This is necessary for some of the
  changes. (#438)
- Improved documentation of the generation of the subscription data
  (static rulesets) and split documentation to `docs`. The documentation
  generation out is now in `dist/docs`. (#265, #433)

- Manifest V3:
  - Rename `EWE.subscriptions.removeAll` to
    `EWE.subscriptions._removeAll` as the API is private. (#340)
  - Support sitekeys in Manifest V3. (#380)
  - No longer skip regular expression filter rules when generating the
    Manifest V3 static rulesets. (#404)
  - Documentation has been updated to mention that EWE.start must be
    called in the first turn of the event loop for MV3
    extensions. This has always been the case, but was not documented
    before now. (#439)
  - Subscriptions of type `circumvention` are downloaded and updated.
    They are also excluded from the DNR rules generated from the
    subscriptions. (#343)
- A new function, `EWE.debugging.clearDebugOptions` has been
  added. This resets the elemhide debug options to their default
  setting. (#420)
- Updated documentation on which storage keys we use in
  `browser.storage.local` and `browser.storage.session`. (#422)

## Bug fixes

- Manifest V3:
  - Make sure the rulesets are properly enabled. (#387)
  - Element hide debugging continues to work if the service worker is
    suspended. (#321)
  - Ensure subscription links works with service worker suspended. (#325)
  - Ensure notifications works with service worker suspended. (#320)
- Don't return download related properties for non-downloadable
  subscriptions when calling
  `EWE.subscriptions.getDownloadables()`. (#365)
- Keep migration errors after reload. (#443)
- Prefs no longer watches changes to local storage which was sometimes
  leading to it reverting to previous states if changed too
  rapidly. (#441)

## Build process

- `npm run build` will now generate the subscription data (static
  rulesets). (#386)
- Fix build on Windows.
- Removed `npm start`.
- New flags `--force-subscription-update` and `--use-external-server`
  have been added to the `npm run build` script.
- npm run subs-convert script now supports reporting mechanism with
  `--report` flag. See readme for more info (#407)

## Tests

- Test reliability improvements:
  - Improve testing of the migration scenario. (#383)
  - Increase network timeout.
  - Increase createKeypair script timeout. (#413)
  - Fix flaky Edge reload and allowlisting test. (#398)
  - Increase timeout & apply sleep on reload test to fix flakiness. (#313)
- Added unit tests. (#388)
- Various test updates and maintenance.
- Upgrade get-browser-binary for the test harness. (#403)
- Fix the update tests. (#396)
- CI pipeline optimization. (#372)
  - Reduce the tasks run on CI pipelines.
  - Reuse the test extension from the build test.
  - Remove unnecessary caching.
  - Split some of the pipeline to be run manually.
  - Edge CI jobs are run together.
  - Edge jobs timeout got extended. (#288)
  - Some jobs are to be run manually unless on `master`.
  - Integration build got fixed.
- Add the ability to see background and test logs in the CI log
  output. (#399)

## Updating your code

- `EWE.subscriptions.removeAll` has been removed and should no longer
  be used.
- `EWE.debugging.setElementHidingDebugMode` and
  `EWE.debugging.setElementHidingDebugStyle` methods are async now. (#321)
- Debug mode settings in `EWE.debugging` are now retained. They are
  also persisted when the browser restarts in MV3 mode. (#321)
- In `EWE.subscriptions.getDownloadables()` will filter out some
  properties for subscription whose `downloadable` property is false.
  Excluded properties are: `downloading`, `version`, `downloadStatus`,
  `lastSuccess`, `lastDownload`, `softExpiration`, `expires`, and
  `downloadCount`. (#365)
- These functions are now asynchronous.
- If you ever use `adblockpluscore` directly, make sure to update to
  match the version used by the Engine. (#438)
- In MV3, subscriptions needs to be regenerated when upgrading to this
  version of the Engine. A subscription of type `circumvention` will be
  downloaded by the WebExtension, and updated like MV2 filter lists.
  No DNR ruleset will be created by the subscription conversion
  process. (#343)

# 0.7.3 - 2022/12/22

## Bug fixes

- Keep migration errors after reload. (#423)

## Updating your code

- `EWE.subscriptions.getMigrationErrors()` now returns only migration errors
  that relate to subscriptions. Use `EWE.filters.getMigrationErrors()` for
  the filter equivalent. Both of these functions are now asynchronous.
- `getMigrationErrors` in the subscriptions and filters namespaces now
  contain the full `subscription` and `filter` objects respectively.

# 0.7.2 - 2022/11/24

## General

- Implement sitekey support for Manifest V3. (#380)

## Tests

- Fix test harness on Windows.

## Updating your code

- You only need to regenerate the DNR rulesets to add back the sitekey
  filters. If you used tooling that doesn't use the Engine code, then
  you might want to update it as well.

# 0.7.1 - 2022/11/03

## Bug fixes

- Update adblockpluscore to 0.10.1 to restore Easylist China in the
  default recommendations. (#394, #384)
- Use correct URL when calling `addDefault` in Manifest V2. (#382)
- Make sure the DNR rulesets are enabled when reloading the extension,
  including when changing permission like "incognito mode". (#387)

# 0.7.0 - 2022/10/17

Chrome 102 is now the minimum supported version for Manifest V3.

## General

- Updated adblockpluscore to 0.10.0 (#377)
- Added MV3 compatible popup blocker. (#323)
- Make one click allowlisting work on a cold service worker start. (#316)
- In MV3, the synchronizer perform HEAD request to the URL. (#368)
- Pass the manifest version to the susbcription requests. (#366)
- User subscriptions an custom filters migration. (#344, #345, #378)
- In MV3, bundled subscriptions are now reloaded on extension update (#337)

## Bug fixes

- `subscriptions.remove()` properly returns an error if the subscription
  doesn't exist, instead of a `TypeError`. (#354)
- Removed `subscriptions.validate()` from the API as it wasn't meant to
  be. (#357)
- Make sure the preferences are saved. This also increase the tests
  reliability. (#363, #362)
- Fix initialization order to improve reliability. (#319)
- In MV3, only one AA subscription is installed. (#352)
- `subscriptions.ACCEPTABLE_ADS_URL` and
  `subscriptions.ACCEPTABLE_ADS_PRIVACY_URL` now return the correct URLs,
  which differs depending on if the extension is MV2 or MV3 (#358)

## Tests

- Use new `get-browser-binary` module for the test harness to download
  browsers.
- Added testing of MV2 to MV3 migration. (#361)
- Large improvements to MV3 subscriptions testing. (#347)
- Added timer mocking to test synchronizer in the context of ServiceWorkers.
  (#336)
- Isolate the testing of scripts. (#333, #370)
- Events and notificatiosn work in fuzz tests. (#320, #338)
- Test server will log requestion options (#346)

## Updating your code

- Don't call `subscriptions.validate()` from the API anymore. (#357)

- `subscriptions.sync()` now returns a promise. Note that this promise
  resolves when syncing has been successfully triggered, not when it has
  completed. (#368)

- Subscription migration from MV2 to MV3 (#345):
  - The migration happens automatically. Nothing needs to be done
  - Once the migration happened, call `subscriptions.getMigrationErrors()`.
    It will return a list of (url, error) items a subscriptions url and
    an error message respectively.
  - Call `subscriptions.clearMigrationError()` to clear these errors.

- In MV3, `subscriptions.getRecommendations()` will return subscriptions with
  a MV3 appropriate URL, which is likely different from the one in MV2.
  (#377)

- MV3 popup blocking introduces the use of `browser.storage.session` for
  MV3 extensions. This means that in MV3, the minimum supported version
  of Chrome is 102 for MV3 extensions. (#323)

- One-click allowing list in Manifest V3:
  - `allowlisting.onUnauthorized`, `allowlisting.setAllowlistingCallback`,
    and `allowlisting.setAuthorizedKeys` should now all be called in the
    first turn of the event loop. This is to ensure that the authorized
    key is available if an allowlisting event activates the service worker.
  - `allowlisting.setAuthorizedKeys` still returns a promise, which resolves
    or rejects when all of the keys have been validated. It is also unchanged
    in that the keys are NOT updated if ANY of the keys passed in are invalid.
    However, a difference is that the new keys will take effect immediately.
    Internally, the signature verification will wait for the new keys to
    finish being verified before using them (if they're valid) or continuing
    with the previous set of authorized keys (if the new keys are not valid).

- `subscriptions.ACCEPTABLE_ADS_URL` and
  `subscriptions.ACCEPTABLE_ADS_PRIVACY_URL` are now property getters. This
  shouldn't have an impact on your code. Also
  `subscriptions.ACCEPTABLE_ADS_ID` and
  `subscriptions.ACCEPTABLE_ADS_PRIVACY_ID` have been added to return the ID
  of these subscriptions. (#358)

# 0.6.1 - 2022/10/11

## Bug fixes

- Fix duplicated preferences stored in local storage (#369)

# 0.6.0 - 2022/09/06

## General

- Minimum supported Chrome version for Manifest V3 is 102.
- Updated to adblockpluscore 0.9.1 (#341)
- Remove unused stop API (#315)
- Use the updated Chrome scripting API for snippets (#143)
- Properly inject the dependencies for the new snippet library (#335)

## Bug fixes

- Fix incorrect result from `filters.getAllowingFilter()`. (#297)
- Fix scripts not running properly. (#331)
- Allow scripts to run without runing npm install for
  adblockpluscore. (#333)
- Better resilience to out of order events.

## Manifest V3

- Improvement to scripts to generate DNR ruleset from subscription
  with proper ID. (#304)
- Ensure the allowing filter API still work with service worker
  shutdown. (#318)
- Subscriptions initialisation for the extension in Manifest V3,
  including setting up defaults. (#305)

## Tests

- Properly warn if the test server isn't running. (#327)
- CI: Upgrade NPM on Windows.
- CI: Use release tag to build the extension for integration.
- Fix some tests with async assertions that didn't await.
- Lots of testing enabled for Manifest V3
  - Testing with service worker termination. (#250, #322, #324, #328)

## Update your code

- Stop calling `EWE.stop()`. (#315)

- `EWE.start()` no longer set the default subscriptions, and
  `EWE.subscriptions.addDefaults()` needs to be called instead. (#305)

- The following API function are now `async` (#242, #305, #318)
  - `EWE.filters.getAllowingFilters()`
  - `EWE.filters.isResourceAllowlisted()`
  - `EWE.subscriptions.add()`
  - `EWE.subscriptions.getDownloadable()`
  - `EWE.subscriptions.getFilters()`
  - `EWE.subscriptions.getForFilter()`
  - `EWE.subscriptions.has()`
  - `EWE.subscriptions.enable()`
  - `EWE.subscriptions.disable()`
  - `EWE.subscriptions.remove()`

- Snippets library version 0.5.0 is the minimum required. (#143)

  - Parameters to `EWE.snippets.setLibrary()` changed and the object
    no longer take a `injectList` property. `isolatedCode` and
    `injectCode` are typed deferently and match snippet library
    version 0.5.x.

- Scripts names changed in `npm exec ...` to what is used in `npm run
  ...` (#304):

  - from `updateSubscriptions` to `subs-init`
  - from `mergeSubscriptions` to `subs-merge`
  - from `fetchSubscriptions` to `subs-fetch`
  - from `convertSubscriptions` to `subs-convert`
  - from `generateSubscriptionsFragment` to `subs-generate`

- Any change related to the update to adblockpluscore 0.9.1.

# 0.5.0 - 2022/07/29

## General

- Added Code of Conduct.
- Updated to adblockpluscore 0.8.0. (#309)
- Update to the API changes for core in 0.8.0. (#226)
- Improve frame-state API documentation. (#103)
- Fix filter storage in private/incognito mode. (#231)
- Fix an issue with `$document` option. (#230)
- Fix matching of popup filters. (#234)
- Allow defering filtering later to improve reliability on Chrome (#228)
- Fix blocking with empty tab URL like on Yandex. (#246)

## Manifest v3

- Use text2dnr code from adblockopluscore instead of abp2dnr module.
  (#205)
- Handle Regular Expression filter conversion.
- Add `declarative_net_request` to manifest. (#127)
- Handle limit in filter numbers. (#243)
- Fix the conversion scripts with adblockpluscore npm package (#270)
- Add ruleset conversion testing. (#277)

## Tests

- Fix tests for filters with metadata. (Follow-up on #213)
- Test pages test now run on beta browsers too.
- Make sure mv3 test on Edge are run on mv3 (#264)
- Some tests cleanup. (#249, #258)
- Tests in private/incognito mode for Firefox, Chromium, Edge. (#248,
  #285, #286)
- Run tests in CI in Docker. (#260, #281)
- Enable popup test in mv3. (#102)
- Added integration test in mv3. (#282)
- Service worker suspend test for mv3. (#217)
- Use get-browser-binary module for downloading browsers.
- Fix issues with tab focusing when running test. (#73)
- Fix install process for unit tests. (#299)
- Improve test reliability.
  - Better install process on CI for Edge (#261)
  - Fixed intermittent failures "configures default subscriptions". (#227)
  - Fix windows timeout (#240)
  - Fix webxtension-polyfill errors. (#247)
  - Reorder some tests. (#255, #256)
  - Fix flakey popup test. (#257)
  - Prevent resource event from leaking in other tests. (#271)
  - Increase tiemout on `onBlockableItem` and higlighting tests. (#273, #274)
  - Fix Chromium crash with subscribe link tests. (#279)
  - Fix one-click allowlisting test flakyness. (#263, #271)
  - Fix sitekey flakiness. (#255, #275)
  - Fix test when run around 0:00 UTC (#312)

## Update your code

- If you used adblockpluscore directly, some of the API changed in 0.8.0.
- A `too_many_filters` error can be returned by `addFilters` in Manifest V3
  if the dynamic filter limit is reached. (#243)

# 0.4.1 - 2022/05/19

## General

- Update adblockpluscore to 0.7.2 (also fixes #213)
- Fix the exports for the npm module (#211)
- Fix error management when sending messages from the background page
  following changes in Chromium (#216)
- Fix an issue with sitekey when reloading frames causing them to be ignored
  in some situations (#221)
- Use the synchronous sitekey verification from core 0.7.2 (#225)
- Anonymous frame `document.write()` blocking was not working (#229)

## Tests

- Use Adblock Plus 3.13 for the testpages tests on CI instead of
  an unreleased branch (#218)
- Also ensure the latest webext-ad-filtering-solution is used
  for testpages.

# 0.4.0 - 2022/04/21

## General

- Fix the context of content scripts on Firefox to only run the web
  content (#174)
- Add API to attach metadata to custom filters (#157)

## Tests

- Improve reliability of tests in manual testing.
- Add an `npm audit` pipeline on CI (#207)
- Use plain functions in mocha test (#159)

# 0.3.0 - 2022/04/12

## General

- Update to adblockpluscore 0.7.0 (#197)
  - addFilter() will ignore the newly returned error from core.
- One click allow listing (#171)
- Adds allowingDocumentFilter to frame (#149)
- Update legacy storage condition (#175)
- Allow customizing the default subscriptions by Engine
  users (#112)
- Faster matching with allowing filters (#206)

## Documentation

- Add shared resources information to README (#176)

## Tests

- Added testpages and custom extensions for the
  webext-ad-filtering-solution (#199)
- Dockerize MSEdge tests for more reliable CI (#195)

# 0.2.1 - 2022/03/30

This is a bugfix release.

## General

- Allow setting the `addonName` (#198)

## Updating your code

You can now optionally set the `addonName` to your own when building
an extension with the Engine.

Simply call `EWE.start()` this way:

```javascript
EWE.start({
  name: "adblockpluschrome",
  version: "3.12"
});
```

# 0.2.0 - 2022/03/14

## General

- Add url to snippet logging (#183)
- Update to adblockpluscore 0.6.0 (#142)
- Comment filters have property set to undefined (#169)
- Document domain on main_frame (#165)
- Return properly from listeners (#184)
- Check the presence of `type` before handling messages (#177)
- Fix an issue with allowlisting where frames weren't allowed despite
  the filtering rules (#189)

## Documentation

- Documentation doesn't generate multiline code snippets (#181)

## Tests

- Test: Attempt to download previous versions of msedgedriver (#182)
- Test: Increase timeout for test to pass in Edge (#192)
- Download the right Firefox beta version (!286)

# 0.1.1 - 2022/02/18

## Bug fixes

- Fix module dependency for abp2dnr (#178)
- Update repository URL in `package.json`

# 0.1.0 - 2022/02/09

Initial Release
