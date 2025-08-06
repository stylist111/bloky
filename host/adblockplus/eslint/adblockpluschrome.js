/* eslint-env node */

"use strict";

/**
 * This is the legacy ESLint configuration, used for files that are in
 * the `adblockpluschrome` directory.
 *
 * Eventually, we will apply a new configuration which can be found
 * at `love.js`.
 */
module.exports = {
  extends: ["eslint-config-eyeo", "prettier", "prettier/prettier"],
  root: true,
  env: {
    browser: true,
    webextensions: true
  },
  globals: {
    BigInt: true,
    exports: true,
    ext: true,
    module: true,
    require: true,
    webpackDotenvPlugin: "readonly"
  },
  parserOptions: {
    ecmaVersion: 11,
    sourceType: "module"
  },
  rules: {
    curly: ["error", "multi-or-nest", "consistent"],
    "spaced-comment": ["error", "always", { block: { exceptions: ["*"] } }]
  },
  overrides: [
    {
      files: ["*.cjs"],
      parserOptions: {
        sourceType: "script"
      }
    }
  ]
};
