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
        // Re-enable base ESLint rules that love disabled in favour of
        // @typescript-eslint equivalents (which require type information).
        "no-array-constructor": "error",
        "no-dupe-class-members": "error",
        "no-implied-eval": "error",
        "no-loss-of-precision": "error",
        "no-redeclare": ["error", { builtinGlobals: false }],
        "no-throw-literal": "error",
        "no-undef": "error",
        "no-unused-expressions": [
          "error",
          {
            allowShortCircuit: true,
            allowTernary: true,
            allowTaggedTemplates: true,
          },
        ],
        "no-unused-vars": [
          "error",
          {
            args: "none",
            caughtErrors: "none",
            ignoreRestSiblings: true,
            vars: "all",
          },
        ],
        "no-use-before-define": [
          "error",
          { functions: false, classes: false, variables: false },
        ],
        "no-useless-constructor": "error",
        "prefer-promise-reject-errors": "error",
      },
    },
    {
      files: ["fragment/in-product-messaging/mocks/**/*.js"],
      env: { jest: true },
    },
    {
      files: ["**/src/content/**/*.js"],
      // cloneInto is only defined by Firefox, but is required in content
      // scripts that pass objects to the document.
      globals: { cloneInto: true },
    },
    {
      files: ["fragment/public-api/tests/**/*.js"],
      // manifest is assigned in a global test setup for public-api
      globals: { manifest: true },
    },
    {
      files: ["fragment/test/**/*.js", "fragment/test/**/*.spec.ts"],
      env: { mocha: true, node: true },
      globals: { driver: true, extension: true, browserDetails: true },
    },
    {
      files: [
        "host/adblockplus/test/unit/**/*.js",
        "host/adblockplus/test/unit/**/*.mjs",
        "core/remote-configuration-validator/test/**/*.js",
      ],
      env: { mocha: true },
    },
    {
      files: ["host/adblockplus/test/unit/locale-linter/**/*.js"],
      // chai's assertions are at odds with this lint
      rules: { "no-unused-expressions": "off" },
    },
    {
      files: ["tools/test/e2e-runner/**/*.js"],
      globals: { driver: true, extension: true },
    },
    {
      files: [
        "tools/test/helper-extension/background.js",
        "core/sdk/test/extension-functional/background.js",
        "core/sdk/test/extension-performance/background.js",
      ],
      env: {
        webextensions: true,
        serviceworker: true,
      },
    },
  ],
};
