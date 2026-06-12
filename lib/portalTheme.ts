// Visual tokens for the client-facing "Gallery Print" theme — the light
// counterpart to the admin Darkroom (app/admin/adminTheme.ts): warm paper
// canvas like a print gallery, the same Fraunces/IBM Plex Mono type system,
// and a deeper print-amber accent that passes AA on light backgrounds.
// Single source for these surfaces so no hex values live inline.

export const G = {
  // Canvas — warm paper white
  page: "#faf8f3",

  // Panels — gallery-white cards on paper
  panel: "#ffffff",
  border: "rgba(40,30,15,0.10)",
  borderStrong: "rgba(40,30,15,0.20)",
  inset: "rgba(40,30,15,0.035)",
  insetBorder: "rgba(40,30,15,0.08)",
  shadow: "0 1px 2px rgba(40,30,15,0.04), 0 12px 32px rgba(40,30,15,0.07)",
  shadowLift: "0 2px 4px rgba(40,30,15,0.05), 0 18px 44px rgba(40,30,15,0.10)",

  // Ink — warm gray ramp
  ink: "#221f1b",
  inkSoft: "#5c554b",
  inkFaint: "#a39a8c",

  // Accent — print amber (deeper sibling of the Darkroom safelight #e8a04c)
  accent: "#b07a35",
  accentBg: "rgba(176,122,53,0.10)",
  accentBorder: "rgba(176,122,53,0.32)",

  // Semantic
  green: "#2e7d52",
  greenBg: "rgba(46,125,82,0.10)",
  greenBorder: "rgba(46,125,82,0.28)",
  red: "#b3473d",
  redBg: "rgba(179,71,61,0.08)",
  redBorder: "rgba(179,71,61,0.25)",

  // Primary button — distinct roles that currently share ink/page values but
  // may diverge: dark = button fill (same as ink), paperText = text on dark
  // (same as page).
  dark: "#221f1b",
  darkHover: "#352f27",
  paperText: "#faf8f3",

  // Typography — Fraunces for display, IBM Plex Mono for EXIF-style labels
  display: "'Fraunces', Georgia, 'Times New Roman', serif",
  mono: "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace",
} as const;
