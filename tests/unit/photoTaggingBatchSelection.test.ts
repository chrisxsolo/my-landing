// Multi-select batch editing in the review queue: which cards can be selected,
// how a selection becomes unique photo keys, when several cards share one
// approvable answer (and when they must not), that the request it builds
// carries only the selected photos and never overwrites, and that a selection
// follows the queue (pruned when cards leave, cleared when they all do).
import { describe, expect, it } from "vitest";
import { KNOWN_PLACES } from "@/lib/locations/places";
import { assembleLibrary, type LoadedLibrary } from "@/lib/photoTagging/assemble";
import {
  isBatchEditable, pruneSelection, selectedItems, selectionSummary, sharedSuggestion, suggestionChanges, uniqueKeys,
} from "@/lib/photoTagging/batchSelection";
import { buildReviewQueue, type QueueItem } from "@/lib/photoTagging/reviewQueue";
import type { TagSuggestion } from "@/lib/photoTagging/types";
import { excludedLiveItems, proposedPlaceItems } from "@/lib/reviewQueue/findingItems";

const engineId = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;
const sessionId = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;

function engineRow(n: number, session: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    id: engineId(n), storage_path: `s/${n}.jpg`, public_derivative_url: null, content_hash: `h${n}`, excluded: false,
    title: null, alt_text: null, description: null, tags: [], quality_score: 8, width: 1, height: 1,
    gps_latitude: null, gps_longitude: null, photo_location: null, photo_location_source: null,
    photography_sessions: {
      id: sessionId(n), public_display_name: `Session ${n}`, service_type: "couples", school_slug: null,
      primary_location: null, secondary_locations: [], marketing_permission: true, marketing_permission_revoked_at: null, ...session,
    },
    ...overrides,
  };
}

const library = (overrides: Partial<LoadedLibrary>): LoadedLibrary => ({
  portfolio: [], engine: [], spotTags: [], reviews: new Map(), places: KNOWN_PLACES, dbGuides: [],
  customSchools: new Map(), ...overrides,
});
const queueOf = (lib: LoadedLibrary) => buildReviewQueue(assembleLibrary(lib).map((e) => e.photo));

/** Four Chantal photos in one Stanford graduation session, each missing its university. */
const CHANTAL = { public_display_name: "Chantal", service_type: "grads", primary_location: "Stanford University" };
const chantal = (ids: number[], shared = sessionId(1)) =>
  library({ engine: ids.map((n) => engineRow(n, { ...CHANTAL, id: shared })) });

function suggestion(over: Partial<TagSuggestion>): TagSuggestion {
  return { id: "school:stanford", field: "school", value: "stanford", label: "Stanford University", confidence: "high",
    origin: "session", reason: "the session is at Stanford", appliesTo: "session", ...over };
}

function card(id: string, over: Partial<QueueItem> = {}): QueueItem {
  return {
    id, key: `portfolio:${id}`, kind: "school", field: "school", title: id, url: null, sessionId: null, sessionName: null,
    school: null, location: null, before: null, options: [suggestion({})], evidence: null, explanation: "", recommended: "",
    href: null, actions: [], createdAt: null, safe: false, ...over,
  };
}

describe("which review-queue cards can be batch-edited", () => {
  it("every Portfolio or Content Engine photo card can be selected", () => {
    const queue = queueOf(chantal([1, 2]));
    const school = queue.filter((i) => i.field === "school");
    expect(school).toHaveLength(2);
    expect(school.every(isBatchEditable)).toBe(true);
  });

  it("proposed places, session findings and excluded-but-live placement cards cannot", () => {
    const [place] = proposedPlaceItems([{ id: 7, title: "Shark Fin Cove", slug: "shark-fin-cove", city: "Davenport", region: "Santa Cruz",
      origin: "engine", hasDescription: true, sessionCount: 1, createdAt: "2026-10-27T00:00:00Z", heroUrl: null }]);
    expect(isBatchEditable(place)).toBe(false);
    expect(isBatchEditable({ key: `session:${sessionId(1)}`, kind: "grad-no-school" })).toBe(false);
    const [live] = excludedLiveItems([{ photoId: engineId(3), sessionId: sessionId(3), sessionName: "Kim", schoolSlug: null, url: "https://x/p.jpg",
      placements: [{ photoId: engineId(3), kind: "portfolio", ref: "9", where: "USF grad guide hero", href: "/admin", removal: null }], dismissed: [], excludedAt: null }]);
    expect(live.kind).toBe("excluded-live");
    expect(isBatchEditable(live)).toBe(false);
    expect(selectedItems([place, live], new Set([place.id, live.id]))).toEqual([]);
  });
});

describe("a selection becomes unique photo keys", () => {
  it("deduplicates several cards about the same photo", () => {
    const items = [card("a", { key: "portfolio:1", id: "portfolio:1:school" }), card("b", { key: "portfolio:1", id: "portfolio:1:location", field: "location" }),
      card("c", { key: "portfolio:2", id: "portfolio:2:school" })];
    expect(uniqueKeys(items)).toEqual(["portfolio:1", "portfolio:2"]);
    expect(selectionSummary(items)).toBe("3 cards selected · 2 photos");
    expect(selectionSummary(items.slice(2))).toBe("1 photo selected");
    expect(selectionSummary(items.filter((i) => i.field === "school"))).toBe("2 photos selected");
  });
});

