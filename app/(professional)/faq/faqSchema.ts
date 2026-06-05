// ─────────────────────────────────────────────────────────────────────────────
// Builds Schema.org FAQPage JSON-LD from FAQ groups, for rich results in search.
// Used by the server components of /faq and /faq/graduation.
// Plain module (no "use client") so it can run during server rendering.
// ─────────────────────────────────────────────────────────────────────────────

import type { FAQGroup } from "./faqShared";

export function buildFaqJsonLd(groups: FAQGroup[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: groups.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      }))
    ),
  };
}
