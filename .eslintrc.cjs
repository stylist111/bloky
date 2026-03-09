"use strict";

const typescriptEslint = require("@typescript-eslint/eslint-plugin");

module.exports = {
  root: true,
  ignorePatterns: [
    // Vendored in libraries, don't need to follow our linting standards
    "/vendor/",
  ],
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
  },
  plugins: ["eslint-plugin-html", "mocha"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  extends: ["love", "prettier", "prettier/prettier"],
  rules: {
    "@typescript-eslint/strict-boolean-expressions": "off",
    curly: ["error", "all"],
  },
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      parser: "@typescript-eslint/parser",
    },
    {
      // JavaScript-specific rules
      files: ["*.js", "*.cjs", "*.mjs", "*.html"],
      parserOptions: { project: false },
      rules: {
        // The "love" config enables many typescript rules, but these error out
        // without a typescript project.
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
