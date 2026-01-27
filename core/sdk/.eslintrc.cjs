/* eslint-env node */

module.exports = {
  extends: [
    "eslint-config-eyeo",
    "plugin:mocha/recommended"
  ],
  root: true,
  env: {
    es2021: true
  },
  plugins: [
    "eslint-plugin-html",
    "mocha"
  ],
  globals: {
    webpackDotenvPlugin: "readonly"
  },
  rules: {
    "brace-style": ["error", "stroustrup"],
    "curly": [
      "error",
      "all"
    ],
    "max-len": [
      "error",
      {
        ignoreUrls: true,
        ignoreRegExpLiterals: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignorePattern: "abp:subscribe"
      }
    ],
    "space-before-blocks": ["error", {functions: "always"}],
    "id-denylist": [
      "error",
      "blacklist", "blackList",
      "_blacklist", "_blackList",
      "Blacklist", "BlackList",
      "BLACKLIST", "BLACK_LIST"
    ],
    "prefer-arrow-callback": "off",
    "mocha/prefer-arrow-callback": "error",
    "mocha/max-top-level-suites": "off",
    "mocha/no-setup-in-describe": "off",
    "mocha/no-top-level-hooks": "error"
  },
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2020
  },
  overrides: [
    {
      files: [
        "background.js",
        "index-options.js"
      ],
      parserOptions: {
        sourceType: "script"
      }
    }
  ],
  ignorePatterns: [
    // Vendored in libraries
    "/adblockpluscore/lib/jsbn.js",
    "/adblockpluscore/lib/rusha.js",
    "/adblockpluscore/lib/content/snippets.js",
    // Generated but checked-in files
    "/adblockpluscore/data/",
    // We should be linting this, but it doesn't currenly follow our standard.
    "/src/types/"
  ]
};
