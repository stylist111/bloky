import { mergeConfig, defineConfig } from "vite";
import base from "../../vitest.config.base.js";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ["src/**/*.spec.ts"],
      setupFiles: ["./mocks/js/setup.js"],
      restoreMocks: true,
      resetMocks: true,
    },
  }),
);
