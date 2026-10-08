# @eyeo/release-utils

Tools for releasing AdBlock and Adblock Plus.

## How a release happens

Merging one merge request releases both extensions.

Every Monday a bot opens a merge request on `main`. It contains the latest
filter lists, a new version number for each extension, and the release notes
moved under that version. A human reads it and merges it. That merge is the
release.

After the merge, CI waits for the tests on `main` to pass, then creates the two
release tags. The tag pipeline builds the extensions and publishes the GitLab
releases. A human downloads the builds, uploads them to the stores, and posts
in #releases.

Versions: if any commit since the last release has a `feat` title, the minor
number goes up. Otherwise the patch number does. Both extensions get the same
kind of bump. Major bumps are never automatic. If the version or the notes in
the bot's merge request are wrong, edit its branch before merging.

If no merge request appears on Monday, the scheduled job failed and its log
says why. One cause is a manual release whose merge-back MR is still open, or
a merged release that was never tagged: the bot refuses to pick a version until
the release notes and the latest tag agree. Fix that, then run the scheduled
pipeline again by hand. It opens the merge request from the current `main`.

Merge the bot's merge request soon after it opens. If other changes land on
`main` first, the notes file can conflict. Re-run the scheduled pipeline and it
opens a fresh merge request from the current `main`.

To delay a release, do not merge. The tags are only created once the whole
`main` pipeline is green. If it is red, retry the failed job, or tag the merged
commit by hand with `git tag -a <host>-<version> <commit>` and push it. To
release by hand, or outside Monday, run `do-release` as before. A version that
already has a tag is never tagged again, so nothing is released twice.

The pieces, in the order they run:

| Piece                        | Where                                | Does                                                         |
| ---------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| `update-rules-dependency.sh` | scheduled CI job, Monday             | bumps filter lists, runs do-release, opens the MR            |
| `do-release.js`              | inside that job, with `--skip-git`   | picks versions, moves release notes, writes versions, no git |
| `tag_release` CI job         | `main`, after merge, when tests pass | tags any host version that has no tag yet                    |
| tag pipeline                 | on the new tags                      | builds and publishes, unchanged                              |

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

Bumps the version, moves the release notes, pushes the release branch and the
tag. Run it by hand for hotfixes or when the weekly merge request cannot be
used. A version of `auto` picks the next version from the latest tag on origin:
minor if a `feat` commit landed since, otherwise patch. The Monday job runs it
with `--yes --skip-git --summary-if-empty HEAD adblock@auto adblockplus@auto`,
which only edits the files.

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
