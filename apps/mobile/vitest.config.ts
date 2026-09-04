import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: [
    { find: "@", replacement: fileURLToPath(new URL(".", import.meta.url)) },
    { find: /^react-native$/, replacement: "react-native-web" }
  ] },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"]
  }
});
