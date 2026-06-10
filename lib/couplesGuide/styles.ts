// lib/couplesGuide/styles.ts
// The couples guide reuses the family guide's `fg-*` design system verbatim so the
// two guides are pixel-native to one another (same sage palette, frosted cards,
// ScrollReveal, reduced-motion behavior). We re-export it under a couples-specific
// name so the couples pages read clearly and could diverge later without a churn.
// Only the hero marquee phrases are couples-specific.

export { FAMILY_GUIDE_CSS as COUPLES_GUIDE_CSS } from "@/lib/familyGuide/styles";

// Marquee phrases for the couples guide hero strip (couples-specific).
export const COUPLES_MARQUEE = [
  "Couples Photography",
  "San Francisco & Bay Area",
  "Natural Light",
  "Guided, Relaxed Posing",
  "Anniversaries & Engagements",
  "Golden Hour by the Bay",
];
