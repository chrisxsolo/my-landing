// Assigning a university by hand from the review queue: every flagged photo
// has a working edit path (Portfolio or Content Engine, with or without a
// session), the university is a separate fact from the shooting location,
// custom schools are accepted on portfolio photos but never invented, clearing
// works, failures are reported as failures, and a school write never touches
// curation, pins, heroes or spot tags.
import { describe, expect, it } from "vitest";
import { KNOWN_PLACES } from "@/lib/locations/places";
import { CLEAR_SCHOOL, draftSchool, draftToChanges, EMPTY_DRAFT } from "@/app/admin/photoTagging/TagFields";
import { applySummary } from "@/app/admin/photoTagging/taggingApi";
import { resolvePhoto } from "@/lib/pagePhotos/resolve";
import { toPortfolioSource } from "@/lib/pagePhotos/pool";
import { executePlan, summarize } from "@/lib/photoTagging/apply";
import { assembleLibrary, type LoadedLibrary } from "@/lib/photoTagging/assemble";
import { matchesTagFilter } from "@/lib/photoTagging/filters";
import { planTagChanges, type PlanTarget } from "@/lib/photoTagging/plan";
import { buildReviewQueue, isPhotoItem } from "@/lib/photoTagging/reviewQueue";
import type { AuditedPhoto } from "@/lib/photoTagging/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The two reads a portfolio school write makes: the registry lookup and the row update. */
function schoolClient(registry: string[], row: { school: string | null }): SupabaseClient {
  const schools = registry.map((slug) => ({ slug, name: slug, short_name: null, aliases: [] }));
  return {
    from: (table: string) => ({
      select: () => ({ eq: (_c: string, slug: string) => ({
        maybeSingle: async () => ({ data: schools.find((s) => s.slug === slug) ?? null, error: null }),
      }) }),
      update: (patch: Record<string, unknown>) => ({ eq: () => ({ select: async () => {
        if (table !== "portfolio_images") return { data: [], error: null };
        Object.assign(row, patch);
        return { data: [{ id: 6 }], error: null };
      } }) }),
      insert: async () => ({ data: null, error: null }),
    }),
  } as unknown as SupabaseClient;
}

const BASE = "https://x.supabase.co/storage/v1/object/public/grad-photos/";
const S1 = "11111111-1111-4111-8111-111111111111";
const engineId = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;

function portfolioRow(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id, title: "Champagne pop graduation portrait at Palace of Fine Arts", alt: "Graduation portrait",
    image_url: `${BASE}p${id}.jpg`, category_slug: "graduation", featured: false, sort_order: id, width: 4000, height: 6000,
    content_hash: null, school: null, location: null, session_label: null, published: true, ...overrides,
  };
}

function engineRow(n: number, session: Record<string, unknown> = {}) {
  return {
    id: engineId(n), storage_path: `s/${n}.jpg`, public_derivative_url: null, content_hash: `h${n}`, excluded: false,
    title: null, alt_text: null, description: null, tags: [], quality_score: 8, width: 1, height: 1,
    gps_latitude: null, gps_longitude: null, photo_location: null, photo_location_source: null,
    photography_sessions: {
      id: S1, public_display_name: "Kim", service_type: "grads", school_slug: null, primary_location: null,
      secondary_locations: [], marketing_permission: true, marketing_permission_revoked_at: null, ...session,
    },
  };
}

const library = (overrides: Partial<LoadedLibrary>): LoadedLibrary => ({
  portfolio: [], engine: [], spotTags: [], reviews: new Map(), places: KNOWN_PLACES, dbGuides: [],
  customSchools: new Map([["touro", "Touro University"]]), ...overrides,
});
const audit = (lib: LoadedLibrary): AuditedPhoto[] => assembleLibrary(lib).map((e) => e.photo);
const check = (p: AuditedPhoto, field: string) => p.checks.find((c) => c.field === field)!;

function target(overrides: Partial<PlanTarget> = {}): PlanTarget {
  return {
    key: "portfolio:6", source: "portfolio", portfolioId: 6, enginePhotoId: null, sessionId: null, url: `${BASE}p6.jpg`,
    category: "grads", school: null, location: null, spot: null, stored: { school: null, location: null, spot: null }, ...overrides,
  };
}

describe("the review queue offers an edit path for every flagged photo", () => {
  it("flags a session-less portfolio grad photo and marks it editable in place", () => {
    const [photo] = audit(library({ portfolio: [portfolioRow(6)] }));
    expect(photo.sessionId).toBeNull();
    const [item] = buildReviewQueue([photo]);
    expect(item).toMatchObject({ kind: "school", key: "portfolio:6", options: [], before: null });
    expect(item.recommended).toMatch(/by hand/);
    expect(isPhotoItem(item)).toBe(true);
  });

  it("marks Content Engine photos editable too, and only photos (not session or place findings)", () => {
    const [photo] = audit(library({ engine: [engineRow(1)] }));
    const [item] = buildReviewQueue([photo]);
    expect(item.key).toBe(`engine:${engineId(1)}`);
    expect(isPhotoItem(item)).toBe(true);
    expect(isPhotoItem({ key: `session:${S1}` })).toBe(false);
    expect(isPhotoItem({ key: "place:12" })).toBe(false);
  });
});

