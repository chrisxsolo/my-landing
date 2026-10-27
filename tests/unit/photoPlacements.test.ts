// The inspector lists every place one photo appears, one row per placement,
// and edits exactly one of them at a time. buildPlacements is pure; the loader
// reads every placement table in one batch; refused edits never touch a row.
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Loaded } from "@/lib/pagePhotos/adminView";
import { applyPlacementEdit, PlacementActionError } from "@/lib/photoSync/placementActions";
import { loadPlacementFacts } from "@/lib/photoSync/placementLoad";
import {
  buildPlacements, countLivePages, journalEditorHref, type Placement, type PlacementFacts,
} from "@/lib/photoSync/placements";

const URL1 = "https://x.supabase.co/storage/v1/object/public/d/1.jpg";
const URL2 = "https://x.supabase.co/storage/v1/object/public/d/2.jpg";
const ENGINE_ID = "22222222-2222-4222-8222-000000000001";
const SESSION_ID = "33333333-3333-4333-8333-000000000001";

function facts(over: Partial<PlacementFacts> = {}): PlacementFacts {
  return {
    url: URL1, blockedReason: null, portfolio: [], pages: [], campusSpots: [], guides: [], journal: [],
    siteSlots: [], featuredSessions: [], locations: [], caseStudies: [], ...over,
  };
}

const byId = (list: Placement[]) => Object.fromEntries(list.map((p) => [p.id, p]));

describe("buildPlacements", () => {
  it("lists one row per placement type with its public page, editor, origin and edits", () => {
    const rows = byId(buildPlacements(facts({
      portfolio: [{ id: 188, published: true, category: "grads", heroCarousel: true }],
      pages: [
        { key: "grads/sjsu", label: "Grads · SJSU", shown: true, pinned: true, explicitId: null },
        { key: "couples/crissy-field", label: "Couples guide · Crissy Field", shown: true, pinned: false, explicitId: null },
      ],
      campusSpots: [
        { spotId: 7, schoolSlug: "sjsu", spotKey: "tower-hall-lawn", spotName: "Tower Hall Lawn", origin: "manual" },
        { spotId: null, schoolSlug: "sjsu", spotKey: "sjsu-sign", spotName: "SJSU Sign", origin: "auto" },
      ],
      guides: [{ guide: "couples", rowId: "c1", slug: "crissy-field", name: "Crissy Field", published: true, featured: true }],
      journal: [
        { postId: 21, slug: "spring-at-sjsu", title: "Spring at SJSU", role: "cover", published: true, engineSessionId: SESSION_ID },
        { postId: 21, slug: "spring-at-sjsu", title: "Spring at SJSU", role: "gallery", published: true, engineSessionId: SESSION_ID },
      ],
      siteSlots: ["home_hero_primary", "pricing_grad_standard_image"],
      featuredSessions: [{ key: "home_featured_grad_post", postSlug: "spring-at-sjsu" }],
      locations: [{ id: 8, title: "Lovers' Lane", active: true }],
      caseStudies: [{ id: 3, title: "Maya at SJSU", field: "cover", active: true }, { id: 3, title: "Maya at SJSU", field: "preview", active: true }],
    })));

    expect(rows["portfolio:188"]).toMatchObject({ type: "portfolio", publicPath: "/portfolio?category=grads", editorHref: "/admin?tab=portfolio", origin: "manual", canRemove: true, canReplace: true });
    expect(rows["hero-carousel:188"]).toMatchObject({ type: "hero-carousel", publicPath: "/", target: { kind: "hero-carousel", portfolioId: 188 } });
    expect(rows["page:grads/sjsu"]).toMatchObject({ publicPath: "/grads/sjsu", origin: "manual", detail: "pinned by you", canReplace: true });
    expect(rows["page:couples/crissy-field"]).toMatchObject({ origin: "automatic", detail: "matched automatically", canReplace: false });
    expect(rows["campus-spot:sjsu:tower-hall-lawn:manual"]).toMatchObject({ origin: "manual", canReplace: true, target: { kind: "campus-spot", spotId: 7 } });
    expect(rows["campus-spot:sjsu:sjsu-sign:auto"]).toMatchObject({ origin: "automatic", canReplace: false, target: { kind: "campus-spot-auto", schoolSlug: "sjsu", spotKey: "sjsu-sign" } });
    expect(rows["guide:couples:c1"]).toMatchObject({ detail: "hero image", publicPath: "/couples-guide/locations/crissy-field", editorHref: "/admin?tab=couplesLocations" });
    expect(rows["journal:21:cover"]).toMatchObject({ publicPath: "/blog/spring-at-sjsu", editorHref: `/admin/content-engine/${SESSION_ID}`, canRemove: false, canReplace: true });
    expect(rows["journal:21:gallery"]).toMatchObject({ canRemove: true, canReplace: false });
    expect(rows["site-slot:home_hero_primary"]).toMatchObject({ publicPath: "/", editorHref: "/admin?tab=home" });
    expect(rows["site-slot:pricing_grad_standard_image"]).toMatchObject({ publicPath: "/pricing" });
    expect(rows["featured-session:home_featured_grad_post"]).toMatchObject({ canRemove: false, canReplace: false });
    expect(rows["bay-area-location:8"]).toMatchObject({ publicPath: "/bay-area-locations", editorHref: "/admin/content-engine/locations" });
    expect(rows["case-study:3:cover"]).toMatchObject({ canRemove: false, canReplace: true });
    expect(rows["case-study:3:preview"]).toMatchObject({ canRemove: true });
    expect(Object.values(rows).every((p) => p.state === "active" && p.stateReason === null)).toBe(true);
  });

  it("marks every placement outdated when the photo is excluded or its session lost permission", () => {
    const rows = buildPlacements(facts({
      blockedReason: "session is not cleared for marketing",
      portfolio: [{ id: 1, published: true, category: "couples", heroCarousel: false }],
      guides: [{ guide: "family", rowId: "f1", slug: "crissy-field", name: "Crissy Field", published: true, featured: false }],
    }));
    expect(rows).toHaveLength(2);
    expect(rows.every((p) => p.state === "outdated" && p.stateReason === "session is not cleared for marketing")).toBe(true);
  });

  it("keeps an unpublished portfolio row and an unshown page placement, but says so", () => {
    const rows = byId(buildPlacements(facts({
      portfolio: [{ id: 2, published: false, category: "couples", heroCarousel: true }],
      pages: [{ key: "grads/sjsu", label: "Grads · SJSU", shown: false, pinned: false, explicitId: "s1" }],
    })));
    expect(rows["portfolio:2"]).toMatchObject({ published: false, canRemove: false, publicPath: "/portfolio/couples", editorHref: "/admin?tab=couplesPortfolio" });
    expect(rows["hero-carousel:2"]).toMatchObject({ state: "outdated", stateReason: "the portfolio photo is unpublished" });
    expect(rows["page:grads/sjsu"]).toMatchObject({ origin: "manual", detail: "Content Engine school placement", state: "outdated", target: { explicitId: "s1" } });
  });

  it("links an older post to Blog and an engine-published one to its session workspace", () => {
    expect(journalEditorHref(null)).toBe("/admin?tab=blog");
    expect(journalEditorHref(SESSION_ID)).toBe(`/admin/content-engine/${SESSION_ID}`);
  });
});

