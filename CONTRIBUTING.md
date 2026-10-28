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

## Release notes

We want to simplify the process of submitting changes to the various web stores. Therefore, any commit that has any impact on the user facing deployable things (found in `host/`) should have release notes. This means adding items to the `Unreleased` section in relevant `host/*/RELEASE_NOTES.md` files.

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

## Supported browser versions

We support browser versions according to the manifest.json file of the respective host extension. Based on those, these are the minimum supported version of the browser extension (or engine) will work on:

| Manifest | Browser             | AdBlock       | Adblock Plus  | webext SDK |
| -------- | ------------------- | ------------- | ------------- | ---------- |
| MV2      | Chrome              | not supported | not supported | 127.0      |
| MV2      | Firefox             | 128.0         | 128.0         | 128.0      |
| MV2      | Firefox for Android | not supported | 128.0         | 128.0      |
| MV2      | Microsoft Edge      | 127.0         | 127.0         | 127.0      |
| MV3      | Chrome              | 127.0         | 127.0         | 127.0      |
| MV3      | Microsoft Edge      | 127.0         | 127.0         | 127.0      |
| MV3      | Opera               | not supported | 113.0         | 113.0      |
| MV3      | Yandex Browser      | 127.0         | 127.0         | 127.0      |

More generally, we want to support:

- Browser versions that were released in the last 12 months
- Active long-term support browser versions\
  _e.g. Firefox ESR, Chrome OS LTS_

Support for a browser version should be dropped as soon as it no longer matches the above criteria. Beyond that, support for newer browser versions may be dropped in case of breakage (in existing or upcoming features) that cannot be fixed, or for which a fix is considered unreasonable.

Dropping support for a browser version for a given host extension means:

- Updating the minimum supported browser version in the manifest.json file.
  - Chrome / Microsoft Edge / Yandex Browser: "minimum_chrome_version"
  - Firefox / Firefox for Android: "applications" > "gecko" > "strict_min_version"
  - Opera: "minimum_opera_version"
- Updating the .browserslistrc file.
- Updating versions in CI configuration.
- Mentioning the change in the RELEASE_NOTES.md file.
- Updating the above table.
- Updating the "Unsupported browser version" experiment in the [remote configuration][repo-ab-testing-config], so that users on the dropped browser versions are notified.

## Supported Node.js version

We support the Node.js and npm version according to the package.json file. More generally, we want to support the latest actively supported long-term support Node.js version and the corresponding version of npm.

Support for an older Node.js version should be dropped as soon as it is no longer actively maintained.

Dropping support for a Node.js version means:

- Adding get-browser-binary [docker image][repo-docker] (see [example][node-upgrade-docker-example]).
- Adding support to [abp2dnr][repo-abp2dnr] (see [example][node-upgrade-abp2dnr-example]).
- Upgrading [filterlists-delivery repository][repo-filterlists-delivery] (see [example][node-upgrade-filterlists-delivery-example]).
- Upgrading extensions repository (see [example][node-upgrade-extensions-example]).
  - Updating the Node.js version in the mise.toml file, and [updating the mise.lock file](#updating-the-miselock-file).
  - Updating the Node.js and npm versions in the package.json, README.md and host/\*/STORE_LISTING.md files.
  - Running `npm install` to update the package-lock.json file.
  - Updating GitLab CI jobs:
    - Updating references to "node" docker images.
    - Updating docker files to use new get-browser-binary docker image.
    - Windows CI jobs: Overwriting the Node.js version.
    - Safari CI jobs:
      - Using a [new macOS image][gitlab-images-macos].
      - Updating the iOS device name and platform version.
- After all repositories that depend on "eyeo-windows" GitLab runner support new Node.js version:
  - Upgrading [default "eyeo-windows" GitLab runner][repo-terraform-windows-runner] (see [example][node-upgrade-windows-example]).
  - Removing Node.js version overwrite in repositories that depend on "eyeo-windows" GitLab runner.

### Updating the mise.lock file

The mise.lock file pins the checksums of the tools in mise.toml. Since `locked = true` is set in mise.toml, `mise install` never updates it, so it needs to be updated whenever a tool version in mise.toml changes:

```sh
# Platforms used by developers
mise lock --platform linux-x64,linux-arm64,macos-x64,macos-arm64
# Alpine (musl) platform used by the "update_rules" CI job, which needs its own node entry
MISE_NODE_COMPILE=false MISE_NODE_FLAVOR=musl MISE_NODE_MIRROR_URL=https://unofficial-builds.nodejs.org/download/release/ mise lock --platform linux-x64-musl
```

`mise lock` doesn't add checksums for npm, so add a `checksum = "sha256:..."` line to each `[tools.npm."platforms.*"]` entry. The checksum can be calculated with `curl -fsSL <url> | sha256sum`, after verifying the downloaded file against the `dist.integrity` value from `https://registry.npmjs.org/npm/<version>`. Existing npm checksums are preserved when running `mise lock` again.

[convcomms]: https://www.conventionalcommits.org/en/v1.0.0/
[convcomms-angular]: https://github.com/angular/angular/blob/22b96b9/CONTRIBUTING.md#type
[gitlab-images-macos]: https://docs.gitlab.com/ci/runners/hosted_runners/macos/#supported-macos-images
[node-upgrade-abp2dnr-example]: https://gitlab.com/eyeo/adblockplus/abc/abp2dnr/-/commit/d0822bbdbe50edf999d759e0986c9d3a5e80b3f1
[node-upgrade-docker-example]: https://gitlab.com/eyeo/docker/-/commit/83eb656657b6a61a41c6fb1b8c1780a22e2df7cd
[node-upgrade-extensions-example]: https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/commit/487ba9cc65682a3a47b3aeef25e0008f63bab6a1
[node-upgrade-filterlists-delivery-example]: https://gitlab.com/eyeo/filters/filterlists-delivery/-/commit/94fcbc4825b77850bcec5ccbcb96cd58cc1704a8
[node-upgrade-windows-example]: https://gitlab.com/eyeo/devops/terraform/projects/gitlab-runners/terraform-eyeo-windows-runner/-/merge_requests/21
[repo-ab-testing-config]: https://gitlab.com/eyeo/filters/ab-testing-config
[repo-abp2dnr]: https://gitlab.com/eyeo/adblockplus/abc/abp2dnr
[repo-docker]: https://gitlab.com/eyeo/docker
[repo-filterlists-delivery]: https://gitlab.com/eyeo/filters/filterlists-delivery
[repo-terraform-windows-runner]: https://gitlab.com/eyeo/devops/terraform/projects/gitlab-runners/terraform-eyeo-windows-runner
