// The location evidence model (owner rules): manual > session facts > GPS >
// image analysis. An automated step assigns a place only from records; AI
// vision is a suggestion for review, never an assignment; a location the
// photographer set is never overwritten by anything automated.
import { describe, expect, it } from "vitest";
import { KNOWN_PLACES } from "@/lib/locations/places";
import { assembleLibrary, type LoadedLibrary } from "@/lib/photoTagging/assemble";
import { planHighConfidence } from "@/lib/photoTagging/highConfidence";
import { planTagChanges, type PlanTarget } from "@/lib/photoTagging/plan";
import type { PhotoReview } from "@/lib/photoTagging/reviews";
import { evidenceOf, type TagSuggestion } from "@/lib/photoTagging/types";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const engineId = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;
const SHARK_FIN = KNOWN_PLACES.find((p) => p.key === "shark-fin-cove")!;

function engineRow(n: number, overrides: Record<string, unknown> = {}) {
  return {
    id: engineId(n), storage_path: `s/${n}.jpg`, public_derivative_url: null, content_hash: `hash-${n}`,
    excluded: false, title: null, alt_text: null, description: null, tags: [], quality_score: 8,
    width: 4000, height: 6000, gps_latitude: null, gps_longitude: null,
    photo_location: null, photo_location_source: null, photo_location_evidence: null,
    photography_sessions: {
      id: SESSION_ID, public_display_name: "Ana & Leo", service_type: "couples", school_slug: null,
      primary_location: null, secondary_locations: [], marketing_permission: true, marketing_permission_revoked_at: null,
    },
    ...overrides,
  };
}

const library = (overrides: Partial<LoadedLibrary>): LoadedLibrary => ({
  portfolio: [], engine: [], spotTags: [], reviews: new Map(), places: KNOWN_PLACES, dbGuides: [],
  customSchools: new Map(), ...overrides,
});

const visionSuggestion = (value: string): TagSuggestion => ({
  id: `location:${value}`, field: "location", value, label: value, confidence: "medium", origin: "vision",
  reason: "the image looks like a cove with a sea stack", appliesTo: "photo",
});
const review = (key: string, ai: TagSuggestion[]): PhotoReview =>
  ({ key, notApplicable: [], dismissed: [], ai, aiInputHash: "h", aiAnalyzedAt: "2026-10-27T00:00:00Z" });

const target = (overrides: Partial<PlanTarget> = {}): PlanTarget => ({
  key: `engine:${engineId(1)}`, source: "engine", portfolioId: null, enginePhotoId: engineId(1),
  sessionId: SESSION_ID, url: null, category: "couples", school: null, location: null, spot: null, ...overrides,
});

describe("evidence levels", () => {
  it("maps suggestion origins to the stored evidence vocabulary", () => {
    expect(evidenceOf("gps")).toBe("gps");
    expect(["session", "siblings", "location"].map((o) => evidenceOf(o as TagSuggestion["origin"]))).toEqual(["session", "session", "session"]);
    expect(["caption", "analysis", "vision"].map((o) => evidenceOf(o as TagSuggestion["origin"]))).toEqual(["vision", "vision", "vision"]);
  });
});

describe("an automated step never overwrites a photographer-set location", () => {
  const manual = target({ location: "Shark Fin Cove", stored: { location: "Shark Fin Cove" }, storedLocationSource: "manual" });

  it("keeps the manual value even with Replace on when the plan is automated", () => {
    const plan = planTagChanges([manual], { location: "Ocean Beach" }, true, "gps", { automated: true });
    expect(plan.writes).toEqual([]);
    expect(plan.outcomes[0]).toMatchObject({ field: "location", result: "kept", reason: expect.stringMatching(/photographer/) });
  });

  it("still lets a person replace it on purpose", () => {
    const plan = planTagChanges([manual], { location: "Ocean Beach" }, true);
    expect(plan.writes).toEqual([{
      kind: "photo", enginePhotoId: engineId(1), sessionId: SESSION_ID,
      patch: { location: "Ocean Beach", source: "manual", evidence: "manual" },
    }]);
  });

  it("records the evidence a person accepted a suggestion on", () => {
    const plan = planTagChanges([target()], { location: "Shark Fin Cove", evidence: "session" }, false);
    expect(plan.writes[0]).toMatchObject({ kind: "photo", patch: { source: "manual", evidence: "session" } });
    const cleared = planTagChanges([manual], { location: null }, true);
    expect(cleared.writes[0]).toMatchObject({ kind: "photo", patch: { location: null, evidence: null } });
  });
});

