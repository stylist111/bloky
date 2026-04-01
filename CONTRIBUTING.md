# Contributing

## Merge request title

For merge requests (and the resulting commits) we are following the
[Conventional Commits][convcomms] specification with the format
`type: Message`:

- `type`: Any of the predefined types from [Angular convention][convcomms-angular]
- `Message`: Commit message

Examples:

- `build: Standardized npm scripts for building, linting and unit testing`
- `ci: use a compliance script to run testpages tests`
- `test: Add extension tests`

## Testing

Almost all code contributions should contain appropriate automated tests to ensure the reliability and maintainability of our codebase. Whether you're fixing a bug, adding a new feature, or refactoring existing code, appropriate unit and/or integration tests are expected to be added or updated. This practice helps catch potential issues early and ensures that changes do not inadvertently break existing functionality.
If creating tests is not easy or you encounter any problems doing it, please create a Jira ticket describing the issue in the EXT project or reach out to the Extensions Host team on Slack.

## Release notes

We want to simplify the process of submitting changes to the various web stores. Therefore, any commit that has any impact on the user facing deployable things (found in `hosts/`) should have release notes. This means adding items to the `Unreleased` section in relevant `hosts/*/RELEASE_NOTES.md` files.

### What does this mean for me as a person creating a merge request?

Assuming your changes have an impact on the extensions in a visible/feature way, please summarize those changes to relevant `RELEASE_NOTES.md` files. For example:

```
# Unreleased

- Updated the thing to be different.
- Fixed the way we do that other thing to be much faster.
- Changes tracked on a non-EXT board.
```

### What does this mean for me as a reviewer of a merge request?

If you see a change that should probably have release notes, shout!

### What does this mean for me as a person doing the release?

The specifics will be defined in the release process, but on a high level the release manager is reviewing existing release notes and giving them a version number, not writing them from scratch.

## Environment Variables

Generally, environment variables are host specific. Each host (ADBLOCK and ADBLOCKPLUS) has its own set of required environment variables in GitLab CI. These variables must have the correct prefix matching their host ("ADBLOCK*" or "ADBLOCKPLUS*").

Each host maintains its own list of required variables in a file located in their directory (e.g., host/adblock/variables or host/adblockplus/variables). These files contain the complete CI variable names including prefixes, matching exactly what's configured in GitLab.

When using these variables in the actual code, the host part should be omitted. For example, use `SOME_VARIABLE` instead of `ADBLOCK_SOME_VARIABLE`. To see how this works, refer to the `/tools/release/create-environment-variables.sh` file.

## Contribution License

When submitting a merge request to this repository as an external contributor, you need to confirm that you read and accept our [contributor license](CONTRIBUTOR_LICENSE.md) by adding the following to the merge request's description:

```
 I confirm that I have read and accept [contributor license](CONTRIBUTOR_LICENSE.md) of this repository.
```

[convcomms]: https://www.conventionalcommits.org/en/v1.0.0/
[convcomms-angular]: https://github.com/angular/angular/blob/22b96b9/CONTRIBUTING.md#type
