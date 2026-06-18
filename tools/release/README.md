# @eyeo/release-utils

Tools for facilitating the release of new versions of packages and hosts.

## Usage

### check-package-lock

Checks the contents of a given package-lock.json file for known problems. The
script performs three categories of check:

1. The platform-specific optional dependency entries (esbuild, rollup, sentry
   CLI, nx, sharp) are present, guarding against [npm/cli#4828][npm-cli-4828].
2. Pinned packages (currently `typescript`) only resolve to a single version.
3. The lockfile is in sync with the project's `package.json` files. The script
   runs `npm install --package-lock-only` and fails if the resolution
   rewrites `package-lock.json`. On failure it prints a unified diff of the
   lockfile before vs. after, so reviewers can see what was missing. The
   original `package-lock.json` is restored after the check whether it passed
   or failed — running the script locally never mutates the working tree.

To fix a drift failure, run `npm install` locally, commit the regenerated
`package-lock.json`, and push.

```bash
npm run -w @eyeo/release-utils check-package-lock <package-lock.json>
```

[npm-cli-4828]: https://github.com/npm/cli/issues/4828

### do-release

Applies all necessary changes to the repository for the release.

```bash
npm run -w @eyeo/release-utils do-release
```

### get-release-notes

Returns the release notes for a given host version.

```bash
npm run -w @eyeo/release-utils get-release-notes <host> <version>
```

## Testing

### Unit tests

Unit tests are contained in `.spec.js` files in the fragment root.

```bash
npm test -- --scope @eyeo/release-utils
```

### End-to-end tests

End-to-end tests are contained in `test/end-to-end/`.

```bash
npm test:end-to-end -- --scope @eyeo/release-utils
```
