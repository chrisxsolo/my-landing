// Visual tokens for the admin "Darkroom" theme — a photography-native dark
// interface: warm near-black canvas (like a darkroom), one amber *safelight*
// accent as the primary action color, film-grain texture, paper-white ink.
// Single source for these surfaces so no hex values live inline in the tabs.
// (Same pattern as app/admin/payments/palette.ts, which themes Revenue.)

export const T = {
  // Canvas — warm near-black with a faint safelight glow bleeding in from above
  page: "#131114",
  canvasGlow: "radial-gradient(900px 420px at 50% -8%, rgba(232,160,76,0.07), transparent 70%), radial-gradient(640px 300px at 8% 110%, rgba(164,143,220,0.05), transparent 70%)",

  // Panels — charcoal glass over the dark canvas
  panel: "rgba(255,255,255,0.045)",
  panelSolid: "#1c191d",
  panelHover: "rgba(255,255,255,0.07)",
  border: "rgba(255,255,255,0.09)",
  borderStrong: "rgba(255,255,255,0.18)",
  rowBorder: "rgba(255,255,255,0.06)",
  inset: "rgba(255,255,255,0.05)",
  insetStrong: "rgba(255,255,255,0.10)",
  shadow: "0 1px 2px rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.35)",
  shadowHover: "0 2px 4px rgba(0,0,0,0.5), 0 18px 48px rgba(0,0,0,0.5)",
  scrim: "rgba(8,7,9,0.72)",

  // Ink (warm paper-white type ramp)
  ink: "#f2efe9",
  inkSoft: "#b8b2a8",
  inkFaint: "#75706a",

  // Primary action — the amber safelight, the one glowing element in the dark
  action: "#e8a04c",
  actionHover: "#f0b066",
  actionText: "#1a1209",
  glow: "0 0 0 1px rgba(232,160,76,0.25), 0 4px 20px rgba(232,160,76,0.25)",

  // Semantic accents — chemical-bath tones, bright enough for dark panels
  green: "#6fc296",
  greenBg: "rgba(111,194,150,0.13)",
  greenBorder: "rgba(111,194,150,0.32)",
  amber: "#e8a04c",
  amberBg: "rgba(232,160,76,0.13)",
  amberBorder: "rgba(232,160,76,0.34)",
  blue: "#85aede",
  blueBg: "rgba(133,174,222,0.13)",
  blueBorder: "rgba(133,174,222,0.32)",
  red: "#e08585",
  redBg: "rgba(224,133,133,0.13)",
  redBorder: "rgba(224,133,133,0.32)",
  violet: "#ab95e0",
  violetBg: "rgba(171,149,224,0.13)",
  violetBorder: "rgba(171,149,224,0.32)",
  neutralBg: "rgba(255,255,255,0.07)",

  // Typography — editorial serif for headings, mono for EXIF-style data
  display: "'Fraunces', Georgia, 'Times New Roman', serif",
  mono: "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace",
} as const;

/** Status colors for inquiry pipeline chips/rails. */
export const INQ_STATUS = {
  new: { label: "● New", color: T.green, bg: T.greenBg },
  responded: { label: "✓ Responded", color: T.blue, bg: T.blueBg },
  not_interested: { label: "✕ Not interested", color: T.red, bg: T.redBg },
  archived: { label: "○ Archived", color: T.inkFaint, bg: T.neutralBg },
} as const;
