---
name: build-webpack-flag
description: Production builds must use `next build --webpack` on this Mac; default Turbopack fails
metadata:
  type: project
---

On this machine (darwin/arm64), `npm run build` (plain `next build`, Turbopack by default in Next 16) fails with "Turbopack is not supported on this platform … native bindings are not available" because the SWC native bindings aren't installed — only WASM loaded.

**Why:** The `@next/swc-darwin-arm64` native binary isn't installed, so Turbopack can't run; only Webpack works.

**How to apply:** To verify a production build locally, run `npx next build --webpack`. (The `dev` script already uses `next dev --webpack` for the same reason.) Vercel's own build environment is unaffected.
