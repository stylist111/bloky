module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  env: {
    node: true,
    browser: true,
    es2021: true,
    webextensions: true,
  },
  globals: {
    driver: true,
    extension: true,
  },
  rules: {
    "no-console": ["error", { allow: ["warn", "error"] }],
    "no-undef": "error",
    "no-unused-vars": "error",
  },
};
