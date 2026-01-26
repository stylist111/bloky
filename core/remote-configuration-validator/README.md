# eyeo's Remote Configuration Validator

"@eyeo/remote-configuration-validator"

This is a library that validates the remote configuration file using JSON schema validation and additional, more field-specific edits.

## Overview

The remote configuration file is utilized in AdBlock and Adblock Plus.

The contents of the `src/` folder are:

- imported directly by the WebEXT SDK.
- imported into the `ab-testing-config` project via a GitLab project dependency.

The source code should not depend on any browser-specific APIs.

## Releases

Notes:

- The remote configuration file's `schemaID` should only be updated when the JSON schema requires a breaking change.
- The `version` property in this project's `package.json` file should be updated in the same MR as any changes to this respository that require a new version to be published.
- When the MR for the changes in this project are merged into the main branch of the mono-repo, a CI/CD script will publish
  a new version of this project to this project package registry (https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/packages).
- The version also needs to be published to npm's package registry by running `npm publish -w @eyeo/remote-configuration-validator`, as some projects depend on it being available there.
- A related MR for the [`ab-testing-config`](https://gitlab.com/eyeo/filters/ab-testing-config) project will be required, including an update to the `version` property.  The new version of this
  project should be published before the `ab-testing-config` MR is merged to avoid conflicts.
- Both MRs should reference each other.

## Testing

The unit tests go in the `test/` folder and can be run with the
`npm run -w @eyeo/remote-configuration-validator test`
command.
