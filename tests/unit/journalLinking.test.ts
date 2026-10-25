// Content Engine journal linking: generated bodies keep links inside their
// paragraphs, never carry a generic link list, link each page once, and only
// link pages that exist.
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dedupeBodyLinks, finalizeJournalBody, prioritizeLinks, stripLinkListSections,
} from "@/lib/contentEngine/guideLinks";
import { blogSlugsInBody, missingBlogLinks } from "@/lib/contentEngine/relatedPosts";
import { buildJournalPrompt, buildInternalLinkPrompt } from "@/lib/contentEngine/prompts";
import { detectPostService, exploreLinksFor } from "@/lib/blog/postService";
import { parseBody, type Inline } from "@/lib/blog/markdown";
import type { SessionFactsSnapshot } from "@/lib/contentEngine/payloads";

const facts = { service_type: "couples", secondary_locations: [] } as SessionFactsSnapshot;
const ALLOWED = new Set(["/couples-guide", "/pricing/couples", "/couples-guide/locations/lovers-lane"]);

// What the model returned for Shark Fin Cove, plus the kind of list it must not add.
const MODEL_BODY = [
  "couples photoshoot at shark fin cove! the light came in low over the sandstone.",
  "for more ideas along the coast, the [Bay Area Couples Photography Location Guide](/couples-guide) is a good place to start.",
  "curious about booking? see [Couples Photography Pricing](/pricing/couples).",
  "## Keep exploring",
  "- [Bay Area Couples Photography Location Guide](/couples-guide)\n- [Couples Photography Pricing](/pricing/couples)",
].join("\n\n");

const linksIn = (nodes: Inline[]): number =>
  nodes.reduce((n, x) => n + (x.type === "link" ? 1 : 0) + (x.type === "text" ? 0 : linksIn(x.children)), 0);

describe("stripLinkListSections", () => {
  it("removes an appended Keep exploring list", () => {
    const out = stripLinkListSections(MODEL_BODY);
    expect(out.removed).toBe(1);
    expect(out.body).not.toContain("Keep exploring");
    expect(out.body.endsWith("see [Couples Photography Pricing](/pricing/couples).")).toBe(true);
  });

  it.each(["## Related resources", "### Useful links:", "Explore more", "## Further reading", "**Keep exploring:**"])(
    "removes a %s link list", (heading) => {
      const body = `Story.\n\n${heading}\n\n- [Guide](/couples-guide)\n- [Pricing](/pricing/couples)\n\nClosing line.`;
      expect(stripLinkListSections(body).body).toBe("Story.\n\nClosing line.");
    },
  );

  it("keeps real sections, even with links in them", () => {
    const body = "## Keep exploring\n\nThe coast keeps going south from here — see the [guide](/couples-guide).\n\n" +
      "## What to bring\n\n- [Layers](/couples-guide/what-to-wear) for the wind, it gets cold\n- Water";
    const out = stripLinkListSections(body);
    expect(out.removed).toBe(0);
    expect(out.body).toBe(body);
  });
});

describe("dedupeBodyLinks", () => {
  it("links each page once; later mentions become plain text", () => {
    const out = dedupeBodyLinks("[A](/couples-guide) then [again](/couples-guide/) and [B](/pricing/couples)");
    expect(out).toBe("[A](/couples-guide) then again and [B](/pricing/couples)");
  });
});

describe("finalizeJournalBody — what gets stored for a generated post", () => {
  it("keeps links inside paragraphs and drops the generic list", () => {
    const out = finalizeJournalBody(MODEL_BODY, ALLOWED);
    const blocks = parseBody(out.body);
    expect(out.removedSections).toBe(1);
    expect(blocks.every((b) => b.type === "paragraph")).toBe(true);
    expect(blocks.reduce((n, b) => n + (b.type === "paragraph" ? linksIn(b.children) : 0), 0)).toBe(2);
  });

  it("unwraps invented URLs", () => {
    const out = finalizeJournalBody("See the [Ocean Beach guide](/couples-guide/locations/ocean-beach).", ALLOWED);
    expect(out.body).toBe("See the Ocean Beach guide.");
    expect(out.removedLinks).toEqual(["/couples-guide/locations/ocean-beach"]);
  });
});

