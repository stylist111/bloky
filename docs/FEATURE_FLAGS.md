# Feature Flags

Feature flags allow pushing code to the main branch that is
switched off for production use. This allows incomplete features to be pushed to
the main branch, while still keeping the main branch releasable at all
times. This makes it a great alternative to long running feature branches.

Since the feature can be toggled by extensions, this also gives a mechanism for
trying those features in the extensions to collect early feedback on the
features.

## The general lifecycle of a feature flag

- A feature flag is added to the codebase when it is required. This would
  probably be at the beginning of work on a long running feature, or when we
  discover that the feature has become large and we would like to merge a
  portion of it that should not be enabled in production yet.
- The initial default value for the flag will generally be `false` (disabled by
  default, but extensions and tests can opt in).
- Once the feature is complete, the default value of the flag can be toggled to
  `true` (enabled by default, but extensions and tests can opt out). If we have
  high confidence in the new feature, we can even skip this step and go straight
  to removing the feature flag.
- When we're confident that there is no reason for extensions to disable the
  feature, we remove the flag from the codebase, and delete the relevant
  codepaths.
- At any time if we decide to never complete a feature, we can also delete the
  feature flag from the codebase, and delete the relevant codepaths.

## How to add a feature flag

- Find the `resetFeatureFlags` function in `core/lib/features.js`. Add your new
  feature flag by setting a new value on `featureFlags` in the function, with a
  value of `false` for the feature being disabled by default.
- Wherever braches are needed in the production code for different features, use
  `isFeatureEnabled("myFeature")` (defined in `core/lib/features.js`).
- For tests which need a feature in a specific state, call `await
  setFeatureFlags({myFeature: true});` (defined in `test/messaging.js`) at the
  start of the test. There should be tests for both the enabled and disabled
  state of a feature.
- Document the new feature in the JSDocs for `EWE.start()`, and mention it in
  the release notes.

## How to change the default value of a feature flag

- Find the `defaultFeatureFlags` object in `core/lib/features.js`, and update
  its default value.
- Update the release notes to indicate the change in default functionality.

## How to remove a feature flag

- Find the `defaultFeatureFlags` object in `core/lib/features.js`. Remove the
  feature from the object.
- Replace any calls to `isFeatureEnabled()` with the appropriate static `false`
  (disabled) or `true` (enabled) value for the feature being removed. Then
  refactor the code to delete the unreachable codepaths.
- Remove any calls to `setFeatureFlags()` in tests for the feature. If the test
  is for the code being eliminated, delete the whole test.
- Update the JSDocs for `EWE.start()` to remove the feature flag (this is not
  considered a breaking change), and mention it in the release notes.

### Troubleshooting removing a feature flag

- Check the test results for any "Unknown feature flag" exceptions being
  thrown. Thses indicate that the feature is still being used in an
  `isFeatureEnabled()` call, or that the feature is still being used in a
  `setFeatureFlags()` call.
- Check the test logs for any startup warnings that mention "unknown
  feature flag". This indicates that the feature still needs to be removed from
  `test/background.js`.

## General considerations, best practices, and limitations

- Be careful when working with data. The nature of feature flags is that they
  may be toggled on and off by extensions, and so it's best to avoid them when
  it could lead to data being in an inconsistent state.
- The current implementation assumes that features are all independently
  togglable. If there is a need in the future for features which depend on each
  other, then this should be revisited.
