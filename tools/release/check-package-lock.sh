#!/bin/bash

# Usage: check-package-lock.sh <package-lock.json>
#
# We have several native dependencies which are brought in by our various
# dependencies and build tools. They tend to have these listed as
# "optionalDependencies", since you're supposed to get the one appropriate to
# your platform. Sometimes, when you update the lockfile, it will incorrectly
# remove the dependencies needed by other platforms from the lockfile.
#
# This script aims to catch when these dependencies are accidentally removed and
# prevent this from being merged into the main branch.
#
# The package-lock.json file can generally be fixed by:
# - Reverting your `package-lock.json` to a previous good state with
#   `git checkout origin/main -- package-lock.json`
# - Running `npm install` to update it based on the changes in your branch.
#
# Relevant NPM bug: https://github.com/npm/cli/issues/4828

set -eu

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <package-lock.json>>" >&2
    exit 1
fi

PACKAGE_LOCK=$1

check() {
    grep -q "node_modules/$1" "$PACKAGE_LOCK" || {
        echo "$1 not found in $PACKAGE_LOCK. See tools/release/check-package-lock.sh for details."; exit 1
    };
}

# These packages are all expected to have an entry in package-lock.json that
# lists where they will be checkout out on the relevant operating system. There
# are typically other platforms too, like Android, or Intel Macs, but checking
# x64 Linux and ARM Darwin (MacOS) for each relevant library should cover all
# cases where things are broken.

# If any of these libraries are removed entirely, then they can be removed them
# from this list too.

# ESBuild and Rollup - Used internally by Vite
check @esbuild/linux-x64
check @esbuild/darwin-arm64
check @rollup/rollup-linux-x64-gnu
check @rollup/rollup-darwin-arm64

# Sentry CLI
check @sentry/cli-linux-x64
check @sentry/cli-darwin

# NX - Lerna's build tool
check @nx/nx-linux-x64-gnu
check @nx/nx-darwin-arm64

# Sharp
check @img/sharp-linux-x64
check @img/sharp-darwin-arm64
check @img/sharp-libvips-linux-x64
check @img/sharp-libvips-darwin-arm64
