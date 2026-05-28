# eyeo's Remote Configuration Validator

"@eyeo/remote-configuration-validator"

This is a library that validates the remote configuration file using JSON schema validation and additional, more field-specific edits.

## Overview

The remote configuration file is utilized in AdBlock and Adblock Plus.

The contents of the `src/` folder are:

- imported directly by the WebEXT SDK.
- imported into the `ab-testing-config` project via a GitLab project dependency.

The source code should not depend on any browser-specific APIs.

## Version changes

When making changes to this code, consider adjusting the version numbers accordingly:

- Update the `schemaId` property in schema/remoteConfigSchema.js whenever the JSON schema requires a breaking change.\
  _Warning: Changing the schema ID means that older extension versions will no longer be able to use the remote configuration anymore._
- Update the `version` property in the package.json file whenever a change requires a new version to be published.
  - Breaking changes require a major version bump. These can either be breaking changes in the JSON schema or in the API of the package itself.

## Releases

Whenever a change to the package.json file lands in the main branch, a CI job will automatically attempt to publish a new package version to the [GitLab package registry](https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/packages).

In order for schema changes to take effect, this package needs to be updated accordingly in other projects, which then need to be published separately, such as:

- For validation on the server: Deploy a new version of the [remote configuration](https://gitlab.com/eyeo/filters/ab-testing-config)
- For validation in the extensions: Release a new version of the [extensions](https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/wikis/Host-release-process)
- For validation in projects that integrate @eyeo/webext-ad-filtering-solution: Release a new version of the [@eyeo/webext-ad-filtering-solution package](https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/wikis/SDK-release-process) and publish the project that depends on it.
- For use in the IPM campaign manager: Deploy a new version of the [IPM campaign manager](https://gitlab.com/eyeo/filters/ipm-campaign-manager)

## Testing

The unit tests go in the `test/` folder and can be run with the
`npm run -w @eyeo/remote-configuration-validator test`
command.
