"use strict";

const typescriptEslint = require("@typescript-eslint/eslint-plugin");

module.exports = {
  root: true,
  ignorePatterns: [
    // Vendored in libraries, don't need to follow our linting standards
    "/vendor/",

    // These don't follow the desired linting rules yet, but should
    "/core/remote-configuration-validator/**/*.js",
    "/tools/release/**/*.js",
    "/host/adblock/build/",
  ],
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      extends: ["love", "prettier", "prettier/prettier"],
      parser: "@typescript-eslint/parser",
      rules: {
        "@typescript-eslint/strict-boolean-expressions": "off",
        curly: "error",
      },
    },
    {
      // JavaScript-specific rules
      files: ["*.js", "*.cjs", "*.mjs", "*.html"],
      extends: ["love", "prettier", "prettier/prettier"],
      parserOptions: { project: false },
      rules: {
        // The "love" config enables many typescript rules, but these error out
        // without a project.
        ...Object.fromEntries(
          Object.keys(typescriptEslint.rules).map((rule) => [
            `@typescript-eslint/${rule}`,
            "off",
          ]),
        ),
      },
    },
  ],
};
