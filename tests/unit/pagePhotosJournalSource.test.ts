// Older journal posts (before the Content Engine) are the only public home of
// most SJSU and UC Berkeley graduation photos. Their images must reach the
// school page the post names — once, and never when another source or the
// photographer's exclusion already speaks for that photo.
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { legacyJournalPhotos, toJournalPostRow, type JournalPostRow } from "@/lib/pagePhotos/journalSource";
import { candidatesForPage } from "@/lib/pagePhotos/candidates";
import { loadPhotoPool } from "@/lib/pagePhotos/pool";

const url = (name: string) => `https://x.supabase.co/storage/v1/object/public/grad-photos/blog/${name}.jpg`;
const NOW = Date.parse("2026-10-27T12:00:00Z");

function post(over: Partial<JournalPostRow> & { id: number; title: string }): JournalPostRow {
  const slug = over.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    slug, category: "professional", sites: ["professional"], publishedAt: "2026-01-10T00:00:00Z",
    coverUrl: url(`${over.id}-cover`), coverAlt: null, extraUrls: [url(`${over.id}-a`), url(`${over.id}-b`)], extraAlts: [],
    ...over,
  };
}

const none = { engineUrls: new Set<string>(), portfolioUrls: new Set<string>(), portfolioHashes: new Set<string>() };

describe("legacyJournalPhotos", () => {
  it("offers an SJSU post's images to /grads/sjsu, cover first, as one shoot dated by the post", () => {
    const photos = legacyJournalPhotos([post({ id: 11, title: "Spartan Proud — A Grad Shoot Across SJSU Campus" })], none, NOW);
    expect(photos.map((p) => p.url)).toEqual([url("11-cover"), url("11-a"), url("11-b")]);
    expect(photos[0]).toMatchObject({
      id: "journal:11:0", role: "cover", school: "sjsu", pages: ["grads/sjsu"], sessionKey: "post:11",
      publishedAt: "2026-01-10T00:00:00Z", postSlug: "spartan-proud-a-grad-shoot-across-sjsu-campus", serviceType: "grads",
    });
    expect(photos[1].role).toBe("gallery");
  });

  it("reads Berkeley from the post's own words, the way every other source does", () => {
    const winter = legacyJournalPhotos([post({ id: 13, title: "Winter Light at Cal — A Berkeley Grad Shoot with Two Sathers and a Campanile View" })], none, NOW);
    const doe = legacyJournalPhotos([post({ id: 1, title: "UC Berkeley Graduation Photos at Doe Library & Sather Gate" })], none, NOW);
    expect(winter[0].pages).toEqual(["grads/uc-berkeley"]);
    expect(doe[0].pages).toEqual(["grads/uc-berkeley"]);
  });

  it("places nothing for a grads post naming a school with no page, and says why", () => {
    const [photo] = legacyJournalPhotos([post({ id: 12, title: "Golden Hour at the Palace of Fine Arts — Alyssa's SMU Nursing Grad Session" })], none, NOW);
    expect(photo.serviceType).toBe("grads");
    expect(photo.school).toBeNull();
    expect(photo.pages).toEqual([]);
    expect(photo.schoolNote).toMatch(/no school/);
  });

  it("never sends a couples post to a school page, even one shot on a campus", () => {
    const [photo] = legacyJournalPhotos([post({ id: 19, title: "Golden Hour Couples Session at Stanford" })], none, NOW);
    expect(photo.serviceType).toBe("couples");
    expect(photo.pages).toEqual([]);
  });

  it("skips images that a Content Engine photo (excluded or not) or a Portfolio row already owns", () => {
    const photos = legacyJournalPhotos([post({ id: 3, title: "San Jose State University Graduation Photos with Maya" })], {
      engineUrls: new Set([url("3-a")]), portfolioUrls: new Set([url("3-b")]), portfolioHashes: new Set(),
    }, NOW);
    expect(photos.map((p) => p.url)).toEqual([url("3-cover")]);
  });

  it("skips posts that are not live: unpublished, scheduled, or deleted", () => {
    const photos = legacyJournalPhotos([
      post({ id: 7, title: "Blue and Gold at SJSU — A Sigma Omicron Pi Grad Shoot", publishedAt: null }),
      post({ id: 8, title: "Jenn's SJSU Graduation Session", publishedAt: "2027-01-01T00:00:00Z" }),
    ], none, NOW);
    expect(photos).toEqual([]);
  });

  it("lists a URL shared by two posts once, under the newer post", () => {
    const shared = url("shared");
    const photos = legacyJournalPhotos([
      post({ id: 11, title: "Spartan Proud — A Grad Shoot Across SJSU Campus", publishedAt: "2026-01-01T00:00:00Z", extraUrls: [shared], coverUrl: null }),
      post({ id: 25, title: "SJSU Golden Hour Graduation Portrait on Campus", publishedAt: "2026-03-01T00:00:00Z", extraUrls: [shared], coverUrl: null }),
    ], none, NOW);
    expect(photos).toHaveLength(1);
    expect(photos[0].postId).toBe(25);
  });
});