describe("one shared answer for the whole selection", () => {
  it("four Chantal cards suggesting Stanford produce one quick action over four photos", () => {
    const queue = queueOf(chantal([1, 2, 3, 4]));
    const cards = selectedItems(queue, new Set(queue.filter((i) => i.field === "school").map((i) => i.id)));
    expect(cards).toHaveLength(4);
    expect(cards.every((i) => i.options.length === 1 && i.options[0].label === "Stanford")).toBe(true);
    const shared = sharedSuggestion(cards);
    expect(shared.ok).toBe(true);
    if (!shared.ok) return;
    expect(shared.label).toBe("Review Stanford for 4 photos");
    expect(shared.keys).toEqual([1, 2, 3, 4].map((n) => `engine:${engineId(n)}`));
    expect(shared.changes).toEqual({ school: "stanford" });
    expect(shared.suggestion.appliesTo).toBe("session");
  });

  it("builds the same change a single card's Approve builds, evidence included", () => {
    const gps = suggestion({ id: "location:Crissy Field", field: "location", value: "Crissy Field", label: "Crissy Field", origin: "gps", appliesTo: "photo" });
    expect(suggestionChanges(gps)).toEqual({ location: "Crissy Field", evidence: "gps" });
    expect(suggestionChanges(suggestion({}))).toEqual({ school: "stanford" });
    const shared = sharedSuggestion([card("a", { field: "location", options: [gps] }), card("b", { field: "location", options: [gps] })]);
    expect(shared).toMatchObject({ ok: true, changes: { location: "Crissy Field", evidence: "gps" }, label: "Review Crissy Field for 2 photos" });
  });

  it("refuses cards with no suggestion, several answers, or a disputed one", () => {
    expect(sharedSuggestion([])).toMatchObject({ ok: false, reason: /Select at least one/ });
    expect(sharedSuggestion([card("a"), card("b", { options: [] })])).toMatchObject({ ok: false, reason: /1 selected card has no suggestion/ });
    const two = [suggestion({}), suggestion({ id: "school:usf", value: "usf", label: "USF" })];
    expect(sharedSuggestion([card("a"), card("b", { options: two })])).toMatchObject({ ok: false, reason: /offers several answers/ });
    expect(sharedSuggestion([card("a", { options: [suggestion({ competing: true })] })])).toMatchObject({ ok: false, reason: /Records disagree/ });
  });

  it("refuses different fields, different values, and locations resting on different evidence", () => {
    const location = suggestion({ id: "location:Crissy Field", field: "location", value: "Crissy Field", label: "Crissy Field", origin: "session", appliesTo: "photo" });
    expect(sharedSuggestion([card("a"), card("b", { field: "location", options: [location] })]))
      .toMatchObject({ ok: false, reason: /different fields \(university, location\)/ });
    expect(sharedSuggestion([card("a"), card("b", { options: [suggestion({ id: "school:usf", value: "usf", label: "USF" })] })]))
      .toMatchObject({ ok: false, reason: /different values \(Stanford University vs USF\)/ });
    const gps = { ...location, origin: "gps" as const };
    expect(sharedSuggestion([card("a", { field: "location", options: [location] }), card("b", { field: "location", options: [gps] })]))
      .toMatchObject({ ok: false, reason: /different evidence \(session vs gps\)/ });
  });

  it("the request it feeds carries only the selected photos and never overwrites", () => {
    const queue = queueOf(chantal([1, 2, 3, 4]));
    const twoOfFour = selectedItems(queue, new Set(queue.filter((i) => i.field === "school").slice(0, 2).map((i) => i.id)));
    const shared = sharedSuggestion(twoOfFour);
    expect(shared.ok).toBe(true);
    if (!shared.ok) return;
    const request = { kind: "changes" as const, keys: shared.keys, changes: shared.changes, replace: false };
    expect(request.keys).toEqual([`engine:${engineId(1)}`, `engine:${engineId(2)}`]);
    expect(request.keys).not.toContain(`engine:${engineId(3)}`);
    expect(request.replace).toBe(false);
  });
});

describe("the selection follows the queue", () => {
  it("drops cards that left the queue and returns the same set when nothing changed", () => {
    const queue = queueOf(chantal([1, 2, 3]));
    const ids = queue.filter((i) => i.field === "school").map((i) => i.id);
    const selected = new Set(ids);
    expect(pruneSelection(selected, queue)).toBe(selected);
    const after = queueOf(chantal([2, 3])); // photo 1 was approved and left
    const pruned = pruneSelection(selected, after);
    expect([...pruned]).toEqual(ids.slice(1));
    expect(pruneSelection(selected, [])).toEqual(new Set());
  });

  it("drops cards hidden by a filter (the selection is scoped to what is shown)", () => {
    const queue = queueOf(chantal([1, 2]));
    const [school] = queue.filter((i) => i.field === "school");
    const shownWithoutIt = queue.filter((i) => i.id !== school.id);
    expect(pruneSelection(new Set([school.id]), shownWithoutIt).has(school.id)).toBe(false);
  });
});
