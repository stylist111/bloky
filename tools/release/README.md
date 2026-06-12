# @eyeo/release-utils

Tools for facilitating the release of new versions of packages and hosts.

## Usage

### check-package-lock

Checks the contents of a given package-lock.json file for known problems.

```bash
npm run -w @eyeo/release-utils check-package-lock <package-lock.json>
```

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