describe("toJournalPostRow", () => {
  it("reads the blog_posts columns and drops rows without an id or slug", () => {
    expect(toJournalPostRow({ id: 3, slug: "maya", title: "Maya", sites: ["professional"], published_at: "2026-01-01", extra_image_urls: [url("a")] }))
      .toMatchObject({ id: 3, slug: "maya", publishedAt: "2026-01-01", extraUrls: [url("a")], coverUrl: null, category: null });
    expect(toJournalPostRow({ id: 3 })).toBeNull();
  });
});

// ── Through the pool ─────────────────────────────────────────────────────────

interface Query { table: string }

function fakeClient(rowsFor: (table: string) => unknown[]): SupabaseClient {
  const builder = (q: Query): unknown => new Proxy({}, {
    get(_target, prop) {
      if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ data: rowsFor(q.table), error: null });
      return () => builder(q);
    },
  });
  return { from: (table: string) => builder({ table }) } as unknown as SupabaseClient;
}

const session = { id: "trang", public_display_name: "UC Berkeley", session_date: "2026-05-23", service_type: "grads",
  school_slug: "uc-berkeley", primary_location: null, secondary_locations: [], marketing_permission: true, marketing_permission_revoked_at: null };

// Paged tables answer once, then an empty page.
function pagedOnce(rows: Record<string, unknown[]>) {
  const served = new Set<string>();
  return (table: string) => {
    if (!(table in rows)) return [];
    if (table === "portfolio_images" || table === "session_photos") {
      if (served.has(table)) return [];
      served.add(table);
    }
    return rows[table];
  };
}

const rows = () => pagedOnce({
  portfolio_images: [{ id: 101, title: "UC Berkeley Graduation Photos at Doe Library & Sather Gate cover", alt: null, image_url: url("1-cover"),
    category_slug: "grads", featured: false, sort_order: 1, width: 4, height: 6, content_hash: null, school: null, location: null, session_label: null }],
  session_photos: [{ id: "e1", alt_text: null, public_derivative_url: url("engine"), content_hash: null, excluded: true, quality_score: 9,
    width: 4, height: 6, gps_latitude: null, gps_longitude: null, photo_location: null, photo_location_source: null, photography_sessions: session }],
  blog_posts: [
    { id: 1, slug: "uc-berkeley-graduation-photos-at-doe-library-sather-gate", title: "UC Berkeley Graduation Photos at Doe Library & Sather Gate",
      category: "professional", sites: ["professional"], published_at: "2026-01-01T00:00:00Z", cover_image_url: url("1-cover"),
      cover_image_alt: "Doe Library", extra_image_urls: [url("1-a"), url("engine")], extra_image_alts: ["Sather Gate"] },
    { id: 11, slug: "spartan-proud-a-grad-shoot-across-sjsu-campus", title: "Spartan Proud — A Grad Shoot Across SJSU Campus",
      category: "professional", sites: ["professional"], published_at: "2026-02-01T00:00:00Z", cover_image_url: url("11-cover"),
      cover_image_alt: null, extra_image_urls: [url("11-a")], extra_image_alts: [] },
  ],
});

describe("loadPhotoPool — legacy journal source", () => {
  it("adds journal images no other source knows, dated by the post, and leaves owned URLs to their source", async () => {
    const pool = await loadPhotoPool(fakeClient(rows()));
    expect(pool.errors).toEqual([]);
    expect(pool.journal.map((j) => j.url)).toEqual([url("11-cover"), url("11-a"), url("1-a")]);
    const sjsu = candidatesForPage(pool, "grads/sjsu");
    expect(sjsu.map((c) => c.id)).toEqual(["journal:11:0", "journal:11:1"]);
    expect(sjsu[0]).toMatchObject({ explicit: false, sessionKey: "post:11", sessionDate: "2026-02-01T00:00:00Z" });
    const berkeley = candidatesForPage(pool, "grads/uc-berkeley");
    expect(berkeley.map((c) => c.id)).toEqual(["portfolio:101", "journal:1:1"]);
    expect(berkeley[1].alt).toBe("Sather Gate");
  });

  it("carries the Content Engine session's date onto its photos", async () => {
    const pool = await loadPhotoPool(fakeClient(pagedOnce({
      portfolio_images: [{ id: 223, title: "Trang at Doe Library", alt: null, image_url: url("engine"), category_slug: "graduation", featured: false,
        sort_order: 1, width: 4, height: 6, content_hash: null, school: null, location: null, session_label: "UC Berkeley · May 2026" }],
      session_photos: [{ id: "e1", alt_text: null, public_derivative_url: url("engine"), content_hash: null, excluded: false, quality_score: 9,
        width: 4, height: 6, gps_latitude: null, gps_longitude: null, photo_location: null, photo_location_source: null, photography_sessions: session }],
    })));
    expect(pool.photos[0]).toMatchObject({ sessionKey: "session:trang", sessionDate: "2026-05-23" });
  });

  it("resolves the same rows to the same pool twice (idempotent)", async () => {
    const [a, b] = await Promise.all([loadPhotoPool(fakeClient(rows())), loadPhotoPool(fakeClient(rows()))]);
    expect(a).toEqual(b);
    expect(candidatesForPage(a, "grads/sjsu")).toEqual(candidatesForPage(b, "grads/sjsu"));
  });
});
