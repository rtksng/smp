import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic"
  },
  oxc: false,
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"]
  }
});
