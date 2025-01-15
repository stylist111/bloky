module.exports = {
  extends: "../core/configs/.eslintrc.js",
  env: {
    node: true,
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
