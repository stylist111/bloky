import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        app: "index.jsx",
      },
      output: {
        // Customizing the output filename for JavaScript
        entryFileNames: "index.js",

        // Customizing the output filename for CSS
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            return "styles.css";
          }
          return "[name][extname]";
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./tests/setup.js",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "@components": fileURLToPath(new URL("./components", import.meta.url)),
    },
  },
});
