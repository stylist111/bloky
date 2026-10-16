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
      "~/picreplacement/check": path.resolve(__dirname, "./adblock-betafish/picreplacement/check"),
      "~/utilities/background": path.resolve(__dirname, "./adblock-betafish/utilities/background"),
      info: path.resolve(__dirname, "./test/unit/mocks/info"),
      "./prefs.js": path.resolve(__dirname, "./adblock-betafish/alias/prefs.js"),
    },
  },
});
