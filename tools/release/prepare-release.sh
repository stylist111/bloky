#!/bin/bash

set -eux

BRANCH_NAME="$RELEASE_BRANCH"
git checkout -B $BRANCH_NAME HEAD

TEMPDIR=$(mktemp -d)
trap 'rm -rf "$TEMPDIR"' EXIT
COMMIT_MSG="$TEMPDIR/commit_message.txt"

node tools/release/do-release.js --yes --skip-git --summary-if-empty HEAD \
    adblock@auto adblockplus@auto
ADBLOCK_VERSION=$(sed -n 's/^ *version: "\([^"]*\)",*$/\1/p' host/adblock/build/config/base.mjs | head -1)
ADBLOCKPLUS_VERSION=$(sed -n 's/^ *version: "\([^"]*\)",*$/\1/p' host/adblockplus/build/webext/config/base.mjs | head -1)

cat > "$COMMIT_MSG" <<MESSAGE
build: Release AdBlock $ADBLOCK_VERSION and Adblock Plus $ADBLOCKPLUS_VERSION

Merging this merge request releases both extensions. It contains only the version bumps and the release notes headings.

Before merging, check that:

- the latest push pipeline on main is green, not a scheduled one: $CI_PROJECT_URL/-/pipelines?ref=main&source=push
- this week's filterlist update is merged: $CI_PROJECT_URL/-/merge_requests?state=all&source_branch=mr-automaton-latest-%40eyeo-filterlists
MESSAGE

git add --update
git commit -F "$COMMIT_MSG"
git push --force origin "$BRANCH_NAME"

glab mr close "$BRANCH_NAME" || true
glab mr create --fill --squash-before-merge --remove-source-branch --yes
