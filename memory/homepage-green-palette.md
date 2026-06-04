---
name: homepage-green-palette
description: The professional homepage uses its own green/sage palette, not the C violet theme
metadata:
  type: reference
---

The professional homepage ([app/(professional)/page.tsx](app/(professional)/page.tsx)) uses its **own inline green/sage palette** (e.g. `#101412`, `#667f79`, `#f5f6f4`, `rgba(112,139,133,…)`) via a local `CSS` string template — it does NOT import `C` from `@/lib/colors`.

`C` is the warm violet/pink/amber theme used on guide pages and the homepage's client-portal section. AGENTS.md says "always use `C`," but the homepage's main sections predate that and have an established green look. When adding sections to the homepage, **match the existing green frosted-glass language** for visual consistency rather than introducing `C`'s violet (it would clash).

`data-reveal` / `data-delay` scroll animations are globally available (mounted in the (professional) layout via [ScrollReveal](app/components/ScrollReveal.tsx)).
