import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    // unit tests run anywhere; integration tests need the local Supabase stack.
    // Component tests (*.test.tsx) opt into jsdom per file with
    // `// @vitest-environment jsdom`; everything else stays in Node.
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
  },
});
