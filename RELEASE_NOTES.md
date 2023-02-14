0.9.0 - 2023/02/14
==================

This release also includes fixes from 0.8.1

# General

- MV2 to MV3 migration is guaranteed to be done before `EWE.start()`
  is finished, so the migration errors are available as soon as EWE is
  started. (#385)
- A new approach has been taken to emitting the
  `EWE.reporting.onBlockableItem` events in MV3 extensions. This is
  now more responsive and continues working correctly when the service
  worker is suspended. (#389)

# Internal

- Small refactoring of the scripts: added function `isMain()` to check
  whether or not a script is run from the CLI. (#391)
- Supported logging events (no actual output added, only mechanism
  in-place) and documented existing events. (#389)
- adblockpluscore has been integrated into the webext-sdk repository.
  (#267)

# Fixes

- The deferred element collapsing listener could throw an error if
  called more than once. (#481)
- One click allowlisting: add a tolerance for clock drift in the
  signature checks. (#479)
- The following issues have also been solved by the changes to how
  `EWE.reporting.onBlockableItem` now gets emitted in #389. (#468,
  #482, #483)

# Tests

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
- Pipeline runs tests now on specified versions of browsers.
- Added test to check that ignored notification categories are
  saved. (#456)

0.8.1 - 2023/02/01
==================

# General

- Updated to adblockpluscore 0.11.1. This is necessary for some of the
  changes. (#456, #458, #462)

# Fixes

- Manifest V3:
  - DNR subscription will have the `homepage` properly set
    (adblockpluscore). (#458)
  - Ignored notifications are now saved (adblockpluscore). (#456)
- Documentations updates and clarifications. (#455, #459)
- Manifest V2:
  - `EWE.subscriptions.recommendations()` will return a
    `Recommendation` object with the `url` property set to the proper
    one, i.e. the one from `url_mv2`. (#437)

# Tests

- Fixed version flaky test by increasing timeouts. (#428, #446)
- Limit the Edge fuzz test to Edge 108.

0.8.0 - 2023/01/10
==================

This release includes the changes in 0.7.1, 0.7.2 and 0.7.3. Please
see also the corresponding sections below.

# General

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

# Bug fixes

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

# Build process

- `npm run build` will now generate the subscription data (static
  rulesets). (#386)
- Fix build on Windows.
- Removed `npm start`.
- New flags `--force-subscription-update` and `--use-external-server`
  have been added to the `npm run build` script.
- npm run subs-convert script now supports reporting mechanism with
  `--report` flag. See readme for more info (#407)

# Tests

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

# Updating your code

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
  match the version used by the SDK. (#438)
- In MV3, subscriptions needs to be regenerated when upgrading to this
  version of the SDK. A subscription of type `circumvention` will be
  downloaded by the WebExtension, and updated like MV2 filter lists.
  No DNR ruleset will be created by the subscription conversion
  process. (#343)

0.7.3 - 2022/12/22
==================

# Bug fixes

- Keep migration errors after reload. (#423)

# Updating your code

- `EWE.subscriptions.getMigrationErrors()` now returns only migration errors
  that relate to subscriptions. Use `EWE.filters.getMigrationErrors()` for
  the filter equivalent. Both of these functions are now asynchronous.
- `getMigrationErrors` in the subscriptions and filters namespaces now
  contain the full `subscription` and `filter` objects respectively.

0.7.2 - 2022/11/24
==================

# General

- Implement sitekey support for Manifest V3. (#380)

# Tests

- Fix test harness on Windows.

# Updating your code

- You only need to regenerate the DNR rulesets to add back the sitekey
  filters. If you used tooling that doesn't use the SDK code, then you
  might want to update it as well.

0.7.1 - 2022/11/03
==================

# Bug fixes

- Update adblockpluscore to 0.10.1 to restore Easylist China in the
  default recommendations. (#394, #384)
- Use correct URL when calling `addDefault` in Manifest V2. (#382)
- Make sure the DNR rulesets are enabled when reloading the extension,
  including when changing permission like "incognito mode". (#387)

0.7.0 - 2022/10/17
==================

Chrome 102 is now the minimum supported version for Manifest V3.

# General

- Updated adblockpluscore to 0.10.0 (#377)
- Added MV3 compatible popup blocker. (#323)
- Make one click allowlisting work on a cold service worker start. (#316)
- In MV3, the synchronizer perform HEAD request to the URL. (#368)
- Pass the manifest version to the susbcription requests. (#366)
- User subscriptions an custom filters migration. (#344, #345, #378)
- In MV3, bundled subscriptions are now reloaded on extension update (#337)

# Bug fixes

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

# Tests

- Use new `get-browser-binary` module for the test harness to download
  browsers.
- Added testing of MV2 to MV3 migration. (#361)
- Large improvements to MV3 subscriptions testing. (#347)
- Added timer mocking to test synchronizer in the context of ServiceWorkers.
  (#336)
- Isolate the testing of scripts. (#333, #370)
- Events and notificatiosn work in fuzz tests. (#320, #338)
- Test server will log requestion options (#346)

# Updating your code

- Don't call `subscriptions.validate()` from the API anymore. (#357)

- `subscriptions.sync()` now returns a promise. Note that this promise
  resolves when syncing has been successfully triggered, not when it has
  completed. (#368)

- Subscription migration from MV2 to MV3 (#345):
  * The migration happens automatically. Nothing needs to be done
  * Once the migration happened, call subscriptions.getMigrationErrors()`.
    It will return a list of (url, error) items a subscriptions url and
    an error message respectively.
  * Call `subscriptions.clearMigrationError()` to clear these errors.

- In MV3, `subscriptions.getRecommendations()` will return subscriptions with
  a MV3 appropriate URL, which is likely different from the one in MV2.
  (#377)

- MV3 popup blocking introduces the use of `browser.storage.session` for
  MV3 extensions. This means that in MV3, the minimum supported version
  of Chrome is 102 for MV3 extensions. (#323)

- One-click allowing list in Manifest V3:
  * `allowlisting.onUnauthorized`, `allowlisting.setAllowlistingCallback`,
    and `allowlisting.setAuthorizedKeys` should now all be called in the
    first turn of the event loop. This is to ensure that the authorized
    key is available if an allowlisting event activates the service worker.
  * `allowlisting.setAuthorizedKeys` still returns a promise, which resolves
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

0.6.1 - 2022/10/11
==================

# Bug fixes

- Fix duplicated preferences stored in local storage (#369)

0.6.0 - 2022/09/06
==================

# General

- Minimum supported Chrome version for Manifest V3 is 102.
- Updated to adblockpluscore 0.9.1 (#341)
- Remove unused stop API (#315)
- Use the updated Chrome scripting API for snippets (#143)
- Properly inject the dependencies for the new snippet library (#335)

# Bug fixes

- Fix incorrect result from `filters.getAllowingFilter()`. (#297)
- Fix scripts not running properly. (#331)
- Allow scripts to run without runing npm install for
  adblockpluscore. (#333)
- Better resilience to out of order events.

# Manifest V3

- Improvement to scripts to generate DNR ruleset from subscription
  with proper ID. (#304)
- Ensure the allowing filter API still work with service worker
  shutdown. (#318)
- Subscriptions initialisation for the extension in Manifest V3,
  including setting up defaults. (#305)


# Tests

- Properly warn if the test server isn't running. (#327)
- CI: Upgrade NPM on Windows.
- CI: Use release tag to build the extension for integration.
- Fix some tests with async assertions that didn't await.
- Lots of testing enabled for Manifest V3
  - Testing with service worker termination. (#250, #322, #324, #328)

# Update your code

- Stop calling `EWE.stop()`. (#315)

- `EWE.start()` no longer set the default subscriptions, and
  `EWE.subscriptions.addDefaults()` needs to be called instead. (#305)

- The following API function are now `async` (#242, #305, #318)
  * `EWE.filters.getAllowingFilters()`
  * `EWE.filters.isResourceAllowlisted()`
  * `EWE.subscriptions.add()`
  * `EWE.subscriptions.getDownloadable()`
  * `EWE.subscriptions.getFilters()`
  * `EWE.subscriptions.getForFilter()`
  * `EWE.subscriptions.has()`
  * `EWE.subscriptions.enable()`
  * `EWE.subscriptions.disable()`
  * `EWE.subscriptions.remove()`

- Snippets library version 0.5.0 is the minimum required. (#143)

  - Parameters to `EWE.snippets.setLibrary()` changed and the object
    no longer take a `injectList` property. `isolatedCode` and
    `injectCode` are typed deferently and match snippet library
    version 0.5.x.

- Scripts names changed in `npm exec ...` to what is used in `npm run
  ...` (#304):

  * from `updateSubscriptions` to `subs-init`
  * from `mergeSubscriptions` to `subs-merge`
  * from `fetchSubscriptions` to `subs-fetch`
  * from `convertSubscriptions` to `subs-convert`
  * from `generateSubscriptionsFragment` to `subs-generate`

- Any change related to the update to adblockpluscore 0.9.1.

0.5.0 - 2022/07/29
==================

# General

- Added Code of Conduct.
- Updated to adblockpluscore 0.8.0. (#309)
- Update to the API changes for core in 0.8.0. (#226)
- Improve frame-state API documentation. (#103)
- Fix filter storage in private/incognito mode. (#231)
- Fix an issue with `$document` option. (#230)
- Fix matching of popup filters. (#234)
- Allow defering filtering later to improve reliability on Chrome (#228)
- Fix blocking with empty tab URL like on Yandex. (#246)

# Manifest v3

- Use text2dnr code from adblockopluscore instead of abp2dnr module.
  (#205)
- Handle Regular Expression filter conversion.
- Add `declarative_net_request` to manifest. (#127)
- Handle limit in filter numbers. (#243)
- Fix the conversion scripts with adblockpluscore npm package (#270)
- Add ruleset conversion testing. (#277)

# Tests

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
  - Fix sitekey flakyness. (#255, #275)
  - Fix test when run around 0:00 UTC (#312)

# Update your code

- If you used adblockpluscore directly, some of the API changed in 0.8.0.
- A `too_many_filters` error can be returned by `addFilters` in Manifest V3
  if the dynamic filter limit is reached. (#243)

0.4.1 - 2022/05/19
==================

# General

- Update adblockpluscore to 0.7.2 (also fixes #213)
- Fix the exports for the npm module (#211)
- Fix error management when sending messages from the background page
  following changes in Chromium (#216)
- Fix an issue with sitekey when reloading frames causing them to be ignored
  in some situations (#221)
- Use the synchronous sitekey verification from core 0.7.2 (#225)
- Anonymous frame `document.write()` blocking was not working (#229)

# Tests

- Use Adblock Plus 3.13 for the testpages tests on CI instead of
  an unreleased branch (#218)
- Also ensure the latest webext-sdk is used for testpages.

0.4.0 - 2022/04/21
==================

# General

- Fix the context of content scripts on Firefox to only run the web
  content (#174)
- Add API to attach metadata to custom filters (#157)

# Tests

- Improve reliability of tests in manual testing.
- Add an `npm audit` pipeline on CI (#207)
- Use plain functions in mocha test (#159)

0.3.0 - 2022/04/12
==================

# General

- Update to adblockpluscore 0.7.0 (#197)
  - addFilter() will ignore the newly returned error from core.
- One click allow listing (#171)
- Adds allowingDocumentFilter to frame (#149)
- Update legacy storage condition (#175)
- Allow customizing the default subscriptions by SDK users (#112)
- Faster matching with allowing filters (#206)

# Documentation

- Add shared resources information to README (#176)

# Tests

- Added testpages and custom extensions for the webext-sdk (#199)
- Dockerize MSEdge tests for more reliable CI (#195)

0.2.1 - 2022/03/30
==================

This is a bugfix release.

# General

- Allow setting the `addonName` (#198)

# Updating your code

You can now optionally set the `addonName` to your own when building
an extension with the SDK.

Simply call `EWE.start()` this way:
```javascript
EWE.start({
  name: "adblockpluschrome",
  version: "3.12"
});
```

0.2.0 - 2022/03/14
==================

# General

- Add url to snippet logging (#183)
- Update to adblockpluscore 0.6.0 (#142)
- Comment filters have property set to undefined (#169)
- Document domain on main_frame (#165)
- Return properly from listeners (#184)
- Check the presence of `type` before handling messages (#177)
- Fix an issue with allowlisting where frames weren't allowed despite
  the filtering rules (#189)

# Documentation

- Documentation doesn't generate multiline code snippets (#181)

# Tests

- Test: Attempt to download previous versions of msedgedriver (#182)
- Test: Increase timeout for test to pass in Edge (#192)
- Download the right Firefox beta version (!286)

0.1.1 - 2022/02/18
==================

# Bug fixes

- Fix module dependency for abp2dnr (#178)
- Update repository URL in `package.json`

0.1.0 - 2022/02/09
==================

Initial Release
