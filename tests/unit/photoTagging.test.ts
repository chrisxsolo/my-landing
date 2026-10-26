import { describe, expect, it } from "vitest";
import { KNOWN_PLACES } from "@/lib/locations/places";
import { assembleLibrary, type LoadedLibrary } from "@/lib/photoTagging/assemble";
import { countTags, matchesFilterState, matchesTagFilter } from "@/lib/photoTagging/filters";
import { planTagChanges, type PlanTarget } from "@/lib/photoTagging/plan";
import { type PhotoReview } from "@/lib/photoTagging/reviews";
import { resolvePhoto } from "@/lib/pagePhotos/resolve";
import { toPortfolioSource } from "@/lib/pagePhotos/pool";
import { buildVisionPrompt, parseVisionReply } from "@/lib/photoTagging/visionPrompt";
import { canonicalCategory, isPhotoKey, type AuditedPhoto, type TagSuggestion } from "@/lib/photoTagging/types";

const BASE = "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/";

function portfolioRow(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id, title: "Graduation portrait", alt: "Graduation portrait", image_url: `${BASE}p${id}.jpg`,
    category_slug: "graduation", featured: false, sort_order: id, width: 4000, height: 6000,
    content_hash: null, school: null, location: null, session_label: null, published: true, ...overrides,
  };
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111", public_display_name: "Kim", service_type: "grads",
    school_slug: "usf", primary_location: null, secondary_locations: [],
    marketing_permission: true, marketing_permission_revoked_at: null, ...overrides,
  };
}

function engineRow(n: number, overrides: Record<string, unknown> = {}, sessionOverrides: Record<string, unknown> = {}) {
  return {
    id: `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`, storage_path: `s/${n}.jpg`,
    public_derivative_url: null, content_hash: `hash-${n}`, excluded: false,
    title: null, alt_text: null, description: null, tags: [], quality_score: 8, width: 4000, height: 6000,
    gps_latitude: null, gps_longitude: null, photography_sessions: session(sessionOverrides), ...overrides,
  };
}

function library(overrides: Partial<LoadedLibrary> = {}): LoadedLibrary {
  return {
    portfolio: [], engine: [], spotTags: [], reviews: new Map(), places: KNOWN_PLACES, dbGuides: [],
    customSchools: new Map(), ...overrides,
  };
}

const audit = (lib: LoadedLibrary): AuditedPhoto[] => assembleLibrary(lib).map((e) => e.photo);
const check = (p: AuditedPhoto, field: string) => p.checks.find((c) => c.field === field)!;

describe("graduation photos", () => {
  it("flags a grad photo with no university as Needs Tagging", () => {
    const [photo] = audit(library({ portfolio: [portfolioRow(1)] }));
    expect(photo.status).toBe("needs");
    expect(check(photo, "school").state).toBe("missing");
    expect(matchesTagFilter(photo, "grads-missing-school")).toBe(true);
  });

  it("is Fully Tagged with university, location and spot (Photo A)", () => {
    const row = portfolioRow(2, { school: "usf", location: "Gleeson Library" });
    const [photo] = audit(library({
      portfolio: [row],
      spotTags: [{ schoolSlug: "usf", imageUrl: row.image_url, spotKey: "gleeson-library" }],
    }));
    expect(photo.status).toBe("full");
    expect(photo.checks.every((c) => c.state !== "missing")).toBe(true);
    expect(photo.pages).toContain("grads/usf");
  });

  it("is Partially Tagged when the location names spots that are not tagged (Photo C)", () => {
    const [photo] = audit(library({ portfolio: [portfolioRow(3, { school: "uc-berkeley", location: "Doe Library" })] }));
    expect(photo.status).toBe("partial");
    expect(check(photo, "spot").state).toBe("missing");
    const spots = photo.suggestions.filter((s) => s.field === "spot").map((s) => s.value).sort();
    expect(spots).toEqual(["doe-library-entrance", "doe-library-ledge"]);
    expect(photo.suggestions.every((s) => s.confidence === "medium")).toBe(true);
  });

  it("flags a missing campus location as partial, not needs", () => {
    const [photo] = audit(library({ portfolio: [portfolioRow(4, { school: "sjsu" })] }));
    expect(photo.status).toBe("partial");
    expect(matchesTagFilter(photo, "grads-missing-location")).toBe(true);
  });

  it("does not require a spot when nothing names one, or the school has no spot guide", () => {
    const [plain, stanford] = audit(library({ portfolio: [
      portfolioRow(5, { school: "uc-berkeley", location: "Berkeley Rose Garden" }),
      portfolioRow(6, { school: "stanford", location: "Main Quad" }),
    ] }));
    expect(check(plain, "spot").state).toBe("na");
    expect(plain.status).toBe("full");
    expect(check(stanford, "spot")).toMatchObject({ state: "na", note: "this school has no campus-spot guide" });
  });

  it("honours a not-applicable mark for location", () => {
    const reviews = new Map<string, PhotoReview>([["portfolio:7", {
      key: "portfolio:7", notApplicable: ["location"], dismissed: [], ai: [], aiInputHash: null, aiAnalyzedAt: null,
    }]]);
    const [photo] = audit(library({ portfolio: [portfolioRow(7, { school: "sjsu" })], reviews }));
    expect(check(photo, "location").state).toBe("na");
    expect(photo.status).toBe("full");
  });
});

