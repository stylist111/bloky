import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  test: {
    clearMocks: true,
    globals: true,
    environment: "jsdom",
    setupFiles: "./test/unit/setup.js",
    alias: {
      "~/alias/prefs": path.resolve(__dirname, "./adblock-betafish/alias/prefs"),
      info: path.resolve(__dirname, "./test/unit/mocks/info"),
    },
  },
});
