import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    // tests share one database; no parallel files. Deliberate concurrency
    // happens INSIDE tests via Promise.allSettled.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
