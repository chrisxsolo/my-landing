// Session-location inheritance (owner rules): a session whose facts name
// exactly one location gives it to every included photo that has none, as
// session evidence; manual, GPS and accepted-vision locations are never
// touched; a multi-location session assigns nothing; when the facts change,
// only session-inherited values follow; the plan is idempotent.
import { describe, expect, it } from "vitest";
import { KNOWN_PLACES } from "@/lib/locations/places";
import { assembleLibrary, type LoadedLibrary } from "@/lib/photoTagging/assemble";
import {
  explicitSingleLocation, isInheritedLocation, planLocationInheritance, type InheritablePhotoRow,
} from "@/lib/photoTagging/inheritLocation";
import { buildReviewQueue } from "@/lib/photoTagging/reviewQueue";
import type { TagWrite } from "@/lib/photoTagging/plan";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const engineId = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;
const PALACE = { primary_location: "Palace of Fine Arts", secondary_locations: [] as string[] };

function row(n: number, over: Partial<InheritablePhotoRow> = {}): InheritablePhotoRow {
  return { id: engineId(n), excluded: false, photo_location: null, photo_location_source: null, photo_location_evidence: null, ...over };
}
const inherited = (n: number, location = "Palace of Fine Arts") =>
  row(n, { photo_location: location, photo_location_source: "manual", photo_location_evidence: "session" });
const manual = (n: number, location: string) =>
  row(n, { photo_location: location, photo_location_source: "manual", photo_location_evidence: "manual" });
const gps = (n: number, location: string) =>
  row(n, { photo_location: location, photo_location_source: "gps", photo_location_evidence: "gps" });
const legacyManual = (n: number, location: string) =>
  row(n, { photo_location: location, photo_location_source: "manual", photo_location_evidence: null });

const plan = (facts: { primary_location: string | null; secondary_locations: string[] }, rows: InheritablePhotoRow[]) =>
  planLocationInheritance(SESSION_ID, facts, rows, KNOWN_PLACES);
const photoWrites = (writes: TagWrite[]) => writes.map((w) => (w.kind === "photo" ? { id: w.enginePhotoId, ...w.patch } : w));

describe("explicitSingleLocation", () => {
  it("is the trimmed primary location when nothing else is entered", () => {
    expect(explicitSingleLocation({ primary_location: "  UC Law SF  ", secondary_locations: [] }, KNOWN_PLACES)).toBe("UC Law SF");
    expect(explicitSingleLocation({ primary_location: "UC Law SF", secondary_locations: ["", "  "] }, KNOWN_PLACES)).toBe("UC Law SF");
    expect(explicitSingleLocation({ primary_location: "UC Law SF", secondary_locations: null }, KNOWN_PLACES)).toBe("UC Law SF");
  });

  it("canonicalizes a recognized alias through the deterministic matcher", () => {
    expect(explicitSingleLocation({ primary_location: "palace of fine arts, SF", secondary_locations: [] }, KNOWN_PLACES)).toBe("Palace of Fine Arts");
  });

  it("is null for no location or for several entered locations", () => {
    expect(explicitSingleLocation({ primary_location: "", secondary_locations: [] }, KNOWN_PLACES)).toBeNull();
    expect(explicitSingleLocation({ primary_location: null, secondary_locations: [] }, KNOWN_PLACES)).toBeNull();
    expect(explicitSingleLocation({ primary_location: "Palace of Fine Arts", secondary_locations: ["Legion of Honor"] }, KNOWN_PLACES)).toBeNull();
  });
});

describe("one explicit session location fills blank photos", () => {
  it("writes the session location as session evidence, exactly like accepting the suggestion", () => {
    const p = plan(PALACE, [row(1), row(2)]);
    expect(photoWrites(p.writes)).toEqual([
      { id: engineId(1), location: "Palace of Fine Arts", source: "manual", evidence: "session" },
      { id: engineId(2), location: "Palace of Fine Arts", source: "manual", evidence: "session" },
    ]);
    expect(p.outcomes.every((o) => o.field === "location" && o.result === "updated" && o.previous === null)).toBe(true);
  });

  it("never overwrites a manual, GPS or legacy manual location, nor one accepted from vision", () => {
    const vision = row(4, { photo_location: "Baker Beach", photo_location_source: "manual", photo_location_evidence: "vision" });
    const p = plan(PALACE, [manual(1, "Crissy Field"), gps(2, "Crissy Field"), legacyManual(3, "Crissy Field"), vision]);
    expect(p.writes).toEqual([]);
    expect(p.outcomes).toEqual([]); // not even planned: they are the photo's own facts
  });

  it("assigns nothing when the session names several locations", () => {
    const p = plan({ primary_location: "Palace of Fine Arts", secondary_locations: ["Legion of Honor"] }, [row(1), row(2)]);
    expect(p.writes).toEqual([]);
  });

  it("leaves excluded photos alone", () => {
    const p = plan(PALACE, [row(1, { excluded: true }), row(2)]);
    expect(photoWrites(p.writes)).toEqual([{ id: engineId(2), location: "Palace of Fine Arts", source: "manual", evidence: "session" }]);
  });

  it("is idempotent: a second run finds nothing to write", () => {
    expect(plan(PALACE, [inherited(1), inherited(2)]).writes).toEqual([]);
    expect(plan(PALACE, [inherited(1, "palace of fine arts")]).writes).toEqual([]);
  });
});

