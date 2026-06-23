import { mergeConfig, defineConfig } from "vite";
import base from "../../vitest.config.base.js";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      setupFiles: "./tests/setup.js",
      includeSource: ["src/**/*.{js,ts,jsx,tsx}"],
    },
  }),
);
