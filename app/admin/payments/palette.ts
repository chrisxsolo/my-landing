// Visual tokens for the Revenue command center. The tab renders on its own
// dark glass canvas, so it keeps a scoped palette here (single source for the
// whole dashboard) instead of inlining hex values in every component.

import { C } from "@/lib/colors";

export const REV = {
  // Canvas
  canvas: "linear-gradient(160deg,#0a101e 0%,#0c1626 45%,#0a1a1c 100%)",
  canvasBorder: "rgba(148,163,184,0.14)",
  grid: "linear-gradient(rgba(148,163,184,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.05) 1px,transparent 1px)",
  glowA: "radial-gradient(600px 280px at 12% -5%, rgba(52,211,153,0.13), transparent 70%)",
  glowB: "radial-gradient(700px 320px at 90% 0%, rgba(157,111,232,0.12), transparent 70%)",

  // Glass surfaces
  panel: "rgba(255,255,255,0.045)",
  panelHover: "rgba(255,255,255,0.07)",
  panelBorder: "rgba(255,255,255,0.09)",
  panelBorderStrong: "rgba(255,255,255,0.16)",
  inset: "rgba(8,12,22,0.45)",
  shadow: "0 10px 32px rgba(2,6,16,0.45)",

  // Type
  text: "#e8edf6",
  textSoft: "#9aa7bd",
  textFaint: "#5d6b84",

  // Semantics
  accent: "#34d399", // collected / positive
  accentDeep: "#10b981",
  accentBg: "rgba(52,211,153,0.12)",
  violet: C.p1,
  violetBg: "rgba(157,111,232,0.14)",
  pink: C.p2,
  amber: "#fbbf24", // estimates / outstanding
  amberBg: "rgba(251,191,36,0.12)",
  orange: "#fb923c",
  orangeBg: "rgba(251,146,60,0.13)",
  red: "#f87171",
  redBg: "rgba(248,113,113,0.13)",
  blue: "#60a5fa",
  blueBg: "rgba(96,165,250,0.13)",
  neutral: "#94a3b8",
  neutralBg: "rgba(148,163,184,0.12)",
} as const;

export const METHOD_META: Record<string, { label: string; color: string; bg: string }> = {
  Venmo: { label: "Venmo", color: "#5aa9e0", bg: "rgba(90,169,224,0.14)" },
  Zelle: { label: "Zelle", color: "#a78bfa", bg: "rgba(167,139,250,0.14)" },
  PayPal: { label: "PayPal", color: "#60a5fa", bg: "rgba(96,165,250,0.14)" },
  "Cash App": { label: "Cash App", color: "#34d399", bg: "rgba(52,211,153,0.14)" },
  Pixieset: { label: "Pixieset", color: "#818cf8", bg: "rgba(129,140,248,0.14)" },
  other: { label: "Other", color: "#94a3b8", bg: "rgba(148,163,184,0.14)" },
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
