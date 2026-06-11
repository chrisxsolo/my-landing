import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    // unit tests run anywhere; integration tests need the local Supabase stack
    include: ["tests/unit/**/*.test.ts"],
  },
});
