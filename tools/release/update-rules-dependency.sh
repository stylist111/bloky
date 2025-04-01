#!/bin/bash

set -eux

BRANCH_NAME="mr-automaton-latest-@eyeo-filterlists"
git checkout -B $BRANCH_NAME HEAD

TEMPDIR=$(mktemp -d)
COMMIT_MSG="$TEMPDIR/commit_message.txt"

OLD_MODULE="$TEMPDIR/filterlists"
NEW_MODULE="node_modules/@eyeo/filterlists"

cp -r "$NEW_MODULE" "$OLD_MODULE"
npm install -w @eyeo/rules-utils --save-exact @eyeo/filterlists@latest

if [ "$(git status --porcelain)" ]; then
    echo -e "build: Updated filterlists dependency to update rules data [noissue]\n" > "$COMMIT_MSG"

    echo -e "## Index changes:\n\`\`\`" >> "$COMMIT_MSG"
    if git diff --no-index -- "$OLD_MODULE/filterlists/index.json" "$NEW_MODULE/filterlists/index.json" >> "$COMMIT_MSG"; then
        echo "No index changes" >> "$COMMIT_MSG"
    fi
    echo -e "\`\`\`\n" >> "$COMMIT_MSG"

    echo -e "## File changes:\n\`\`\`" >> "$COMMIT_MSG"
    git diff --no-index --stat -- "$OLD_MODULE" "$NEW_MODULE" >> "$COMMIT_MSG" || true
    echo -e "\`\`\`\n" >> "$COMMIT_MSG"

    git add --update
    git commit -F "$COMMIT_MSG"
    git push --force origin "$BRANCH_NAME"

    glab mr close "$BRANCH_NAME" || true
    glab mr create --fill --squash-before-merge --remove-source-branch --yes
fi

# Clean up
rm -rf "$TEMPDIR"
