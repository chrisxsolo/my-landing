// ─────────────────────────────────────────────────────────────────────────────
// lib/colors.ts — single source of truth for every color on the site
//
// TO RETHEME EVERYTHING: change only p1, p2, p3 below.
// Every page imports from here — nothing else needs to change.
// ─────────────────────────────────────────────────────────────────────────────

const p1 = "#9d6fe8"   // ← violet  — EDIT THIS
const p2 = "#e879a0"   // ← pink    — EDIT THIS
const p3 = "#fbbf24"   // ← amber   — EDIT THIS
const page = "#fffaf5"
const pageAlt = "#fff5ed"
const warmEdge = "#eadbcb"
const warmShadow = "rgba(157,118,86,0.10)"
const white = "#ffffff"
const ink = "#0e1412"
const inkSoft = "#2f3835"
const muted = "#687571"
const mutedSoft = "#8b9692"
const danger = "#b42318"
const success = "#12805c"

// Derived rgba helpers
const r1 = "157,111,232"
const r2 = "232,121,160"
const r3 = "251,191,36"

export const C = {
  // Raw hex stops
  p1, p2, p3,
  page,
  pageAlt,
  warmEdge,
  warmShadow,
  white,
  ink,
  inkSoft,
  muted,
  mutedSoft,
  danger,
  success,
  white_22: "rgba(255,255,255,0.22)",
  white_82: "rgba(255,255,255,0.82)",

  // Main gradients
  grad:    `linear-gradient(135deg, ${p1}, ${p2}, ${p3})`,
  grad12:  `linear-gradient(135deg, ${p1}, ${p2})`,
  grad23:  `linear-gradient(135deg, ${p2}, ${p3})`,
  grad13:  `linear-gradient(135deg, ${p1}, ${p3})`,
  grad321: `linear-gradient(135deg, ${p3}, ${p2}, ${p1})`,
  grad312: `linear-gradient(135deg, ${p3}, ${p1})`,
  grad90:  `linear-gradient(90deg,  ${p1}, ${p2}, ${p3})`,
  grad90_12: `linear-gradient(90deg, ${p1}, ${p2})`,
  grad90_23: `linear-gradient(90deg, ${p2}, ${p3})`,

  // Vertical gradients (for left-side accent bars on tip cards)
  vert12:  `linear-gradient(180deg, ${p1}, ${p2})`,
  vert23:  `linear-gradient(180deg, ${p2}, ${p3})`,
  vert31:  `linear-gradient(180deg, ${p3}, ${p1})`,

  // Blobs
  blob1: `radial-gradient(circle, rgba(${r1},0.13), transparent 70%)`,
  blob2: `radial-gradient(circle, rgba(${r2},0.10), transparent 70%)`,
  blob3: `radial-gradient(circle, rgba(${r3},0.08), transparent 70%)`,

  // Warm neutral surfaces
  surface: "rgba(255,255,255,0.84)",
  surfaceStrong: "rgba(255,255,255,0.93)",
  surfaceSoft: "rgba(255,251,247,0.96)",
  surfaceWarm: `linear-gradient(135deg, rgba(255,251,247,0.98), rgba(${r2},0.08), rgba(${r3},0.08))`,
  surfaceWarmAlt: `linear-gradient(135deg, rgba(255,248,241,0.98), rgba(${r1},0.07), rgba(${r2},0.08))`,
  borderSubtle: `rgba(${r1},0.10)`,
  borderWarm: `rgba(${r2},0.14)`,
  borderWarmStrong: `rgba(${r3},0.18)`,
  shadowWarmSm: `0 8px 24px ${warmShadow}`,
  shadowWarm: `0 18px 42px ${warmShadow}`,
  shadowWarmLg: `0 26px 68px rgba(157,118,86,0.12)`,

  // Soft fills (backgrounds, borders)
  p1_04:  `rgba(${r1},0.04)`,
  p1_06:  `rgba(${r1},0.06)`,
  p1_08:  `rgba(${r1},0.08)`,
  p1_10:  `rgba(${r1},0.10)`,
  p1_12:  `rgba(${r1},0.12)`,
  p1_13:  `rgba(${r1},0.13)`,
  p1_15:  `rgba(${r1},0.15)`,
  p1_18:  `rgba(${r1},0.18)`,
  p1_20:  `rgba(${r1},0.20)`,
  p1_25:  `rgba(${r1},0.25)`,
  p1_30:  `rgba(${r1},0.30)`,
  p1_35:  `rgba(${r1},0.35)`,
  p2_06:  `rgba(${r2},0.06)`,
  p2_08:  `rgba(${r2},0.08)`,
  p2_09:  `rgba(${r2},0.09)`,
  p2_10:  `rgba(${r2},0.10)`,
  p2_12:  `rgba(${r2},0.12)`,
  p2_15:  `rgba(${r2},0.15)`,
  p2_18:  `rgba(${r2},0.18)`,
  p2_20:  `rgba(${r2},0.20)`,
  p2_25:  `rgba(${r2},0.25)`,
  p2_30:  `rgba(${r2},0.30)`,
  p3_08:  `rgba(${r3},0.08)`,
  p3_10:  `rgba(${r3},0.10)`,
  p3_15:  `rgba(${r3},0.15)`,
  p3_18:  `rgba(${r3},0.18)`,
  p3_30:  `rgba(${r3},0.30)`,

  // Grid background (used on hero sections)
  gridBg: (opacity = 0.04) => ({
    backgroundImage: `linear-gradient(rgba(${r1},${opacity}) 1px,transparent 1px),linear-gradient(90deg,rgba(${r1},${opacity}) 1px,transparent 1px)`,
    backgroundSize: "40px 40px",
  }),

  // CTA grid overlay (on gradient banners)
  ctaGrid: {
    backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`,
    backgroundSize: "24px 24px",
  },

  ctaGridLg: {
    backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`,
    backgroundSize: "28px 28px",
  },

  // Vignette overlay (fades grid at edges)
  vignette: {
    background: `radial-gradient(ellipse at 50% 50%,transparent 30%,${page} 78%)`,
  },

  // Text gradient (logo, headings)
  text: {
    background: `linear-gradient(135deg, ${p1}, ${p2}, ${p3})`,
    WebkitBackgroundClip: "text" as const,
    WebkitTextFillColor: "transparent" as const,
    backgroundClip: "text" as const,
  },
  text12: {
    background: `linear-gradient(135deg, ${p1}, ${p2})`,
    WebkitBackgroundClip: "text" as const,
    WebkitTextFillColor: "transparent" as const,
    backgroundClip: "text" as const,
  },
  text23: {
    background: `linear-gradient(135deg, ${p2}, ${p3})`,
    WebkitBackgroundClip: "text" as const,
    WebkitTextFillColor: "transparent" as const,
    backgroundClip: "text" as const,
  },
  text321: {
    background: `linear-gradient(135deg, ${p3}, ${p2}, ${p1})`,
    WebkitBackgroundClip: "text" as const,
    WebkitTextFillColor: "transparent" as const,
    backgroundClip: "text" as const,
  },
} as const
