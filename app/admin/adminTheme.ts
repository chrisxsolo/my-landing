// Visual tokens for the admin home + inquiries redesign — clean neutral
// "studio" look: ivory canvas, white glass panels, ink type, quiet accents.
// Single source for these surfaces so no hex values live inline in the tabs.
// (Same pattern as app/admin/payments/palette.ts, which themes Revenue.)

export const T = {
  // Canvas
  page: "#f6f6f4",
  canvasGlow: "radial-gradient(640px 300px at 8% -4%, rgba(31,122,92,0.05), transparent 70%), radial-gradient(720px 340px at 94% -6%, rgba(157,111,232,0.05), transparent 70%)",

  // Panels — white glass over the soft canvas (no backdrop-filter; cheap + crisp)
  panel: "rgba(255,255,255,0.82)",
  panelSolid: "#ffffff",
  panelHover: "rgba(255,255,255,0.97)",
  border: "rgba(28,28,32,0.08)",
  borderStrong: "rgba(28,28,32,0.16)",
  rowBorder: "rgba(28,28,32,0.06)",
  inset: "rgba(28,28,32,0.045)",
  insetStrong: "rgba(28,28,32,0.08)",
  shadow: "0 1px 2px rgba(16,18,22,0.04), 0 10px 30px rgba(16,18,22,0.06)",
  shadowHover: "0 2px 4px rgba(16,18,22,0.05), 0 16px 40px rgba(16,18,22,0.10)",
  scrim: "rgba(17,18,22,0.40)",

  // Ink (neutral type ramp)
  ink: "#1c1c20",
  inkSoft: "#55555c",
  inkFaint: "#8e8e95",

  // Primary action — ink button, the one strong element on the page
  action: "#1c1c20",
  actionHover: "#2c2c33",
  actionText: "#ffffff",

  // Quiet semantic accents (desaturated, dark enough for white panels)
  green: "#1f7a5c",
  greenBg: "rgba(31,122,92,0.09)",
  greenBorder: "rgba(31,122,92,0.22)",
  amber: "#9a6b15",
  amberBg: "rgba(176,124,30,0.11)",
  amberBorder: "rgba(176,124,30,0.28)",
  blue: "#3a64b4",
  blueBg: "rgba(58,100,180,0.09)",
  blueBorder: "rgba(58,100,180,0.22)",
  red: "#b4373d",
  redBg: "rgba(180,55,61,0.08)",
  redBorder: "rgba(180,55,61,0.22)",
  violet: "#6d5bc4",
  violetBg: "rgba(109,91,196,0.09)",
  violetBorder: "rgba(109,91,196,0.22)",
  neutralBg: "rgba(28,28,32,0.05)",
} as const;

/** Status colors for inquiry pipeline chips/rails. */
export const INQ_STATUS = {
  new: { label: "● New", color: T.green, bg: T.greenBg },
  responded: { label: "✓ Responded", color: T.blue, bg: T.blueBg },
  not_interested: { label: "✕ Not interested", color: T.red, bg: T.redBg },
  archived: { label: "○ Archived", color: T.inkFaint, bg: T.neutralBg },
} as const;