describe("other categories", () => {
  it("never asks a couples photo for a university", () => {
    const [photo] = audit(library({ portfolio: [portfolioRow(8, { category_slug: "couples", location: "Palace of Fine Arts" })] }));
    expect(check(photo, "school").state).toBe("na");
    expect(check(photo, "spot").state).toBe("na");
    expect(photo.status).toBe("full");
    expect(photo.pages).toContain("couples/palace-of-fine-arts");
  });

  it("marks a couples photo without a location partial", () => {
    const [photo] = audit(library({ portfolio: [portfolioRow(9, { category_slug: "couples", title: "Couple laughing", alt: "Couple laughing" })] }));
    expect(photo.status).toBe("partial");
  });

  it("keeps portraits as portraits in the audit vocabulary", () => {
    expect(canonicalCategory("portraits")).toBe("portraits");
    expect(canonicalCategory("graduation")).toBe("grads");
    expect(canonicalCategory("family")).toBe("families");
  });
});

describe("Content Engine photos", () => {
  it("inherits the session's university and location", () => {
    const [photo] = audit(library({ engine: [engineRow(1, {}, { primary_location: "Gleeson Library" })] }));
    expect(photo.source).toBe("engine");
    expect(check(photo, "school")).toMatchObject({ state: "ok", value: "USF", source: "session" });
    expect(check(photo, "location").state).toBe("ok");
  });

  it("flags every photo of a grads session with no school, and suggests one from its location", () => {
    const photos = audit(library({ engine: [
      engineRow(2, {}, { school_slug: null, primary_location: "Stanford University" }),
    ] }));
    expect(photos[0].status).toBe("needs");
    expect(photos[0].suggestions[0]).toMatchObject({ field: "school", value: "stanford", confidence: "high", appliesTo: "session" });
  });

  it("does not list a photo twice when it is also a portfolio row", () => {
    const row = portfolioRow(10, { content_hash: "hash-3" });
    const photos = audit(library({ portfolio: [row], engine: [engineRow(3), engineRow(4, { excluded: true })] }));
    expect(photos).toHaveLength(1);
    expect(photos[0].source).toBe("portfolio");
  });

  it("suggests a place from GPS inside a known place (high) but never from scenery", () => {
    const palace = KNOWN_PLACES.find((p) => p.key === "palace-of-fine-arts")!;
    const [gps, scenery] = audit(library({ engine: [
      engineRow(5, { gps_latitude: palace.latitude, gps_longitude: palace.longitude }, { service_type: "couples", school_slug: null }),
      engineRow(6, { description: "a sandy beach with sea cliffs and a rock fin", tags: ["beach", "coast"] },
        { id: "33333333-3333-4333-8333-333333333333", service_type: "couples", school_slug: null }),
    ] }));
    expect(gps.suggestions[0]).toMatchObject({ field: "location", value: "Palace of Fine Arts", confidence: "high", origin: "gps" });
    expect(scenery.suggestions).toEqual([]);
  });

  it("drops dismissed suggestions", () => {
    const reviews = new Map<string, PhotoReview>([["engine:22222222-2222-4222-8222-000000000007", {
      key: "engine:22222222-2222-4222-8222-000000000007", notApplicable: [], dismissed: ["school:stanford"],
      ai: [], aiInputHash: null, aiAnalyzedAt: null,
    }]]);
    const [photo] = audit(library({
      engine: [engineRow(7, {}, { school_slug: null, primary_location: "Stanford University" })], reviews,
    }));
    expect(photo.suggestions).toEqual([]);
  });

  it("only offers stored vision suggestions for fields that are still missing", () => {
    const vision: TagSuggestion = {
      id: "spot:sather-gate", field: "spot", value: "sather-gate", label: "Sather Gate", confidence: "medium",
      origin: "vision", reason: "arch lettering reads SATHER GATE", appliesTo: "photo",
    };
    const row = portfolioRow(11, { school: "uc-berkeley", location: "Campus" });
    const review = (key: string): PhotoReview => ({ key, notApplicable: [], dismissed: [], ai: [vision], aiInputHash: "h", aiAnalyzedAt: "2026-10-26" });
    const [untagged] = audit(library({ portfolio: [row], reviews: new Map([["portfolio:11", review("portfolio:11")]]) }));
    expect(untagged.suggestions).toContainEqual(vision);
    const [tagged] = audit(library({
      portfolio: [row], reviews: new Map([["portfolio:11", review("portfolio:11")]]),
      spotTags: [{ schoolSlug: "uc-berkeley", imageUrl: row.image_url, spotKey: "campanile" }],
    }));
    expect(tagged.suggestions).toEqual([]);
  });
});

