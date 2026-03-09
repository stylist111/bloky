/* eslint-env node */

module.exports = {
  extends: [
    "eslint-config-eyeo",
    "plugin:mocha/recommended",
    "prettier",
    "prettier/prettier"
  ],
  env: {
    es2021: true
  },
  globals: {
    webpackDotenvPlugin: "readonly"
  },
  rules: {
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
    "mocha/no-top-level-hooks": "error",
    "prefer-const": "off",
    "eqeqeq": "off",
    "promise/param-names": "off",
    "no-void": "off",
    "no-new": "off",
    "import/no-named-default": "off",
    "import/no-webpack-loader-syntax": "off",
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
