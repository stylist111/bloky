import { mergeConfig, defineConfig } from "vite";
import base from "../../vitest.config.base.js";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      includeSource: ["./tests/index.d.ts"],
    },
  }),
);