describe("counts and filters", () => {
  it("counts from the audited photos themselves", () => {
    const photos = audit(library({ portfolio: [
      portfolioRow(20), portfolioRow(21, { school: "sjsu" }),
      portfolioRow(22, { category_slug: "couples", location: "Crissy Field" }),
    ] }));
    expect(countTags(photos)).toMatchObject({ total: 3, needs: 1, partial: 1, full: 1, gradsMissingSchool: 1, gradsMissingLocation: 2 });
    expect(photos.filter((p) => matchesFilterState(p, { filter: "all", category: "grads", school: "none" }))).toHaveLength(1);
    expect(photos.filter((p) => matchesFilterState(p, { filter: "all", category: "", school: "sjsu" }))).toHaveLength(1);
  });
});

describe("bulk tagging plan", () => {
  const target = (overrides: Partial<PlanTarget> = {}): PlanTarget => ({
    key: "portfolio:1", source: "portfolio", portfolioId: 1, sessionId: null, url: `${BASE}p1.jpg`,
    category: "grads", school: null, location: null, spot: null, ...overrides,
  });

  it("fills empty fields and keeps existing ones unless Replace is on", () => {
    const targets = [target(), target({ key: "portfolio:2", portfolioId: 2, school: "sjsu", location: "Tower Hall" })];
    const plan = planTagChanges(targets, { school: "uc-berkeley", location: "Sather Gate" }, false);
    expect(plan.writes).toEqual([{ kind: "portfolio", portfolioId: 1, patch: { school: "uc-berkeley", location: "Sather Gate" } }]);
    expect(plan.outcomes.filter((o) => o.key === "portfolio:2").every((o) => o.result === "kept")).toBe(true);

    const replaced = planTagChanges(targets, { school: "uc-berkeley" }, true);
    expect(replaced.writes).toHaveLength(2);
  });

  it("never touches fields the edit leaves out", () => {
    const plan = planTagChanges([target({ location: "Doe Library" })], { school: "uc-berkeley" }, true);
    expect(plan.writes).toEqual([{ kind: "portfolio", portfolioId: 1, patch: { school: "uc-berkeley" } }]);
  });

  it("writes engine-only photos once per session and refuses engine category changes", () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const engine = (n: number) => target({ key: `engine:${n}`, source: "engine", portfolioId: null, sessionId, url: null });
    const plan = planTagChanges([engine(1), engine(2)], { category: "grads", school: "usf" }, false);
    expect(plan.writes).toEqual([{ kind: "session", sessionId, patch: { school_slug: "usf" } }]);
    expect(plan.outcomes.filter((o) => o.field === "category").every((o) => o.result === "skipped")).toBe(true);
  });

  it("tags spots only on public photos, with a spot of the photo's school", () => {
    const plan = planTagChanges([
      target({ school: "uc-berkeley" }),
      target({ key: "portfolio:3", portfolioId: 3, school: "uc-berkeley", url: null }),
      target({ key: "portfolio:4", portfolioId: 4, school: "sjsu" }),
    ], { spot: "sather-gate" }, false);
    expect(plan.writes).toEqual([{ kind: "spot", school: "uc-berkeley", url: `${BASE}p1.jpg`, spotKey: "sather-gate" }]);
    expect(plan.outcomes.map((o) => o.result)).toEqual(["updated", "skipped", "skipped"]);
  });

  it("uses the new school when the same edit sets school and spot", () => {
    const plan = planTagChanges([target()], { school: "uc-berkeley", spot: "campanile" }, false);
    expect(plan.writes).toContainEqual({ kind: "spot", school: "uc-berkeley", url: `${BASE}p1.jpg`, spotKey: "campanile" });
  });

  it("refuses a university on a non-graduation photo", () => {
    const plan = planTagChanges([target({ category: "couples" })], { school: "usf" }, false);
    expect(plan.writes).toEqual([]);
  });
});

