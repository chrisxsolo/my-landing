// "Keep exploring" under a post: the session's location-library guide appears
// only when that place is published, and the Family category reads "Families".
import { describe, expect, it } from "vitest";
import { linksFromRows, locationGuideLink } from "@/lib/blog/journalLocations";
import { exploreLinksFor } from "@/lib/blog/postService";
import { normalizeCategoryTag, resolvePostCategories } from "@/lib/blog/postCategories";

const item = (postId: string, sessionId: string | null) => ({
  published_target_id: postId, session_content_packages: sessionId ? { photography_session_id: sessionId } : null,
});
const link = (sessionId: string, loc: { slug: string; title: string; active: boolean } | null, excluded = false) => ({
  photography_session_id: sessionId, excluded, bay_area_locations: loc,
});

describe("linksFromRows", () => {
  it("maps a post to its session's published location guide", () => {
    const out = linksFromRows(
      [item("20", "s-cove"), item("22", "s-cove-2"), item("16", "s-kim")],
      [link("s-cove", { slug: "shark-fin-cove", title: "Shark Fin Cove ", active: true }),
       link("s-cove-2", { slug: "shark-fin-cove", title: "Shark Fin Cove", active: true })],
    );
    expect(out).toEqual({
      "20": { label: "Shark Fin Cove photo location guide", href: "/bay-area-locations#shark-fin-cove" },
      "22": { label: "Shark Fin Cove photo location guide", href: "/bay-area-locations#shark-fin-cove" },
    });
  });

  it("gives no link for an unpublished (inactive) or excluded location, or a session with no place", () => {
    const out = linksFromRows(
      [item("15", "s-legion"), item("21", "s-cal"), item("17", "s-none"), item("9", null)],
      [link("s-legion", { slug: "legion-of-honor", title: "Legion of Honor", active: false }),
       link("s-cal", { slug: "uc-berkeley", title: "UC Berkeley", active: true }, true)],
    );
    expect(out).toEqual({});
  });

  it("gives no link when a session has two published places (no single guide to point at)", () => {
    const out = linksFromRows([item("30", "s-two")], [
      link("s-two", { slug: "a", title: "A", active: true }), link("s-two", { slug: "b", title: "B", active: true }),
    ]);
    expect(out).toEqual({});
  });

  it("builds the anchor link the public locations page uses", () => {
    expect(locationGuideLink({ slug: "palace-of-fine-arts", title: "Palace of Fine Arts" }))
      .toEqual({ label: "Palace of Fine Arts photo location guide", href: "/bay-area-locations#palace-of-fine-arts" });
  });
});

describe("exploreLinksFor with a location guide", () => {
  const guide = { label: "Shark Fin Cove photo location guide", href: "/bay-area-locations#shark-fin-cove" };

  it("places the guide first for a couples post, before the service links", () => {
    expect(exploreLinksFor("couples", null, guide).map((l) => l.href))
      .toEqual(["/bay-area-locations#shark-fin-cove", "/portfolio/couples", "/couples-guide", "/pricing/couples", "/availability", "/contact"]);
  });

  it("keeps the school page first on a grad post, then the guide", () => {
    const school = { label: "UC Berkeley", href: "/grads/uc-berkeley" };
    const campus = { label: "UC Berkeley photo location guide", href: "/bay-area-locations#uc-berkeley" };
    expect(exploreLinksFor("grads", school, campus).map((l) => l.href).slice(0, 2))
      .toEqual(["/grads/uc-berkeley", "/bay-area-locations#uc-berkeley"]);
  });

  it("is unchanged without a guide", () => {
    expect(exploreLinksFor("couples", null)).toEqual(exploreLinksFor("couples", null, null));
  });
});

describe("category labels", () => {
  it("reads Families, matching the service and pricing pages", () => {
    expect(normalizeCategoryTag("family")).toEqual({ slug: "family", label: "Families" });
    expect(resolvePostCategories({ title: "A family morning at Baker Beach", slug: "family-baker-beach" }, null))
      .toEqual([{ slug: "family", label: "Families" }]);
  });
});
