#!/bin/bash

set -eux

# Track missing diff URLs
WARNINGS=""

# Updates the diff URLS used in the SDK's live subscription tests.
update_sdk_test_diff_url() {
    local FILTERLIST_ID="$1"

    # Find the diff URL from the filterlist file
    local FILTERLIST_FILE="node_modules/@eyeo/filterlists/filterlists/$FILTERLIST_ID"
    # Declared separately so set -e sees sed's status and a missing file fails.
    local DIFF_URL
    DIFF_URL=$(sed -n 's/^! DiffUrl: *//p' "$FILTERLIST_FILE")

    if [ -z "$DIFF_URL" ]; then
        echo "Warning: Could not find DiffUrl in $FILTERLIST_FILE"
        WARNINGS="${WARNINGS}- Could not find DiffUrl for $FILTERLIST_ID in $FILTERLIST_FILE\n"
        return 0
    fi

    echo "Replacing diff_url for $FILTERLIST_ID: $DIFF_URL"

    # Update the SDK's live subscriptions to have the new test URLs
    local JSON_FILE="core/sdk/test/scripts/custom-subscriptions.json"
    jq --arg id "$FILTERLIST_ID" --arg url "$DIFF_URL" \
        'map(if .id == $id then .diff_url = $url else . end)' \
        "$JSON_FILE" > "$JSON_FILE.tmp" && mv "$JSON_FILE.tmp" "$JSON_FILE"
}

BRANCH_NAME="mr-automaton-latest-@eyeo-filterlists"
git checkout -B $BRANCH_NAME HEAD

TEMPDIR=$(mktemp -d)
trap 'rm -rf "$TEMPDIR"' EXIT
COMMIT_MSG="$TEMPDIR/commit_message.txt"

OLD_MODULE="$TEMPDIR/filterlists"
NEW_MODULE="node_modules/@eyeo/filterlists"

cp -r "$NEW_MODULE" "$OLD_MODULE"

OLD_VERSION=$(jq -r .version "$NEW_MODULE/package.json")
npm install \
    -w @eyeo/rules-utils \
    -w @eyeo/webext-ad-filtering-solution \
    -w adblockpluscore \
    --save-exact @eyeo/filterlists@latest
NEW_VERSION=$(jq -r .version "$NEW_MODULE/package.json")

# Passing silently here hides broken filter list generation until release day.
if [ "$OLD_VERSION" = "$NEW_VERSION" ]; then
    echo "No new @eyeo/filterlists version available (still $NEW_VERSION)" >&2
    exit 1
fi

# The SDK has a few tests that the default live subscriptions can be added, and
# updated using the diff URLs. On the server side, these diff URLs expire after
# a few months, so it's necessary to update these test diff URLs from time to
# time.
#
# Ideally, the SDK would use the same rules build process that the hosts do, by
# depending on tools/rules. Unfortunately, this isn't currently possible without
# some large scale refactoring because tools/rules depends on the SDK to parse
# filters and do DNR rule conversion.
update_sdk_test_diff_url "8C13E995-8F06-4927-BEA7-6C845FB7EEBF"
update_sdk_test_diff_url "0798B6A2-94A4-4ADF-89ED-BEC112FC4C7F"
update_sdk_test_diff_url "D4028CDD-3D39-4624-ACC7-8140F4EC3238"

# Versions: minor if a feature landed since the latest release tag, else patch.
node tools/release/do-release.js --yes --skip-git --summary-if-empty HEAD \
    adblock@auto adblockplus@auto
ADBLOCK_VERSION=$(sed -n 's/^ *version: "\([^"]*\)",*$/\1/p' host/adblock/build/config/base.mjs | head -1)
ADBLOCKPLUS_VERSION=$(sed -n 's/^ *version: "\([^"]*\)",*$/\1/p' host/adblockplus/build/webext/config/base.mjs | head -1)

if [ "$(git status --porcelain)" ]; then
    echo -e "build: Release AdBlock $ADBLOCK_VERSION and Adblock Plus $ADBLOCKPLUS_VERSION\n" > "$COMMIT_MSG"
    echo -e "Merging this merge request releases both hosts. It contains the version bumps, the release notes headings and the latest filterlists.\n" >> "$COMMIT_MSG"

    echo -e "## Index changes:\n\`\`\`" >> "$COMMIT_MSG"
    if git diff --no-index -- "$OLD_MODULE/filterlists/index.json" "$NEW_MODULE/filterlists/index.json" >> "$COMMIT_MSG"; then
        echo "No index changes" >> "$COMMIT_MSG"
    fi
    echo -e "\`\`\`\n" >> "$COMMIT_MSG"

    echo -e "## File changes:\n\`\`\`" >> "$COMMIT_MSG"
    git diff --no-index --stat -- "$OLD_MODULE" "$NEW_MODULE" >> "$COMMIT_MSG" || true
    echo -e "\`\`\`\n" >> "$COMMIT_MSG"

    # Append missing diff URL warnings at the end
    if [ -n "$WARNINGS" ]; then
        echo -e "## Warnings:\n" >> "$COMMIT_MSG"
        echo -e "$WARNINGS" >> "$COMMIT_MSG"
    fi

    # Run the scheduled pipeline by hand with DRY_RUN=true to see the MR
    # without pushing anything.
    if [ "${DRY_RUN:-false}" = "true" ]; then
        cat "$COMMIT_MSG"
        git --no-pager diff --stat
        exit 0
    fi

    git add --update
    git commit -F "$COMMIT_MSG"
    git push --force origin "$BRANCH_NAME"

    glab mr close "$BRANCH_NAME" || true
    glab mr create --fill --squash-before-merge --remove-source-branch --yes
fi
