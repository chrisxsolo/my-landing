import { describe, expect, it } from "vitest";
import { KNOWN_PLACES } from "@/lib/locations/places";
import { assembleLibrary, type LoadedLibrary } from "@/lib/photoTagging/assemble";
import { buildReviewQueue, EMPTY_QUEUE_FILTER, filterQueue, safeKeys, sortByNewest } from "@/lib/photoTagging/reviewQueue";
import type { PhotoReview } from "@/lib/photoTagging/reviews";
import type { TagSuggestion } from "@/lib/photoTagging/types";

const BASE = "https://x.supabase.co/storage/v1/object/public/grad-photos/";
const engineId = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;

function portfolioRow(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id, title: `Photo ${id}`, alt: "Graduation portrait", image_url: `${BASE}p${id}.jpg`, category_slug: "graduation",
    featured: false, sort_order: id, width: 4000, height: 6000, content_hash: null, school: null, location: null,
    session_label: null, published: true, ...overrides,
  };
}

function engineRow(n: number, session: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    id: engineId(n), storage_path: `s/${n}.jpg`, public_derivative_url: null, content_hash: `h${n}`, excluded: false,
    title: null, alt_text: null, description: null, tags: [], quality_score: 8, width: 1, height: 1,
    gps_latitude: null, gps_longitude: null, photo_location: null, photo_location_source: null,
    photography_sessions: {
      id: `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`, public_display_name: `Session ${n}`,
      service_type: "couples", school_slug: null, primary_location: null, secondary_locations: [],
      marketing_permission: true, marketing_permission_revoked_at: null, ...session,
    },
    ...overrides,
  };
}

const library = (overrides: Partial<LoadedLibrary>): LoadedLibrary => ({
  portfolio: [], engine: [], spotTags: [], reviews: new Map(), places: KNOWN_PLACES, dbGuides: [],
  customSchools: new Map(), ...overrides,
});
const queueOf = (lib: LoadedLibrary) => buildReviewQueue(assembleLibrary(lib).map((e) => e.photo));

describe("review queue", () => {
  it("orders grads without a university, then contested locations, then other gaps, then spots", () => {
    const queue = queueOf(library({
      portfolio: [
        portfolioRow(1, { school: "uc-berkeley", location: "Doe Library" }), // spot to confirm
        portfolioRow(2, { category_slug: "couples" }), // missing location
        portfolioRow(3), // grad, no university
      ],
      engine: [engineRow(4, { primary_location: "Palace of Fine Arts", secondary_locations: ["Legion of Honor"] })],
    }));
    expect(queue.map((i) => i.kind)).toEqual(["school", "location-conflict", "categorization", "categorization", "spot"]);
    expect(queue[0]).toMatchObject({ key: "portfolio:3", field: "school" });
    const contested = queue.find((i) => i.kind === "location-conflict")!;
    expect(contested.options.map((o) => o.value).sort()).toEqual(["Legion of Honor", "Palace of Fine Arts"]);
    expect(contested.safe).toBe(false);
  });

  it("never asks again about a verified field", () => {
    const queue = queueOf(library({ portfolio: [portfolioRow(5, { category_slug: "couples", location: "Crissy Field" })] }));
    expect(queue).toEqual([]);
  });

  it("marks only one-answer, high, photo-scoped items safe for bulk approval", () => {
    const queue = queueOf(library({ engine: [
      engineRow(6, { primary_location: "Crissy Field" }),
      engineRow(7, { service_type: "grads", primary_location: "Stanford University" }),
    ] }));
    const location = queue.find((i) => i.key === `engine:${engineId(6)}`)!;
    expect(location).toMatchObject({ before: null, safe: true });
    expect(location.options[0]).toMatchObject({ value: "Crissy Field", confidence: "high" });
    const school = queue.find((i) => i.key === `engine:${engineId(7)}` && i.field === "school")!;
    expect(school.safe).toBe(false); // a university on an engine photo sets the whole session
    expect(safeKeys(queue)).toContain(`engine:${engineId(6)}`);
  });

  it("describes each item: what is about, saved vs suggested, evidence, why and what to do", () => {
    const [item] = queueOf(library({ engine: [engineRow(8, { primary_location: "Crissy Field" })] }));
    expect(item).toMatchObject({
      kind: "categorization", field: "location", sessionId: `11111111-1111-4111-8111-${String(8).padStart(12, "0")}`,
      sessionName: "Session 8", before: null, evidence: "session facts · high", url: null,
    });
    expect(item.explanation).toMatch(/No location is saved/);
    expect(item.recommended).toBe("Accept Crissy Field.");
  });

  it("files a vision-only location as a low-confidence AI suggestion that is never safe", () => {
    const key = `engine:${engineId(9)}`;
    const vision: TagSuggestion = {
      id: "location:Ocean Beach", field: "location", value: "Ocean Beach", label: "Ocean Beach", confidence: "medium",
      origin: "vision", reason: "the image shows a wide sandy beach", appliesTo: "photo",
    };
    const review: PhotoReview = { key, notApplicable: [], dismissed: [], ai: [vision], aiInputHash: "h", aiAnalyzedAt: "2026-10-27T00:00:00Z" };
    const queue = queueOf(library({ engine: [engineRow(9, {})], reviews: new Map([[key, review]]) }));
    const item = queue.find((i) => i.key === key && i.field === "location")!;
    expect(item).toMatchObject({ kind: "vision", safe: false, evidence: "AI vision · needs approval" });
    expect(item.explanation).toMatch(/Looks alone never confirm a place/);
    expect(safeKeys(queue)).not.toContain(key);
  });

  it("filters by issue type, session and school, and sorts dated items newest first", () => {
    const queue = queueOf(library({
      portfolio: [portfolioRow(10, { school: "usf" }), portfolioRow(11)],
      engine: [engineRow(12, { primary_location: "Crissy Field" })],
    }));
    expect(filterQueue(queue, { ...EMPTY_QUEUE_FILTER, kind: "school" }).map((i) => i.key)).toEqual(["portfolio:11"]);
    expect(filterQueue(queue, { ...EMPTY_QUEUE_FILTER, school: "usf" }).every((i) => i.key === "portfolio:10")).toBe(true);
    expect(filterQueue(queue, { ...EMPTY_QUEUE_FILTER, sessionId: `11111111-1111-4111-8111-${String(12).padStart(12, "0")}` }).map((i) => i.key))
      .toEqual([`engine:${engineId(12)}`]);
    const dated = [{ ...queue[0], id: "a", createdAt: "2026-01-01T00:00:00Z" }, { ...queue[0], id: "b", createdAt: "2026-06-01T00:00:00Z" }, queue[1]];
    expect(sortByNewest(dated).map((i) => i.id)).toEqual(["b", "a", queue[1].id]);
  });
});