describe("countLivePages", () => {
  it("counts distinct public pages that show the photo now, skipping unpublished and outdated rows", () => {
    const live = buildPlacements(facts({
      portfolio: [{ id: 1, published: true, category: "grads", heroCarousel: true }],
      pages: [{ key: "grads/sjsu", label: "Grads · SJSU", shown: true, pinned: false, explicitId: null }],
      siteSlots: ["home_hero_primary"],
      journal: [{ postId: 2, slug: "draft", title: "Draft", role: "cover", published: false, engineSessionId: null }],
    }));
    // /portfolio?category=grads, /grads/sjsu and "/" (hero carousel + site slot share it); the draft post counts for nothing.
    expect(countLivePages(live)).toBe(3);
    expect(countLivePages(buildPlacements(facts({ blockedReason: "excluded", portfolio: [{ id: 1, published: true, category: "grads", heroCarousel: false }] })))).toBe(0);
  });
});

/** A PostgREST stand-in: each table answers with its fixed rows, whatever the filter. */
function fakeClient(tables: Record<string, Record<string, unknown>[]>): SupabaseClient {
  const query = (rows: Record<string, unknown>[]) => {
    const q: Record<string, unknown> = { then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }) };
    for (const m of ["select", "in", "eq", "overlaps", "not", "order"]) q[m] = () => q;
    return q;
  };
  return { from: (table: string) => query(tables[table] ?? []) } as unknown as SupabaseClient;
}

const emptyLoaded: Loaded = {
  pool: { photos: [], explicitSchool: [], sessionSchool: [], journal: [], curation: [], spotTags: [], errors: [] },
  pages: [], guideRows: new Map(),
};

