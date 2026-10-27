// Bulk tagging correctness: per-field results map to the write that carries
// them, conflicting suggestions are held back, and a retry after a partial
// failure only redoes what is still missing.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LibraryEntry } from "@/lib/photoTagging/assemble";
import { executePlan } from "@/lib/photoTagging/apply";
import { planHighConfidence } from "@/lib/photoTagging/highConfidence";
import { planTagChanges, type PlanTarget } from "@/lib/photoTagging/plan";
import { previewPlan } from "@/lib/photoTagging/preview";
import type { AuditedPhoto, TagSuggestion } from "@/lib/photoTagging/types";

const mocks = vi.hoisted(() => ({
  failSessions: new Set<string>(),
  sessionWrites: [] as { sessionId: string; facts: Record<string, unknown> }[],
  spotWrites: [] as { school: string; url: string; spotKey: string | null }[],
}));

vi.mock("@/lib/contentEngine/createSession", () => ({
  updateSessionFacts: async ({ sessionId, facts }: { sessionId: string; facts: Record<string, unknown> }) => {
    if (mocks.failSessions.has(sessionId)) throw new Error("facts update failed: connection reset");
    mocks.sessionWrites.push({ sessionId, facts });
    return { updated: true };
  },
}));
vi.mock("@/lib/pagePhotos/spotTagStore", () => ({
  setSpotTag: async (_client: unknown, school: string, url: string, spotKey: string | null) => {
    mocks.spotWrites.push({ school, url, spotKey });
  },
}));

interface RowWrite { table: string; id: unknown; patch: Record<string, unknown> }

/** A Supabase stand-in for `.from(t).update(p).eq("id", v).select("id")`. Missing ids match no row. */
function fakeClient(existing: Record<string, unknown[]>, writes: RowWrite[]): SupabaseClient {
  return {
    from: (table: string) => ({
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, id: unknown) => ({
          select: async () => {
            if (!(existing[table] ?? []).includes(id)) return { data: [], error: null };
            writes.push({ table, id, patch });
            return { data: [{ id }], error: null };
          },
        }),
      }),
      select: async () => ({ data: [{ id: 1, slug: "graduation" }], error: null }),
    }),
  } as unknown as SupabaseClient;
}

const BASE = "https://x.supabase.co/storage/v1/object/public/grad-photos/";
const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "11111111-1111-4111-8111-222222222222";
const engineId = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;

function engineTarget(n: number, sessionId = S1, overrides: Partial<PlanTarget> = {}): PlanTarget {
  return {
    key: `engine:${engineId(n)}`, source: "engine", portfolioId: null, enginePhotoId: engineId(n), sessionId,
    url: null, category: "grads", school: null, location: null, spot: null,
    stored: { school: null, location: null, spot: null }, ...overrides,
  };
}

function portfolioTarget(id: number, overrides: Partial<PlanTarget> = {}): PlanTarget {
  return {
    key: `portfolio:${id}`, source: "portfolio", portfolioId: id, enginePhotoId: null, sessionId: null,
    url: `${BASE}p${id}.jpg`, category: "grads", school: null, location: null, spot: null, ...overrides,
  };
}

function suggestion(field: TagSuggestion["field"], value: string, overrides: Partial<TagSuggestion> = {}): TagSuggestion {
  return { id: `${field}:${value}`, field, value, label: value, confidence: "high", origin: "session",
    reason: "test", appliesTo: "photo", ...overrides };
}

function entry(target: PlanTarget, suggestions: TagSuggestion[], sessionName = "Kim"): LibraryEntry {
  const photo = {
    key: target.key, source: target.source, portfolioId: target.portfolioId, enginePhotoId: target.enginePhotoId,
    sessionId: target.sessionId, sessionName, url: target.url, published: true, title: "t", category: target.category,
    school: target.school, status: "partial", checks: [], suggestions, pages: [], spotTaggable: true, aiAnalyzedAt: null,
  } as AuditedPhoto;
  return { photo, target, vision: { imageUrl: null, storagePath: null } };
}

