0.6.0 - 2022/09/06
==================

# General

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
  `EWE.subscriptions.addDefaults()` need to be called instead. (#305)

- The following API function are now `async` (#242, #318)
  * `EWE.filters.getAllowingFilters()`
  * `EWE.filters.isResourceAllowlisted()`
  * `EWE.subscriptions.getDownloadable()`
  * `EWE.subscriptions.getFilters()`
  * `EWE.subscriptions.getForFilter()`
  * `EWE.subscriptions.has()`
  * `EWE.subscriptions.enable()`
  * `EWE.subscriptions.disable()`
  * `EWE.subscriptions.remove()`

- Snippets library version 0.5.0 is the minimum required. (#143)

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