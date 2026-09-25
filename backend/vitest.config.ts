import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["backend/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["backend/src/**/*.ts"],
      exclude: ["backend/src/server.ts"],
      reporter: ["text", "json-summary", "html"],
    },
  },
});