describe("prioritizeLinks", () => {
  it("puts the exact location guide first, then school, guides, pricing", () => {
    const links = ["/pricing/couples", "/contact", "/couples-guide", "/grads/sjsu", "/couples-guide/locations/lovers-lane"]
      .map((url) => ({ url, label: url }));
    expect(prioritizeLinks(links, "sjsu").map((l) => l.url)).toEqual([
      "/couples-guide/locations/lovers-lane", "/grads/sjsu", "/couples-guide", "/pricing/couples", "/contact",
    ]);
  });
});

describe("journal prompt", () => {
  const links = [{ url: "/couples-guide/locations/lovers-lane", label: "Lovers' Lane guide" }, { url: "/couples-guide", label: "Couples guide" }];

  it("asks for links inside paragraphs and forbids link lists", () => {
    const { userText } = buildJournalPrompt(facts, [], { links, testimonialQuote: null, locationBlock: "" });
    expect(userText).toContain("Weave 2-4 of these links into paragraphs");
    expect(userText).toContain("Link each page at most once");
    expect(userText).toMatch(/Never add a "Keep exploring", "Related resources", "Useful links"/);
    expect(userText).toContain("journal entry, not an SEO article");
    expect(userText.indexOf("/couples-guide/locations/lovers-lane")).toBeLessThan(userText.indexOf('"/couples-guide"'));
  });

  it("offers related posts only when there are some", () => {
    const without = buildJournalPrompt(facts, [], { links, testimonialQuote: null, locationBlock: "" }).userText;
    const withPosts = buildJournalPrompt(facts, [], {
      links, relatedPosts: [{ url: "/blog/golden-hour-couples-session-montalvo-arts-center", title: "Montalvo" }],
      testimonialQuote: null, locationBlock: "",
    }).userText;
    expect(without).not.toContain("Earlier journal posts");
    expect(withPosts).toContain("link at most ONE");
    expect(withPosts).toContain("/blog/golden-hour-couples-session-montalvo-arts-center");
  });

  it("internal-link suggestions are prioritized and capped at 4", () => {
    const { system } = buildInternalLinkPrompt(facts, ["/couples-guide"], "");
    expect(system).toContain("Suggest 2-4");
    expect(system).toContain("the guide for this session's exact location");
  });
});

describe("detectPostService on the real published slugs", () => {
  it.each([
    ["uc-berkeley-graduation-photos-at-doe-library-sather-gate", "grads"],
    ["kim-sather-gate-uc-berkeley-class-of-2026", "grads"],
    ["winter-light-at-cal-a-berkeley-grad-shoot-with-two-sathers-and-a-campanile-view", "grads"],
    ["golden-light-san-francisco-lovers-lane-couples-session", "couples"],
    ["golden-hour-couples-session-shark-fin-cove", "couples"],
    ["spring-family-session-at-golden-gate-park", "families"],
    ["a-walk-on-ocean-beach", null],
  ])("%s → %s", (slug, service) => {
    expect(detectPostService(slug)).toBe(service);
  });

  it("explore links follow the service", () => {
    expect(exploreLinksFor("couples", null).map((l) => l.href)).toEqual(["/couples-guide", "/pricing/couples", "/availability", "/contact"]);
    expect(exploreLinksFor("couples", { label: "x", href: "/grads/sjsu" }).map((l) => l.href)).not.toContain("/grads/sjsu");
    expect(exploreLinksFor(null, null).map((l) => l.href)).toEqual(["/portfolio", "/pricing", "/availability", "/contact"]);
  });
});

describe("related-post links must still exist at publish", () => {
  const client = (live: string[]) => ({
    from: () => ({ select: () => ({ in: async (_: string, slugs: string[]) => ({ data: slugs.filter((s) => live.includes(s)).map((slug) => ({ slug })), error: null }) }) }),
  }) as unknown as SupabaseClient;
  const body = "See [Montalvo](/blog/golden-hour-couples-session-montalvo-arts-center) and the [blog](/blog).";

  it("finds /blog/<slug> links (not the /blog index)", () => {
    expect(blogSlugsInBody(body)).toEqual(["golden-hour-couples-session-montalvo-arts-center"]);
  });

  it("reports a linked post that was taken down", async () => {
    expect(await missingBlogLinks(client([]), body)).toEqual(["/blog/golden-hour-couples-session-montalvo-arts-center"]);
    expect(await missingBlogLinks(client(["golden-hour-couples-session-montalvo-arts-center"]), body)).toEqual([]);
  });
});
