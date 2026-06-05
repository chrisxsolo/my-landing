---
name: build-needs-webpack-flag
description: Production builds must use --webpack on this machine; default Turbopack build fails
metadata:
  type: project
---

`npm run build` (plain `next build`) fails on this darwin/arm64 machine with "Turbopack is not supported on this platform … native bindings are not available." Only WASM bindings load.

**Why:** The native `@next/swc-darwin-arm64` / next-swc binding isn't installed, so Turbopack can't run.

**How to apply:** Build with `npm run build -- --webpack`. The `dev` script already uses `next dev --webpack` for the same reason. Next 16.2.2.
