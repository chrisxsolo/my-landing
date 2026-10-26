// Homepage curation: one graduation + one couples session, admin pins, and a
// testimonial mix that covers the services the homepage advertises.
import { describe, expect, it } from "vitest";
import { buildFeaturedSessions } from "@/lib/homepageData";
import { pickBalancedTestimonials, type FeaturedTestimonial } from "@/lib/testimonialsData";
import type { BlogPostSummary } from "@/lib/professionalData";

function post(slug: string, title: string, category: string): BlogPostSummary & { cat: string } {
  return {
    id: slug.length,
    slug,
    title,
    published_at: "2026-10-01T00:00:00Z",
    cover_image_url: `${slug}.jpg`,
    cover_image_alt: title,
    meta_description: null,
    cat: category,
  } as unknown as BlogPostSummary & { cat: string };
}

// Newest first, like getBlogPostSummaries.
const POSTS = [
  post("grad-newest", "Trang's Doctoral Graduation", "graduation"),
  post("grad-older", "Kim at Sather Gate", "graduation"),
  post("couples-newest", "Golden Hour at Shark Fin Cove", "couples"),
  post("family-one", "Family Morning at Baker Beach", "family"),
];
const categorize = (p: BlogPostSummary) => [(p as BlogPostSummary & { cat: string }).cat];

describe("buildFeaturedSessions", () => {
  it("features the newest graduation and the newest couples session, in that order", () => {
    const sessions = buildFeaturedSessions(POSTS, [], 2, { categorize });
    expect(sessions.map((s) => s.href)).toEqual(["/blog/grad-newest", "/blog/couples-newest"]);
    expect(sessions.map((s) => s.location)).toEqual(["Graduation session", "Couples session"]);
  });

  it("does not let two recent graduation posts crowd out couples", () => {
    const sessions = buildFeaturedSessions(POSTS, [], 2, { categorize });
    expect(sessions.some((s) => s.href === "/blog/grad-older")).toBe(false);
  });

  it("honors admin pins and ignores a pin that is not published", () => {
    const pinned = buildFeaturedSessions(POSTS, [], 2, { categorize, pinnedSlugs: { grads: "grad-older" } });
    expect(pinned[0].href).toBe("/blog/grad-older");
    const stale = buildFeaturedSessions(POSTS, [], 2, { categorize, pinnedSlugs: { couples: "deleted-post" } });
    expect(stale[1].href).toBe("/blog/couples-newest");
  });

  it("fills a service with no published session from the newest other posts", () => {
    const noCouples = POSTS.filter((p) => p.slug !== "couples-newest");
    const sessions = buildFeaturedSessions(noCouples, [], 2, { categorize });
    expect(sessions.map((s) => s.href)).toEqual(["/blog/grad-newest", "/blog/grad-older"]);
  });
});

function testimonial(id: string, sessionType: string | null): FeaturedTestimonial {
  return { id, session_type: sessionType, message: "m", display_name: id } as unknown as FeaturedTestimonial;
}

describe("pickBalancedTestimonials", () => {
  it("leads with one per advertised service, then the admin's order", () => {
    const list = [
      testimonial("grad-1", "SJSU Graduation Session"),
      testimonial("portrait", "Portrait Session"),
      testimonial("grad-2", "SJSU Graduation Session"),
      testimonial("family", "Family Session"),
      testimonial("couple", "Engagement Session"),
    ];
    expect(pickBalancedTestimonials(list, 3).map((t) => t.id)).toEqual(["grad-1", "couple", "family"]);
  });

  it("falls back gracefully when a service has no testimonial yet", () => {
    const list = [testimonial("grad-1", "Graduation"), testimonial("portrait", "Portrait Session"), testimonial("family", "Family Session")];
    expect(pickBalancedTestimonials(list, 3).map((t) => t.id)).toEqual(["grad-1", "family", "portrait"]);
  });
});
