import { defineConfig } from "vite";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    includeSource: ["./tests/index.d.ts"],
  },
});