describe("apply-high (the automated path)", () => {
  it("assigns a place from GPS only inside a verified place's radius, and stores gps evidence", () => {
    const entries = assembleLibrary(library({ engine: [
      engineRow(1, { gps_latitude: SHARK_FIN.latitude, gps_longitude: SHARK_FIN.longitude }),
      // ~10 km north along the coast: no verified place covers it.
      engineRow(2, { gps_latitude: SHARK_FIN.latitude! + 0.09, gps_longitude: SHARK_FIN.longitude }),
    ] }));
    const inside = entries.find((e) => e.photo.enginePhotoId === engineId(1))!;
    const outside = entries.find((e) => e.photo.enginePhotoId === engineId(2))!;
    expect(inside.photo.suggestions).toEqual([expect.objectContaining({ field: "location", value: "Shark Fin Cove", origin: "gps", confidence: "high" })]);
    expect(outside.photo.suggestions.filter((s) => s.field === "location")).toEqual([]);

    const plan = planHighConfidence(entries, { photoOnly: true });
    expect(plan.writes).toEqual([{
      kind: "photo", enginePhotoId: engineId(1), sessionId: SESSION_ID,
      patch: { location: "Shark Fin Cove", source: "gps", evidence: "gps" },
    }]);
  });

  it("never assigns a place from vision-only evidence — it stays a suggestion for review", () => {
    const key = `engine:${engineId(1)}`;
    const entries = assembleLibrary(library({
      engine: [engineRow(1)],
      reviews: new Map([[key, review(key, [visionSuggestion("Shark Fin Cove")])]]),
    }));
    const photo = entries[0].photo;
    expect(photo.suggestions).toEqual([expect.objectContaining({ origin: "vision", confidence: "medium" })]);
    expect(photo.checks.find((c) => c.field === "location")).toMatchObject({ state: "missing" });
    expect(planHighConfidence(entries).writes).toEqual([]);
  });

  it("refuses vision evidence even if it were ever marked high", () => {
    const entries = assembleLibrary(library({ engine: [engineRow(1)] }));
    const forged = { ...entries[0], photo: { ...entries[0].photo, suggestions: [{ ...visionSuggestion("Ocean Beach"), confidence: "high" as const }] } };
    expect(planHighConfidence([forged]).writes).toEqual([]);
  });

  it("writes session evidence when the session's only location fills a photo", () => {
    const entries = assembleLibrary(library({ engine: [engineRow(1, {}, )].map((r) => ({
      ...r, photography_sessions: { ...r.photography_sessions, primary_location: "Crissy Field" },
    })) }));
    const plan = planHighConfidence(entries, { photoOnly: true });
    expect(plan.writes[0]).toMatchObject({ kind: "photo", patch: { location: "Crissy Field", source: "manual", evidence: "session" } });
  });
});

describe("the audit shows what a stored location rests on", () => {
  it("reads the evidence column, falling back to the source for older rows", () => {
    const [a, b] = assembleLibrary(library({ engine: [
      engineRow(1, { photo_location: "Crissy Field", photo_location_source: "manual", photo_location_evidence: "vision" }),
      engineRow(2, { photo_location: "Crissy Field", photo_location_source: "gps" }),
    ] })).map((e) => e.photo.checks.find((c) => c.field === "location")!);
    expect(a).toMatchObject({ state: "ok", source: "photo tag", evidence: "vision" });
    expect(b).toMatchObject({ state: "ok", source: "GPS", evidence: "gps" });
  });
});