describe("loadPlacementFacts", () => {
  it("reads every placement table once for the whole batch and keys the facts by URL", async () => {
    const client = fakeClient({
      session_photos: [{ id: ENGINE_ID, public_derivative_url: URL1, excluded: false, photography_sessions: { marketing_permission: true, marketing_permission_revoked_at: null } }],
      portfolio_images: [{ id: 188, image_url: URL1, published: true, category_slug: "grads", hero_carousel: false }],
      location_spots: [{ id: 7, school_id: "sjsu", name: "Tower Hall Lawn", spot_key: "tower-hall-lawn", image_url: URL1 }],
      couples_location_photos: [{ id: "c1", location_slug: "crissy-field", image_url: URL2, published: true, featured: false }],
      blog_posts: [{
        id: 21, slug: "spring-at-sjsu", title: "Spring at SJSU", published_at: "2024-05-01T00:00:00Z",
        cover_image_url: URL1, cover_image_alt: "Maya", extra_image_urls: [URL1, URL2], extra_image_alts: ["a", "b"], og_image_url: null,
      }],
      site_settings: [{ key: "home_hero_primary", value: URL2 }, { key: "home_featured_grad_post", value: "spring-at-sjsu" }],
      bay_area_locations: [{ id: 8, title: "Lovers' Lane", active: true, featured_photo_id: ENGINE_ID }],
      portfolio_case_studies: [{ id: 3, title: "Maya", active: true, cover_image_url: URL2, preview_image_urls: [URL1] }],
      campus_spot_auto_photos: [{ school_slug: "sjsu", spot_key: "sjsu-sign", image_url: URL2, evidence: "text" }],
    });
    const map = await loadPlacementFacts(client, emptyLoaded, [URL1, URL2, URL1]);
    const one = map.get(URL1)!;
    expect(one.portfolio).toEqual([{ id: 188, published: true, category: "grads", heroCarousel: false }]);
    expect(one.campusSpots).toEqual([{ spotId: 7, schoolSlug: "sjsu", spotKey: "tower-hall-lawn", spotName: "Tower Hall Lawn", origin: "manual" }]);
    // Cover and gallery are two roles of one post; the social image falls back to the cover and is not a third.
    expect(one.journal.map((j) => j.role)).toEqual(["cover", "gallery"]);
    expect(one.journal[0]).toMatchObject({ postId: 21, slug: "spring-at-sjsu", published: true, engineSessionId: null });
    expect(one.featuredSessions).toEqual([{ key: "home_featured_grad_post", postSlug: "spring-at-sjsu" }]);
    expect(one.locations).toEqual([{ id: 8, title: "Lovers' Lane", active: true }]);
    expect(one.caseStudies).toEqual([{ id: 3, title: "Maya", field: "preview", active: true }]);
    expect(one.blockedReason).toBeNull();

    const two = map.get(URL2)!;
    expect(two.guides).toEqual([{ guide: "couples", rowId: "c1", slug: "crissy-field", name: "crissy-field", published: true, featured: false }]);
    expect(two.siteSlots).toEqual(["home_hero_primary"]);
    expect(two.campusSpots).toEqual([{ spotId: null, schoolSlug: "sjsu", spotKey: "sjsu-sign", spotName: "SJSU Sign", origin: "auto" }]);
    expect(two.caseStudies).toEqual([{ id: 3, title: "Maya", field: "cover", active: true }]);
    expect(two.journal.map((j) => j.role)).toEqual(["gallery"]);
    expect(two.locations).toEqual([]);
  });

  it("reports why a photo is blocked: the pool's verdict first, else the Content Engine's", async () => {
    const client = fakeClient({
      session_photos: [{ id: ENGINE_ID, public_derivative_url: URL2, excluded: true, photography_sessions: { marketing_permission: true, marketing_permission_revoked_at: null } }],
    });
    const loaded: Loaded = {
      ...emptyLoaded,
      pool: { ...emptyLoaded.pool, photos: [{ url: URL1, eligible: false, ineligibleReason: "session is not cleared for marketing" } as never] },
    };
    const map = await loadPlacementFacts(client, loaded, [URL1, URL2]);
    expect(map.get(URL1)?.blockedReason).toBe("session is not cleared for marketing");
    expect(map.get(URL2)?.blockedReason).toBe("excluded in the Content Engine");
  });

  it("asks nothing of the database for an empty batch", async () => {
    const client = { from: () => { throw new Error("should not query"); } } as unknown as SupabaseClient;
    expect(await loadPlacementFacts(client, emptyLoaded, [])).toEqual(new Map());
  });
});

describe("applyPlacementEdit refusals", () => {
  const untouched = { from: () => { throw new Error("no row may change"); } } as unknown as SupabaseClient;

  it("refuses to replace a photo with itself", async () => {
    await expect(applyPlacementEdit(untouched, {
      action: "replace", target: { kind: "portfolio", portfolioId: 1 }, url: URL1, newUrl: URL1, newAlt: null,
    })).rejects.toBeInstanceOf(PlacementActionError);
  });

  it("refuses to replace a tagged or automatic campus-spot photo (the tag or the sync chooses those)", async () => {
    await expect(applyPlacementEdit(untouched, {
      action: "replace", target: { kind: "campus-spot-auto", schoolSlug: "sjsu", spotKey: "sjsu-sign" }, url: URL1, newUrl: URL2, newAlt: null,
    })).rejects.toThrow(/Campus Spots/);
  });

  it("refuses to swap a journal gallery photo here (only the cover has a replace endpoint)", async () => {
    await expect(applyPlacementEdit(untouched, {
      action: "replace", target: { kind: "journal", postId: 21, role: "gallery" }, url: URL1, newUrl: URL2, newAlt: null,
    })).rejects.toThrow(/only the cover can be replaced here/);
  });

  it("refuses an unknown site photo slot before touching settings", async () => {
    await expect(applyPlacementEdit(untouched, {
      action: "remove", target: { kind: "site-slot", key: "stripe_secret" as never }, url: URL1,
    })).rejects.toMatchObject({ status: 400 });
  });
});
