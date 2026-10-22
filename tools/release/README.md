# @eyeo/release-utils

Tools for releasing AdBlock and Adblock Plus.

## How a release happens

Merging one merge request releases both extensions.

Every Monday a bot opens a merge request with the latest filter lists. It runs
the full pipeline. Merge it once it's green, like any other change.

Every Tuesday at 14:00 Berlin time a second bot opens the release merge
request on `main`. It only contains a new version number for each extension
and the release notes moved under that version. It opens every week, even when
nothing changed since the last release. It runs a reduced pipeline, so it
finishes in minutes.

In the release meeting, check that the latest push pipeline on `main` is green
and that Monday's filter list merge request is merged. Then merge the release
merge request. That merge is the release.

The merge creates the two release tags straight away. The tag pipeline builds
the extensions and publishes the GitLab releases. Upload the builds to the
stores and post in #releases. The `announce_release` job on `main` prints that
message for both extensions, with their release notes, ready to paste.

Versions: if any commit since the last release has a `feat` title, the minor
number goes up. Otherwise the patch number does. Both extensions get the same
kind of bump. Major bumps are never automatic. If the version or the notes in
the release merge request are wrong, edit its branch before merging.

If the release merge request conflicts because something landed on `main`
after it opened, run the "Create the weekly release MR" pipeline schedule by
hand. It closes the old merge request and opens a fresh one from the current
`main`. Do the same if a `feat` commit landed after it opened, so the version
bump is right. Re-running replaces the branch, so redo any edits you made on it.

Don't push code changes to the release merge request. Its pipeline skips the
compliance and browser tests, and merging it releases straight away. Merge the
fix into `main` through a normal merge request, then run the schedule again.

If no release merge request appears on Tuesday, the scheduled job failed and
its log says why. One cause is a manual release whose merge-back MR is still
open, or a merged release that was never tagged: the bot refuses to pick a
version until the release notes and the latest tag agree. Fix that, then run
the schedule again by hand.

To delay a release, don't merge. If the tag job fails, tag the merged commit
by hand with `git tag -a <host>-<version> <commit>` and push it. To release by
hand, or outside Tuesday, run `do-release` as before. A version that already
has a tag is never tagged again, so nothing is released twice.

The pieces, in the order they run:

| Piece                        | Where                              | Does                                                         |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------ |
| `update-rules-dependency.sh` | scheduled CI job, Monday           | bumps the filter lists, opens the filter list MR             |
| `prepare-release.sh`         | scheduled CI job, Tuesday 14:00    | runs do-release, opens the release MR                        |
| `do-release.js`              | inside that job, with `--skip-git` | picks versions, moves release notes, writes versions, no git |
| `tag_release` CI job         | `main`, right after the merge      | tags any host version that has no tag yet                    |
| `announce_release` CI job    | `main`, right after `tag_release`  | prints the #releases message for both extensions             |
| tag pipeline                 | on the new tags                    | builds and publishes, unchanged                              |

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
minor if a `feat` commit landed since, otherwise patch. The Tuesday job runs it
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
