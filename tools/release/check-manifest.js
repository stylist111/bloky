#!/usr/bin/env node

// Usage: check-manifest.js <manifest.json>
//
// This script performs two checks on the manifest of an extension release
// build and is run by the `check-source:manifest:*` GitLab CI jobs.
//
// 1. Permissions match the expected ones (`checkPermissions`)
//
//    Permission changes can trigger store reviews and permission warnings for
//    users, so they need to be reviewed in the merge request that introduces
//    them rather than at store submission. The expected permissions are
//    defined as whitespace-separated lists in the CI job variables:
//
//    - EXPECTED_PERMISSIONS: `permissions`
//    - EXPECTED_OPTIONAL_PERMISSIONS: `optional_permissions`
//    - EXPECTED_HOST_PERMISSIONS: `host_permissions`
//
//    An unset variable means no permissions are expected for that key.
//
//    If a change is intentional, update the job variables according to the
//    diff the script prints on failure.
//
// 2. Ad-filtering solution content scripts are injected first
//    (`checkContentScriptOrder`)
//
//    content.js must start the first content_scripts entry and content-main.js
//    the second one.

import assert from "assert";
import fs from "fs";

const PERMISSION_VARIABLES = {
  permissions: "EXPECTED_PERMISSIONS",
  optional_permissions: "EXPECTED_OPTIONAL_PERMISSIONS",
  host_permissions: "EXPECTED_HOST_PERMISSIONS",
};

const SDK_CONTENT_SCRIPTS = [
  "vendor/@eyeo/webext-ad-filtering-solution/content.js",
  "vendor/@eyeo/webext-ad-filtering-solution/content-main.js",
];

const [, , manifestPath] = process.argv;

if (!manifestPath) {
  console.error(`Usage: ${process.argv[1]} <manifest.json>`);
  process.exit(1);
}

function sorted(values = []) {
  return [...new Set(values)].sort();
}

function checkPermissions(manifest) {
  console.log("Checking that permissions match the expected ones");

  let isValid = true;

  for (const [key, variable] of Object.entries(PERMISSION_VARIABLES)) {
    // Leading or trailing whitespace in the variable results in empty strings
    // after splitting, which aren't permissions and need to be removed
    const expected = sorted(
      process.env[variable]?.split(/\s+/).filter(Boolean),
    );
    try {
      assert.deepStrictEqual(
        sorted(manifest[key]),
        expected,
        `${key} differ from ${variable}`,
      );
    } catch (error) {
      isValid = false;
      console.error(error.message);
    }
  }

  return isValid;
}

function checkContentScriptOrder(manifest) {
  console.log("Checking that ad-filtering content scripts are injected first");

  const contentScripts = manifest.content_scripts ?? [];
  let isValid = true;

  SDK_CONTENT_SCRIPTS.forEach((script, index) => {
    const actual = contentScripts[index]?.js?.[0];
    if (actual !== script) {
      isValid = false;
      console.error(
        `content_scripts[${index}] must start with ${script}, found ${actual}`,
      );
    }
  });

  return isValid;
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const arePermissionsValid = checkPermissions(manifest);
const isOrderValid = checkContentScriptOrder(manifest);

if (!arePermissionsValid || !isOrderValid) {
  process.exit(1);
}

console.log("All checks passed");
