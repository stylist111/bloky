module.exports = {
  overrides: [
    {
      files: ["src/**/*.spec.ts"],
      parserOptions: {
        project: "./tsconfig.test.json",
        tsconfigRootDir: __dirname,
      },
    },
  ],
};
