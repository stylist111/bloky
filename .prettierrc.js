module.exports = {
  overrides: [
    {
      files: "host/adblock/**/*",
      options: {
        printWidth: 100,
      },
    },
    {
      files: "host/adblockplus/**/*",
      options: {
        trailingComma: "none",
      },
    },
    {
      files: "tools/test/**/*",
      options: {
        printWidth: 100,
      },
    },
  ],
};
