// lib/portraitGuide/styles.ts
// The portrait guide reuses the family guide's `fg-*` design system verbatim so
// all guides are pixel-native to one another (same sage palette, frosted cards,
// ScrollReveal, reduced-motion behavior). We re-export it under a portrait-specific
// name so the portrait pages read clearly and could diverge later without churn.
// Only the hero marquee phrases are portrait-specific.

export { FAMILY_GUIDE_CSS as PORTRAIT_GUIDE_CSS } from "@/lib/familyGuide/styles";

// Marquee phrases for the portrait guide hero strip (portrait-specific).
export const PORTRAIT_MARQUEE = [
  "Lifestyle Portraits",
  "San Francisco & Bay Area",
  "Natural Light",
  "Guided, Relaxed Posing",
  "Personal Branding & Milestones",
  "Golden Hour by the Bay",
];