describe("when the facts change, only session-inherited values follow", () => {
  it("moves inherited values to the new single location and leaves manual / GPS ones", () => {
    const p = plan({ primary_location: "Crissy Field", secondary_locations: [] }, [inherited(1), manual(2, "Palace of Fine Arts"), gps(3, "Palace of Fine Arts"), row(4)]);
    expect(photoWrites(p.writes)).toEqual([
      { id: engineId(4), location: "Crissy Field", source: "manual", evidence: "session" },
      { id: engineId(1), location: "Crissy Field", source: "manual", evidence: "session" },
    ]);
    expect(p.outcomes.find((o) => o.key === `engine:${engineId(1)}`)).toMatchObject({ result: "updated", previous: "Palace of Fine Arts" });
    expect(p.outcomes.map((o) => o.key)).toEqual([`engine:${engineId(4)}`, `engine:${engineId(1)}`]);
  });

  it("clears only inherited values when a secondary location is added", () => {
    const p = plan({ primary_location: "Palace of Fine Arts", secondary_locations: ["Legion of Honor"] }, [inherited(1), manual(2, "Palace of Fine Arts"), gps(3, "Crissy Field"), row(4)]);
    expect(photoWrites(p.writes)).toEqual([{ id: engineId(1), location: null, source: "manual", evidence: null }]);
  });

  it("clears only inherited values when the session location is removed", () => {
    const p = plan({ primary_location: "", secondary_locations: [] }, [inherited(1), manual(2, "Palace of Fine Arts"), row(3)]);
    expect(photoWrites(p.writes)).toEqual([{ id: engineId(1), location: null, source: "manual", evidence: null }]);
    expect(plan({ primary_location: "", secondary_locations: [] }, [manual(2, "Palace of Fine Arts"), row(3)]).writes).toEqual([]);
  });

  it("recognizes an inherited value by its evidence, never by its source", () => {
    expect(isInheritedLocation(inherited(1))).toBe(true);
    expect(isInheritedLocation(manual(1, "x"))).toBe(false);
    expect(isInheritedLocation(legacyManual(1, "x"))).toBe(false);
    expect(isInheritedLocation(row(1, { photo_location_evidence: "session" }))).toBe(false);
  });
});

describe("the audit after inheritance", () => {
  const library = (engine: Record<string, unknown>[]): LoadedLibrary => ({
    portfolio: [], engine, spotTags: [], reviews: new Map(), places: KNOWN_PLACES, dbGuides: [], customSchools: new Map(),
  });
  const engineRow = (n: number, over: Record<string, unknown>) => ({
    id: engineId(n), storage_path: `s/${n}.jpg`, public_derivative_url: null, content_hash: `h${n}`, excluded: false,
    title: null, alt_text: null, description: null, tags: [], quality_score: 8, width: 1, height: 1,
    gps_latitude: null, gps_longitude: null,
    photography_sessions: {
      id: SESSION_ID, public_display_name: "UC Law", service_type: "grads", school_slug: "uc-law-sf",
      primary_location: "Palace of Fine Arts", secondary_locations: [], marketing_permission: true, marketing_permission_revoked_at: null,
    },
    ...over,
  });

  it("shows Palace of Fine Arts as the photo's location with session evidence and no missing-location card", () => {
    const [entry] = assembleLibrary(library([engineRow(1, {
      photo_location: "Palace of Fine Arts", photo_location_source: "manual", photo_location_evidence: "session",
    })]));
    expect(entry.photo.checks.find((c) => c.field === "location")).toMatchObject({ state: "ok", value: "Palace of Fine Arts", evidence: "session" });
    expect(buildReviewQueue([entry.photo]).filter((i) => i.field === "location")).toEqual([]);
    expect(entry.target.storedLocationEvidence).toBe("session");
  });
});
