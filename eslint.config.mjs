import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build output from `next dev --webpack` — generated artifacts, not source.
    ".next-dev/**",
    // Standalone browser extension with its own (non-Next) conventions.
    "pixieset-extension/**",
    // Skill/agent tooling scripts — Node CommonJS, not part of the app build.
    ".agents/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
