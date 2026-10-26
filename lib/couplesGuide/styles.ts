// lib/couplesGuide/styles.ts
// The couples guide reuses the family guide's `fg-*` design system verbatim so the
// two guides are pixel-native to one another (same sage palette, frosted cards,
// ScrollReveal, reduced-motion behavior). We re-export it under a couples-specific
// name so the couples pages read clearly and could diverge later without a churn.

export { FAMILY_GUIDE_CSS as COUPLES_GUIDE_CSS } from "@/lib/familyGuide/styles";
