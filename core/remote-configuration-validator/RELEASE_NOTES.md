# Unreleased

# 0.12.0

- `validateRemoteConfig` now returns `{ errors, warnings }` instead of a flat array. Unknown facts and invalid operators are reported in `warnings`; all other validation failures remain in `errors`.

# 0.11.0

- Implement `reverseTrialStartDate` fact.
- Fix that `extVersion` fact should use semver operations instead of numeric operations.

# 0.10.0

- Added support for conditional experiments, allowing a `conditions` field on experiments similar to cohorts syntax [noissue]

# 0.9.0

- Implemented facts for freemium opd cohorts [EMP-40]

# 0.8.0

- Moved `button_label`, `lower_body`, `sub_title` and `upper_body` properties from `ipmCommands[i]` to new `content` property.

# 0.7.0

- Added optional `ipmCommands[i].cohort` property.
- Removed `ipmCommands[i].expiry` property.

# 0.6.0

- Added optional `ipmCommands` property.

# 0.1.0 - Initial Release
