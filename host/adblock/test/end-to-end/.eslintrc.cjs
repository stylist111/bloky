"use strict";

const path = require("path");

module.exports = {
  env: {
    mocha: true,
    node: true,
    webextensions: true,
  },
  globals: {
    driver: true,
    extension: true,
    browserDetails: true,
  },
  rules: {
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: true,
        packageDir: path.join(__dirname, "../.."),
      },
    ],
    "import/extensions": "off",
    "no-console": ["error", { allow: ["warn", "error"] }],
    "func-names": "off",
    "consistent-return": "off",
    "no-await-in-loop": "off",
    "no-empty": ["error", { allowEmptyCatch: true }],
    "no-loop-func": "off",
  },
};
