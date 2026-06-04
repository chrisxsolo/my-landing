// ─────────────────────────────────────────────────────────────────────────────
// lib/testimonials.ts — real client testimonials, single source of truth
// ─────────────────────────────────────────────────────────────────────────────
// Used by <Testimonials /> on the homepage (and reusable on Grads / Pricing /
// Contact pages). Paste REAL client quotes here — never invent testimonials.
//
// TO ADD ONE: append an object to TESTIMONIALS below.
//   quote    → the client's words (no surrounding quote marks; added in the UI)
//   name     → client name or "First L." for privacy
//   context  → school / session type, e.g. "SJSU Graduation", "Family Session"
//   location → optional, e.g. "San Francisco"
//   featured → optional; surface this one first / on smaller placements
// ─────────────────────────────────────────────────────────────────────────────

export type Testimonial = {
  quote: string;
  name: string;
  context: string;
  location?: string;
  featured?: boolean;
};

// Real client testimonials. Empty until real quotes are added — the
// <Testimonials /> section renders nothing while this array is empty,
// so no placeholder content ever ships to the live site.
export const TESTIMONIALS: Testimonial[] = [];
