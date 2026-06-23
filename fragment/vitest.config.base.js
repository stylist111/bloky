import { defineConfig } from "vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
    reporters: ["verbose"],
    setupFiles: [resolve(__dirname, "./test/unit/setup.common.js")],
  },
});
