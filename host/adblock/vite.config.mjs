import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./test/unit/setup.js",
    alias: {
      "~/alias/prefs": path.resolve(__dirname, "./adblock-betafish/alias/prefs"),
      info: path.resolve(__dirname, "./test/unit/mocks/info"),
    },
  },
});
