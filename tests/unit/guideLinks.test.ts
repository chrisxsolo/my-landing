import { describe, it, expect } from "vitest";
import {
  applyGuideLink, brokenGuideLinks, dropPendingGuideLink, internalPath, markGuideLinkReady, sanitizeBodyLinks,
} from "@/lib/contentEngine/guideLinks";
import type { PendingGuideLink } from "@/lib/contentEngine/payloads";

const URL = "/couples-guide/locations/shark-fin-cove-santa-cruz";
const pending: PendingGuideLink = {
  guide: "couples", location_key: "shark-fin-cove", place_name: "Shark Fin Cove",
  slug: "shark-fin-cove-santa-cruz", label: "Shark Fin Cove couples photography guide", status: "pending",
};

describe("sanitizeBodyLinks — the Khuong failure", () => {
  const body =
    "the [Bay Area Couples Photography Location Guide](/couples-guide) is a good place to start, and if " +
    "you're weighing coastal locations, the [Ocean Beach Couples Photoshoot Guide](/couples-guide/locations/ocean-beach) " +
    "has helpful details too. [Instagram](https://instagram.com/soloxsnaps)";

  it("unwraps internal links that were not provided, keeps allowed and external ones", () => {
    const out = sanitizeBodyLinks(body, new Set(["/couples-guide"]));
    expect(out.removed).toEqual(["/couples-guide/locations/ocean-beach"]);
    expect(out.body).not.toContain("](/couples-guide/locations/ocean-beach)");
    expect(out.body).toContain("[Bay Area Couples Photography Location Guide](/couples-guide)");
    expect(out.body).toContain("(https://instagram.com/soloxsnaps)");
  });

  it("treats absolute links on our own domain as internal", () => {
    expect(internalPath("https://www.soloxsnaps.com/couples-guide/")).toBe("/couples-guide");
    const out = sanitizeBodyLinks("[x](https://soloxsnaps.com/secret-page)", new Set());
    expect(out.body).toBe("x");
  });
});

describe("Test F (pure) — pending guide links", () => {
  const journal = { body: "Golden hour at Shark Fin Cove.", internal_links: [], pending_guide_links: [pending] };

  it("a pending link is not a broken link — it was never written", () => {
    expect(brokenGuideLinks(journal, () => false)).toEqual([]);
  });

  it("a link to a guide that is not live is caught before publishing", () => {
    const withLink = { ...journal, internal_links: [{ url: URL, label: "guide" }] };
    expect(brokenGuideLinks(withLink, () => false)).toEqual([URL]);
    expect(brokenGuideLinks(withLink, (p) => p === URL)).toEqual([]);
  });

  it("publishing the guide turns the pending reference into a real link, once", () => {
    const linked = applyGuideLink(journal, "couples", "shark-fin-cove", URL);
    expect(linked.body).toContain(`](${URL})`);
    expect(linked.internal_links).toEqual([{ url: URL, label: pending.label }]);
    expect(linked.pending_guide_links).toEqual([]);
    expect(applyGuideLink(linked, "couples", "shark-fin-cove", URL)).toBe(linked);
  });

  it("approved journals are only flagged ready", () => {
    const flagged = markGuideLinkReady(journal, "couples", "shark-fin-cove");
    expect(flagged.body).toBe(journal.body);
    expect(flagged.pending_guide_links[0].status).toBe("ready");
  });
});

describe("Test G (pure) — rejected guide", () => {
  it("dropping the dependency leaves the body and live links untouched", () => {
    const journal = { body: "Body.", internal_links: [{ url: "/pricing/couples", label: "Pricing" }], pending_guide_links: [pending] };
    const dropped = dropPendingGuideLink(journal, "couples", "shark-fin-cove");
    expect(dropped.pending_guide_links).toEqual([]);
    expect(dropped.body).toBe(journal.body);
    expect(dropped.internal_links).toEqual(journal.internal_links);
  });

  it("only the matching guide's dependency is dropped", () => {
    const other = { ...pending, guide: "family" as const };
    const dropped = dropPendingGuideLink({ body: "b", pending_guide_links: [pending, other] }, "couples", "shark-fin-cove");
    expect(dropped.pending_guide_links).toEqual([other]);
  });
});
