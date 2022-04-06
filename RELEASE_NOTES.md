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