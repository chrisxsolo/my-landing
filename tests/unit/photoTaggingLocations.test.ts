// Multi-location sessions: a photo's location is a fact about THAT photo.
// Regression tests for the bug where tagging one Content Engine photo wrote
// the session's primary_location (relocating every photo of the session) and
// every photo inherited the session's primary location as its own.
import { describe, expect, it } from "vitest";
import { KNOWN_PLACES } from "@/lib/locations/places";
import { assembleLibrary, type LoadedLibrary } from "@/lib/photoTagging/assemble";
import { planTagChanges, type PlanTarget } from "@/lib/photoTagging/plan";
import type { AuditedPhoto } from "@/lib/photoTagging/types";

const BASE = "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const place = (key: string) => KNOWN_PLACES.find((p) => p.key === key)!;
const LEGION = place("legion-of-honor");
const MULTI = { primary_location: "Palace of Fine Arts", secondary_locations: ["Legion of Honor", "Crissy Field"] };

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID, public_display_name: "Ana & Leo", service_type: "couples",
    school_slug: null, primary_location: null, secondary_locations: [],
    marketing_permission: true, marketing_permission_revoked_at: null, ...overrides,
  };
}

const engineId = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;

function engineRow(n: number, overrides: Record<string, unknown> = {}, sessionOverrides: Record<string, unknown> = {}) {
  return {
    id: engineId(n), storage_path: `s/${n}.jpg`, public_derivative_url: null, content_hash: `hash-${n}`,
    excluded: false, title: null, alt_text: null, description: null, tags: [], quality_score: 8,
    width: 4000, height: 6000, gps_latitude: null, gps_longitude: null,
    photo_location: null, photo_location_source: null, photography_sessions: session(sessionOverrides), ...overrides,
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
const locationSuggestions = (p: AuditedPhoto) => p.suggestions.filter((s) => s.field === "location");

describe("a location edit on a Content Engine photo", () => {
  const target = (n: number, overrides: Partial<PlanTarget> = {}): PlanTarget => ({
    key: `engine:${engineId(n)}`, source: "engine", portfolioId: null, enginePhotoId: engineId(n),
    sessionId: SESSION_ID, url: null, category: "couples", school: null, location: null, spot: null, ...overrides,
  });

  it("writes that photo's own location, never the session's primary location", () => {
    const plan = planTagChanges([target(1)], { location: "Legion of Honor" }, false);
    expect(plan.writes).toEqual([{
      kind: "photo", enginePhotoId: engineId(1), sessionId: SESSION_ID,
      patch: { location: "Legion of Honor", source: "manual", evidence: "manual" },
    }]);
    expect(plan.writes.some((w) => w.kind === "session")).toBe(false);
    expect(plan.outcomes).toEqual([expect.objectContaining({ key: `engine:${engineId(1)}`, field: "location", result: "updated", scope: "photo" })]);
  });

  it("gives each selected photo its own write", () => {
    const plan = planTagChanges([target(1), target(2)], { location: "Crissy Field" }, false);
    expect(plan.writes.map((w) => w.kind)).toEqual(["photo", "photo"]);
  });

  it("keeps a confirmed photo location unless Replace is on", () => {
    const plan = planTagChanges([target(1, { location: "Palace of Fine Arts" })], { location: "Crissy Field" }, false);
    expect(plan.writes).toEqual([]);
    expect(plan.outcomes[0].result).toBe("kept");
  });

  it("still sets the university on the session, and says so", () => {
    const plan = planTagChanges([target(1, { category: "grads" })], { school: "usf" }, false);
    expect(plan.writes).toEqual([{ kind: "session", sessionId: SESSION_ID, patch: { school_slug: "usf" } }]);
    expect(plan.outcomes[0]).toMatchObject({ field: "school", result: "updated", scope: "session" });
  });
});

describe("effective location of a Content Engine photo", () => {
  it("does not inherit a multi-location session's primary location as its own", () => {
    const photos = audit(library({ engine: [engineRow(1, {}, MULTI)] }));
    expect(check(photos[0], "location").state).toBe("missing");
    const offered = locationSuggestions(photos[0]);
    expect(offered.map((s) => s.value).sort()).toEqual(["Crissy Field", "Legion of Honor", "Palace of Fine Arts"]);
    expect(offered.every((s) => s.confidence === "medium" && s.competing === true && s.appliesTo === "photo")).toBe(true);
  });

  it("offers a single-location session as a high suggestion, not a confirmed fact", () => {
    const [photo] = audit(library({ engine: [engineRow(1, {}, { primary_location: "palace of fine arts" })] }));
    expect(check(photo, "location").state).toBe("missing");
    expect(locationSuggestions(photo)).toEqual([expect.objectContaining({
      value: "Palace of Fine Arts", confidence: "high", origin: "session", appliesTo: "photo",
    })]);
    expect(locationSuggestions(photo)[0].competing).toBeFalsy();
  });

  it("lets GPS inside one of the session's places settle it (high, the others ruled out)", () => {
    const [photo] = audit(library({ engine: [
      engineRow(1, { gps_latitude: LEGION.latitude, gps_longitude: LEGION.longitude }, MULTI),
    ] }));
    expect(locationSuggestions(photo)).toEqual([expect.objectContaining({ value: "Legion of Honor", confidence: "high", origin: "gps" })]);
  });

  it("shows GPS and the session as competing when they disagree", () => {
    const [photo] = audit(library({ engine: [
      engineRow(1, { gps_latitude: LEGION.latitude, gps_longitude: LEGION.longitude }, { primary_location: "Palace of Fine Arts" }),
    ] }));
    const offered = locationSuggestions(photo);
    expect(offered.map((s) => s.value).sort()).toEqual(["Legion of Honor", "Palace of Fine Arts"]);
    expect(offered.every((s) => s.confidence === "medium" && s.competing)).toBe(true);
  });

  it("uses the photo's own confirmed location and asks nothing more", () => {
    const photos = audit(library({ engine: [
      engineRow(1, { photo_location: "Legion of Honor", photo_location_source: "manual" }, MULTI),
      engineRow(2, {}, MULTI),
    ] }));
    expect(check(photos[0], "location")).toMatchObject({ state: "ok", value: "Legion of Honor", source: "photo tag" });
    expect(locationSuggestions(photos[0])).toEqual([]);
    // Tagging one photo never moves its session-mates.
    expect(check(photos[1], "location").state).toBe("missing");
  });

  it("labels a GPS-confirmed photo location as GPS", () => {
    const [photo] = audit(library({ engine: [engineRow(1, { photo_location: "Crissy Field", photo_location_source: "gps" }, MULTI)] }));
    expect(check(photo, "location")).toMatchObject({ state: "ok", source: "GPS" });
  });

  it("suggests the campus spot from the photo's own location over the session's", () => {
    const sjsu = { service_type: "grads", school_slug: "sjsu", primary_location: "SJSU Sign" };
    const url = `${BASE}e1.jpg`;
    const [photo] = audit(library({ engine: [
      engineRow(1, { public_derivative_url: url, photo_location: "Tower Hall Lawn", photo_location_source: "manual" }, sjsu),
    ] }));
    const spots = photo.suggestions.filter((s) => s.field === "spot");
    expect(spots).toEqual([expect.objectContaining({ value: "tower-hall-lawn", confidence: "high" })]);
  });
});

describe("linked portfolio photos", () => {
  it("take the engine photo's own location, not the session's", () => {
    const url = `${BASE}d1.jpg`;
    const portfolio = [{ id: 5, title: "Couple", alt: "Couple", image_url: url, category_slug: "couples", featured: false,
      sort_order: 1, width: 4000, height: 6000, content_hash: null, school: null, location: null, session_label: null, published: true }];
    const [tagged] = audit(library({ portfolio, engine: [
      engineRow(1, { public_derivative_url: url, photo_location: "Crissy Field", photo_location_source: "manual" }, MULTI),
    ] }));
    expect(check(tagged, "location")).toMatchObject({ state: "ok", value: "Crissy Field" });
    const [untagged] = audit(library({ portfolio, engine: [engineRow(1, { public_derivative_url: url }, MULTI)] }));
    expect(check(untagged, "location").state).toBe("missing");
  });
});