describe("university and shooting location are separate facts", () => {
  it("an off-campus location never answers the university, and the university never moves the location", () => {
    const before = audit(library({ portfolio: [portfolioRow(6, { location: "Palace of Fine Arts" })] }))[0];
    expect(check(before, "school").state).toBe("missing");
    expect(before.suggestions.filter((s) => s.field === "school")).toEqual([]);
    expect(matchesTagFilter(before, "grads-missing-school")).toBe(true);

    const after = audit(library({ portfolio: [portfolioRow(6, { location: "Palace of Fine Arts", school: "usf" })] }))[0];
    expect(check(after, "school")).toMatchObject({ state: "ok", value: "USF", source: "photo tag" });
    expect(check(after, "location")).toMatchObject({ state: "ok", value: "Palace of Fine Arts" });
    expect(matchesTagFilter(after, "grads-missing-school")).toBe(false);
    expect(after.pages).toContain("grads/usf");
  });

  it("a school write touches only the photo's school column — no curation, hero, pin or spot tag", () => {
    const plan = planTagChanges([target({ location: "Palace of Fine Arts" })], { school: "usf" }, true);
    expect(plan.writes).toEqual([{ kind: "portfolio", portfolioId: 6, patch: { school: "usf" } }]);
    expect(plan.outcomes).toEqual([expect.objectContaining({ field: "school", result: "updated", previous: null, value: "usf" })]);
  });
});

describe("the university draft", () => {
  it("sends a picked school, sends null to clear, and sends nothing when left unchanged", () => {
    expect(draftToChanges({ ...EMPTY_DRAFT, school: "usf" })).toEqual({ school: "usf" });
    expect(draftToChanges({ ...EMPTY_DRAFT, school: CLEAR_SCHOOL })).toEqual({ school: null });
    expect(draftToChanges(EMPTY_DRAFT)).toEqual({});
  });

  it("offers campus spots for the drafted school, the current one, or none once cleared", () => {
    expect(draftSchool({ ...EMPTY_DRAFT, school: "sjsu" }, "usf")).toBe("sjsu");
    expect(draftSchool(EMPTY_DRAFT, "usf")).toBe("usf");
    expect(draftSchool({ ...EMPTY_DRAFT, school: CLEAR_SCHOOL }, "usf")).toBeNull();
  });

  it("clears or changes an existing university only with Replace on", () => {
    const tagged = target({ school: "usf", stored: { school: "usf", location: null, spot: null } });
    expect(planTagChanges([tagged], { school: null }, true).writes).toEqual([{ kind: "portfolio", portfolioId: 6, patch: { school: null } }]);
    expect(planTagChanges([tagged], { school: "sjsu" }, true).writes).toEqual([{ kind: "portfolio", portfolioId: 6, patch: { school: "sjsu" } }]);
    expect(planTagChanges([tagged], { school: "sjsu" }, false).writes).toEqual([]);
  });
});

describe("custom schools on portfolio photos", () => {
  it("plans a custom (page-less) school on a portfolio photo", () => {
    const plan = planTagChanges([target()], { school: "touro" }, true);
    expect(plan.writes).toEqual([{ kind: "portfolio", portfolioId: 6, patch: { school: "touro" } }]);
  });

  it("audits a custom school as answered (no page) and never falls back to the photo's text", () => {
    const row = portfolioRow(6, { school: "touro", title: "UC Berkeley grad at the Campanile" });
    const resolved = resolvePhoto(toPortfolioSource(row)!, null, { places: KNOWN_PLACES, dbGuides: [] });
    expect(resolved.school).toBeNull();
    expect(resolved.schoolNote).toMatch(/touro.*no school page/);
    const [photo] = audit(library({ portfolio: [row] }));
    expect(check(photo, "school")).toMatchObject({ state: "ok", value: "Touro University", source: "photo tag" });
    expect(photo.status).not.toBe("needs");
    expect(photo.pages).toEqual([]);
  });

  it("writes a registered custom school and refuses one the registry does not know", async () => {
    const row = { school: null as string | null };
    const client = schoolClient(["touro"], row);
    const ok = await executePlan(client, planTagChanges([target()], { school: "touro" }, true));
    expect(ok.updated).toBe(1);
    expect(row.school).toBe("touro");

    const bad = await executePlan(client, planTagChanges([target()], { school: "made-up-u" }, true));
    expect(bad).toMatchObject({ updated: 0, failed: 1 });
    expect(bad.failures[0]).toMatch(/unknown school "made-up-u"/);
    expect(row.school).toBe("touro");
  });
});

describe("a failed save is reported as a failure", () => {
  it("summarizes a failed school write as not ok, so the warning stays until it succeeds", () => {
    const plan = planTagChanges([target()], { school: "usf" }, true);
    const result = summarize(plan, new Map([["portfolio:6", "portfolio photo 6: connection reset"]]));
    expect(result).toMatchObject({ updated: 0, failed: 1 });
    const summary = applySummary(result);
    expect(summary.ok).toBe(false);
    expect(summary.text).toMatch(/1 FAILED: portfolio photo 6: connection reset/);
  });
});