describe("tagging makes photos eligible for the existing sync", () => {
  it("a school tag puts a portfolio photo on that school's page", () => {
    const before = resolvePhoto(toPortfolioSource(portfolioRow(30))!, null, { places: KNOWN_PLACES, dbGuides: [] });
    const after = resolvePhoto(toPortfolioSource(portfolioRow(30, { school: "usf" }))!, null, { places: KNOWN_PLACES, dbGuides: [] });
    expect(before.pages).toEqual([]);
    expect(after.pages).toContain("grads/usf");
  });

  it("an unpublished portfolio photo is never eligible for a page or a spot tag", () => {
    const [photo] = audit(library({ portfolio: [portfolioRow(31, { school: "usf", published: false })] }));
    expect(photo.pages).toEqual([]);
    expect(photo.spotTaggable).toBe(false);
  });

  it("photo keys are validated", () => {
    expect(isPhotoKey("portfolio:12")).toBe(true);
    expect(isPhotoKey("engine:22222222-2222-4222-8222-000000000007")).toBe(true);
    expect(isPhotoKey("portfolio:1;drop")).toBe(false);
  });
});

describe("AI vision replies", () => {
  const req = { category: "grads", school: "uc-berkeley", missing: ["spot", "location"] as ("spot" | "location")[] };

  it("keeps on-list answers with evidence, capped at medium", () => {
    const out = parseVisionReply({
      spot: { value: "uc-berkeley/sather-gate", confidence: "high", evidence: "arch lettering reads SATHER GATE" },
    }, req, KNOWN_PLACES);
    expect(out).toEqual([expect.objectContaining({ field: "spot", value: "sather-gate", confidence: "medium", origin: "vision" })]);
  });

  it("drops invented, off-school, low-confidence and evidence-free answers", () => {
    const out = parseVisionReply({
      spot: { value: "uc-berkeley/rooftop-garden", confidence: "high", evidence: "a garden" },
      place: { value: "ocean-beach", confidence: "low", evidence: "sand and waves" },
      school: { value: "usf", confidence: "high", evidence: "" },
    }, req, KNOWN_PLACES);
    expect(out).toEqual([]);
    const wrongSchool = parseVisionReply({ spot: { value: "sjsu/sjsu-sign", confidence: "high", evidence: "SJSU sign" } }, req, KNOWN_PLACES);
    expect(wrongSchool).toEqual([]);
  });

  it("only asks for the lists it needs", () => {
    const prompt = buildVisionPrompt({ category: "couples", school: null, missing: ["location"] }, KNOWN_PLACES);
    expect(prompt.text).toContain("PLACES");
    expect(prompt.text).not.toContain("SCHOOLS");
    expect(prompt.system).toMatch(/Scenery is NOT evidence/);
  });
});
