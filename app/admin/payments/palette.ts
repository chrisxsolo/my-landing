// Visual tokens for the Revenue command center — now matched to the admin
// "Darkroom" theme: warm near-black canvas, charcoal glass panels, bright
// chemical-bath accents. Single source for the whole dashboard; no hex values
// inline in components. (Token names kept from the original light palette.)

export const REV = {
  // Canvas: warm near-black with faint ambience
  canvas: "linear-gradient(160deg,#151316 0%,#131114 55%,#121312 100%)",
  canvasBorder: "rgba(255,255,255,0.12)",
  grid: "linear-gradient(rgba(255,255,255,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.035) 1px,transparent 1px)",
  glowA: "radial-gradient(600px 280px at 12% -5%, rgba(111,194,150,0.07), transparent 70%)",
  glowB: "radial-gradient(700px 320px at 90% 0%, rgba(232,160,76,0.06), transparent 70%)",

  // Charcoal glass surfaces. NOTE: deliberately no backdrop-filter on panels —
  // dozens of blurred surfaces re-blur on every scroll frame and tank perf.
  panel: "rgba(255,255,255,0.045)",
  panelHover: "rgba(255,255,255,0.08)",
  panelBorder: "rgba(255,255,255,0.10)",
  panelBorderStrong: "rgba(255,255,255,0.18)",
  inset: "rgba(255,255,255,0.06)",
  shadow: "0 8px 28px rgba(0,0,0,0.4)",
  // Opaque overlay surfaces (tooltips, drawers, sticky bar)
  overlay: "#1c191d",
  scrim: "rgba(8,7,9,0.72)",
  rowBorder: "rgba(255,255,255,0.07)",
  optionBg: "#1c191d",

  // Type (warm paper-white ramp)
  text: "#f2efe9",
  textSoft: "#b8b2a8",
  textFaint: "#75706a",

  // Semantics (brightened for contrast on the dark canvas)
  accent: "#6fc296", // collected / positive
  accentDeep: "#5fb88a",
  accentBg: "rgba(111,194,150,0.15)",
  violet: "#ab95e0",
  violetBg: "rgba(171,149,224,0.14)",
  pink: "#e08bab",
  amber: "#e8a04c", // estimates / outstanding
  amberBg: "rgba(232,160,76,0.15)",
  orange: "#e88f4c",
  orangeBg: "rgba(232,143,76,0.14)",
  red: "#e08585",
  redBg: "rgba(224,133,133,0.13)",
  blue: "#85aede",
  blueBg: "rgba(133,174,222,0.13)",
  neutral: "#9a958e",
  neutralBg: "rgba(255,255,255,0.08)",
} as const;

export const METHOD_META: Record<string, { label: string; color: string; bg: string }> = {
  Venmo: { label: "Venmo", color: "#6cb6e8", bg: "rgba(108,182,232,0.14)" },
  Zelle: { label: "Zelle", color: "#b69df0", bg: "rgba(182,157,240,0.13)" },
  PayPal: { label: "PayPal", color: "#6aaede", bg: "rgba(106,174,222,0.13)" },
  "Cash App": { label: "Cash App", color: "#6fc296", bg: "rgba(111,194,150,0.14)" },
  Pixieset: { label: "Pixieset", color: "#9aa0f0", bg: "rgba(154,160,240,0.13)" },
  other: { label: "Other", color: "#9a958e", bg: "rgba(255,255,255,0.08)" },
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