beforeEach(() => {
  mocks.failSessions.clear();
  mocks.sessionWrites.length = 0;
  mocks.spotWrites.length = 0;
});

describe("executePlan reports each photo field by the write that carries it", () => {
  it("counts a failed session write against every photo it covers, not as one", async () => {
    mocks.failSessions.add(S1);
    const writes: RowWrite[] = [];
    const client = fakeClient({ portfolio_images: [1] }, writes);
    const targets = [engineTarget(1), engineTarget(2), engineTarget(3), portfolioTarget(1)];
    const result = await executePlan(client, planTagChanges(targets, { school: "usf" }, false));
    expect(result).toMatchObject({ updated: 1, failed: 3 });
    expect(result.failures).toHaveLength(1);
    expect(result.outcomes.filter((o) => o.result === "failed").map((o) => o.key))
      .toEqual(targets.slice(0, 3).map((t) => t.key));
    expect(result.outcomes.find((o) => o.key === "portfolio:1")?.result).toBe("updated");
    expect(result.sessionIds).toEqual([]);
  });

  it("never reports success for an update that matched no row", async () => {
    const writes: RowWrite[] = [];
    const result = await executePlan(fakeClient({}, writes), planTagChanges([portfolioTarget(9)], { location: "Crissy Field" }, false));
    expect(result).toMatchObject({ updated: 0, failed: 1 });
    expect(result.failures[0]).toMatch(/no longer exists/);
  });

  it("writes a photo location to that photo only, confirmed now, and syncs its session", async () => {
    const writes: RowWrite[] = [];
    const client = fakeClient({ session_photos: [engineId(1)] }, writes);
    const result = await executePlan(client, planTagChanges([engineTarget(1)], { location: "Legion of Honor" }, false));
    expect(result).toMatchObject({ updated: 1, failed: 0, sessionIds: [S1] });
    expect(writes).toEqual([{ table: "session_photos", id: engineId(1), patch: expect.objectContaining({
      photo_location: "Legion of Honor", photo_location_source: "manual", photo_location_confirmed_at: expect.any(String),
    }) }]);
    expect(mocks.sessionWrites).toEqual([]);
  });

  it("does not tag a spot when the university it depends on failed", async () => {
    mocks.failSessions.add(S1);
    const target = engineTarget(1, S1, { url: `${BASE}e1.jpg` });
    const result = await executePlan(fakeClient({}, []), planTagChanges([target], { school: "uc-berkeley", spot: "sather-gate" }, false));
    expect(mocks.spotWrites).toEqual([]);
    expect(result.outcomes.map((o) => [o.field, o.result])).toEqual([["school", "failed"], ["spot", "failed"]]);
  });

  it("a retry after a partial failure only redoes what is still missing", async () => {
    mocks.failSessions.add(S2);
    const writes: RowWrite[] = [];
    const client = fakeClient({ session_photos: [engineId(1), engineId(2)] }, writes);
    const first = [engineTarget(1, S1), engineTarget(2, S2)];
    const firstRun = await executePlan(client, planTagChanges(first, { school: "usf", location: "Gleeson Library" }, false));
    expect(firstRun).toMatchObject({ updated: 3, failed: 1 });

    mocks.failSessions.clear();
    // The re-read library: what succeeded is now set.
    const second = [
      engineTarget(1, S1, { school: "usf", location: "Gleeson Library" }),
      engineTarget(2, S2, { location: "Gleeson Library" }),
    ];
    const plan = planTagChanges(second, { school: "usf", location: "Gleeson Library" }, false);
    expect(plan.writes).toEqual([{ kind: "session", sessionId: S2, patch: { school_slug: "usf" } }]);
    const retry = await executePlan(client, plan);
    expect(retry).toMatchObject({ updated: 1, failed: 0, kept: 3 });
  });
});

