// Visual tokens for the Revenue command center — light Apple-style
// glassmorphism: prominent white, neutral grays, frosted translucent panels.
// Single source for the whole dashboard; no hex values inline in components.

import { C } from "@/lib/colors";

export const REV = {
  // Canvas: soft white with faint pastel ambience
  canvas: "linear-gradient(160deg,#fdfdfe 0%,#f5f6f8 55%,#f2f5f4 100%)",
  canvasBorder: "rgba(60,60,67,0.12)",
  grid: "linear-gradient(rgba(60,60,67,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(60,60,67,0.045) 1px,transparent 1px)",
  glowA: "radial-gradient(600px 280px at 12% -5%, rgba(16,185,129,0.08), transparent 70%)",
  glowB: "radial-gradient(700px 320px at 90% 0%, rgba(157,111,232,0.07), transparent 70%)",

  // Frosted glass surfaces. NOTE: deliberately no backdrop-filter on panels —
  // dozens of blurred surfaces re-blur on every scroll frame and tank perf.
  // Higher-opacity white over the soft canvas reads the same at ~zero cost.
  panel: "rgba(255,255,255,0.78)",
  panelHover: "rgba(255,255,255,0.95)",
  panelBorder: "rgba(60,60,67,0.10)",
  panelBorderStrong: "rgba(60,60,67,0.18)",
  inset: "rgba(60,60,67,0.06)",
  shadow: "0 8px 28px rgba(17,24,39,0.08)",
  // Opaque overlay surfaces (tooltips, drawers, sticky bar)
  overlay: "rgba(255,255,255,0.97)",
  scrim: "rgba(17,24,39,0.28)",
  rowBorder: "rgba(60,60,67,0.07)",
  optionBg: "#ffffff",

  // Type (Apple neutral ink)
  text: "#1d1d1f",
  textSoft: "#56565c",
  textFaint: "#8e8e93",

  // Semantics (darkened for contrast on white)
  accent: "#0a8a64", // collected / positive
  accentDeep: "#0a7556",
  accentBg: "rgba(16,185,129,0.13)",
  violet: C.p1,
  violetBg: "rgba(157,111,232,0.13)",
  pink: "#d4537f",
  amber: "#b97309", // estimates / outstanding
  amberBg: "rgba(217,144,12,0.14)",
  orange: "#d4630e",
  orangeBg: "rgba(234,116,30,0.13)",
  red: "#d2363c",
  redBg: "rgba(220,60,66,0.11)",
  blue: "#2f6fd6",
  blueBg: "rgba(59,123,224,0.12)",
  neutral: "#6e6e73",
  neutralBg: "rgba(110,110,115,0.10)",
} as const;

export const METHOD_META: Record<string, { label: string; color: string; bg: string }> = {
  Venmo: { label: "Venmo", color: "#2a7cb6", bg: "rgba(61,149,206,0.13)" },
  Zelle: { label: "Zelle", color: "#6d28d9", bg: "rgba(124,58,237,0.11)" },
  PayPal: { label: "PayPal", color: "#0a5f9e", bg: "rgba(0,112,186,0.11)" },
  "Cash App": { label: "Cash App", color: "#0a8a64", bg: "rgba(16,185,129,0.13)" },
  Pixieset: { label: "Pixieset", color: "#4f46e5", bg: "rgba(99,102,241,0.11)" },
  other: { label: "Other", color: "#6e6e73", bg: "rgba(110,110,115,0.10)" },
};

export const SERVICE_COLORS: Record<string, string> = {
  graduation: REV.accent,
  couples: REV.pink,
  family: REV.amber,
  portrait: REV.blue,
  event: REV.violet,
  other: REV.neutral,
  unlinked: REV.textFaint,
};

export const SEVERITY_META = {
  high: { label: "High", color: REV.red, bg: REV.redBg },
  medium: { label: "Medium", color: REV.orange, bg: REV.orangeBg },
  low: { label: "Low", color: REV.neutral, bg: REV.neutralBg },
} as const;

/** Ordinal palette for ranked bars / donut segments. */
export const SERIES_COLORS = [REV.accent, REV.violet, REV.blue, REV.amber, REV.pink, REV.orange, REV.neutral];
