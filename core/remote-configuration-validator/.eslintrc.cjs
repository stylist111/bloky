"use strict";

// This is a copy of the ESLint configuration in eyeo's extensions monorepo
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
  },
  ignorePatterns: ["dist/"],
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
      files: ["*.js"],
      extends: ["prettier", "prettier/prettier"],
      rules: {
        // Add other JavaScript-specific rules here
      },
    },
  ],
};