describe("planHighConfidence holds back conflicts", () => {
  it("skips a field whose high suggestions disagree", () => {
    const e = entry(portfolioTarget(1), [suggestion("location", "Crissy Field"), suggestion("location", "Legion of Honor", { origin: "siblings" })]);
    const plan = planHighConfidence([e]);
    expect(plan.writes).toEqual([]);
    expect(plan.outcomes).toEqual([expect.objectContaining({ field: "location", result: "conflict" })]);
  });

  it("skips a field with a competing suggestion even when one is high", () => {
    const e = entry(portfolioTarget(1), [
      suggestion("location", "Palace of Fine Arts"),
      suggestion("location", "Legion of Honor", { confidence: "medium", competing: true }),
    ]);
    expect(planHighConfidence([e]).outcomes[0]).toMatchObject({ result: "conflict" });
  });

  it("holds back a session's university when its photos ask for different ones", () => {
    const school = (v: string) => suggestion("school", v, { appliesTo: "session" });
    const plan = planHighConfidence([
      entry(engineTarget(1), [school("usf")]), entry(engineTarget(2), [school("sfsu")]),
      entry(engineTarget(3, S2), [school("sjsu")]),
    ]);
    expect(plan.writes).toEqual([{ kind: "session", sessionId: S2, patch: { school_slug: "sjsu" } }]);
    expect(plan.outcomes.filter((o) => o.result === "conflict").map((o) => o.key)).toEqual([engineTarget(1).key, engineTarget(2).key]);
  });

  it("writes one session once when its photos agree", () => {
    const school = suggestion("school", "usf", { appliesTo: "session" });
    const plan = planHighConfidence([entry(engineTarget(1), [school]), entry(engineTarget(2), [school])]);
    expect(plan.writes).toEqual([{ kind: "session", sessionId: S1, patch: { school_slug: "usf" } }]);
    expect(plan.outcomes.map((o) => o.result)).toEqual(["updated", "updated"]);
  });

  it("leaves session-wide suggestions for review when photoOnly", () => {
    const plan = planHighConfidence([entry(engineTarget(1), [suggestion("school", "usf", { appliesTo: "session" }), suggestion("location", "Gleeson Library")])],
      { photoOnly: true });
    expect(plan.writes.map((w) => w.kind)).toEqual(["photo"]);
    expect(plan.outcomes.find((o) => o.field === "school")).toMatchObject({ result: "skipped" });
  });

  it("records a GPS-confirmed location as gps, and never applies medium suggestions", () => {
    const plan = planHighConfidence([entry(engineTarget(1), [
      suggestion("location", "Crissy Field", { origin: "gps" }), suggestion("spot", "sather-gate", { confidence: "medium", origin: "vision" }),
    ])]);
    expect(plan.writes).toEqual([expect.objectContaining({ kind: "photo", patch: { location: "Crissy Field", source: "gps" } })]);
  });

  it("preserves existing values (never replaces)", () => {
    const plan = planHighConfidence([entry(portfolioTarget(1, { location: "Crissy Field" }), [suggestion("location", "Legion of Honor")])]);
    expect(plan.writes).toEqual([]);
    expect(plan.outcomes[0].result).toBe("kept");
  });
});

describe("preview", () => {
  it("says how many other photos a session-wide university changes, and the undo value", () => {
    const chosen = entry(engineTarget(1, S1, { stored: { school: "sfsu" }, school: "sfsu" }), []);
    const all = [chosen, entry(engineTarget(2), []), entry(engineTarget(3), []), entry(portfolioTarget(4, { sessionId: S1, stored: { school: "usf" } }), [])];
    const result = previewPlan(planTagChanges([chosen.target], { school: "usf" }, true), all, [chosen.photo.key]);
    expect(result.sessionImpact).toEqual([{ sessionId: S1, sessionName: "Kim", field: "school", value: "usf", otherPhotos: 2 }]);
    expect(result.outcomes[0]).toMatchObject({ result: "updated", scope: "session", previous: "sfsu", value: "usf" });
  });
});
