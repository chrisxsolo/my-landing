// /api/admin/photo-tagging write actions: refused on an incomplete audit,
// previewed without writing, and followed by the public refresh + syncs
// (including a photo-level engine location change).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { LibraryEntry } from "@/lib/photoTagging/assemble";
import type { ApplyResult } from "@/lib/photoTagging/apply";
import type { AuditedPhoto } from "@/lib/photoTagging/types";

const S1 = "11111111-1111-4111-8111-111111111111";
const PHOTO = "22222222-2222-4222-8222-000000000001";

const mocks = vi.hoisted(() => ({
  errors: [] as string[],
  entries: [] as unknown[],
  executed: 0,
  result: null as unknown,
  revalidated: 0,
  campusSyncs: 0,
  sessionSyncs: [] as string[],
  /** The history options the route hands executePlan (who / why). */
  logOpts: null as unknown,
  /** The photo_change_log row a restore reads. */
  logRow: null as unknown,
}));

vi.mock("@/lib/requireAdmin", () => ({ requireAdmin: () => null }));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient: () => ({}) }));
vi.mock("@/lib/publicRevalidation", () => ({ revalidatePublicContent: () => { mocks.revalidated += 1; } }));
vi.mock("@/lib/campusSpotFill/autoSync", () => ({ syncCampusSpotPhotosInBackground: () => { mocks.campusSyncs += 1; } }));
vi.mock("@/lib/locationLibrary/autoSync", () => ({ syncSessionInBackground: (id: string) => { mocks.sessionSyncs.push(id); } }));
vi.mock("@/lib/contentEngine/aiClient", () => ({ createAnthropicCaller: () => null }));
vi.mock("@/lib/photoTagging/library", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  loadAudit: async () => ({ entries: mocks.entries, places: [], customSchools: new Map(), categories: [], errors: mocks.errors }),
}));
vi.mock("@/lib/photoTagging/apply", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  executePlan: async (_client: unknown, _plan: unknown, opts: unknown) => { mocks.executed += 1; mocks.logOpts = opts; return mocks.result; },
}));
vi.mock("@/lib/photoChangeLog/log", () => ({
  loadChangeLog: async () => [],
  loadChangeLogRow: async () => mocks.logRow,
}));

const { POST } = await import("@/app/api/admin/photo-tagging/route");

function engineEntry(n: number): LibraryEntry {
  const id = `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;
  const target = { key: `engine:${id}`, source: "engine" as const, portfolioId: null, enginePhotoId: id, sessionId: S1,
    url: null, category: "grads", school: null, location: null, spot: null, stored: { school: null, location: null, spot: null } };
  const photo = { key: target.key, source: "engine", sessionId: S1, sessionName: "Kim", suggestions: [] } as unknown as AuditedPhoto;
  return { photo, target, vision: { imageUrl: null, storagePath: null } };
}

const post = (body: Record<string, unknown>) => POST(new NextRequest("http://localhost/api/admin/photo-tagging", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
}));

beforeEach(() => {
  mocks.errors = [];
  mocks.entries = [engineEntry(1), engineEntry(2), engineEntry(3)];
  mocks.executed = 0;
  mocks.revalidated = 0;
  mocks.campusSyncs = 0;
  mocks.sessionSyncs = [];
  mocks.logOpts = null;
  mocks.logRow = null;
  mocks.result = {
    updated: 1, failed: 0, kept: 0, skipped: 0, conflicts: 0, outcomes: [], failures: [], sessionIds: [S1],
  } satisfies ApplyResult;
});

describe("photo tagging writes", () => {
  it.each([
    ["apply", { action: "apply", keys: [`engine:${PHOTO}`], changes: { location: "Crissy Field" } }],
    ["apply-high", { action: "apply-high" }],
    ["preview", { action: "preview", keys: [`engine:${PHOTO}`], changes: { location: "Crissy Field" } }],
  ])("%s refuses with 409 when the audit read was incomplete", async (_label, body) => {
    mocks.errors = ["session_photos: could not load session_photos (rows from 1000): timeout"];
    const res = await post(body);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/could not be fully read.*Nothing was changed/);
    expect(mocks.executed).toBe(0);
  });

  it("previews a session-wide university without writing, with the photos it also changes", async () => {
    const res = await post({ action: "preview", keys: [`engine:${PHOTO}`], changes: { school: "usf" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionImpact).toEqual([{ sessionId: S1, sessionName: "Kim", field: "school", value: "usf", otherPhotos: 2 }]);
    expect(body.updated).toBe(1);
    expect(mocks.executed).toBe(0);
  });

  it("refreshes the site and syncs the photo's session after a photo-level location change", async () => {
    const res = await post({ action: "apply", keys: [`engine:${PHOTO}`], changes: { location: "Crissy Field" } });
    expect(res.status).toBe(200);
    expect(mocks.executed).toBe(1);
    expect(mocks.revalidated).toBe(1);
    expect(mocks.campusSyncs).toBe(1);
    expect(mocks.sessionSyncs).toEqual([S1]);
  });

  it("does not refresh or sync when nothing was updated", async () => {
    mocks.result = { ...(mocks.result as ApplyResult), updated: 0, failed: 1, sessionIds: [] };
    await post({ action: "apply", keys: [`engine:${PHOTO}`], changes: { location: "Crissy Field" } });
    expect(mocks.revalidated + mocks.campusSyncs + mocks.sessionSyncs.length).toBe(0);
  });

  it("accepts an evidence level on a location and refuses an unknown one", async () => {
    expect((await post({ action: "apply", keys: [`engine:${PHOTO}`], changes: { location: "Crissy Field", evidence: "session" } })).status).toBe(200);
    expect((await post({ action: "apply", keys: [`engine:${PHOTO}`], changes: { location: "Crissy Field", evidence: "guess" } })).status).toBe(400);
  });
});

describe("the change history", () => {
  it("records an admin edit as manual (with its reason) and apply-high as system", async () => {
    await post({ action: "apply", keys: [`engine:${PHOTO}`], changes: { location: "Crissy Field" }, reason: "undo" });
    expect(mocks.logOpts).toEqual({ actor: "manual", reason: "undo" });
    await post({ action: "apply-high" });
    expect(mocks.logOpts).toMatchObject({ actor: "system" });
  });

  it("restores a logged tag field as a new manual change, and refuses non-tag fields", async () => {
    mocks.logRow = { id: 7, key: `engine:${PHOTO}`, field: "location", oldValue: "Crissy Field", newValue: "Ocean Beach", actor: "system", reason: null, createdAt: "2026-10-27T00:00:00Z" };
    const res = await post({ action: "restore", logId: 7 });
    expect(res.status).toBe(200);
    expect(mocks.executed).toBe(1);
    expect(mocks.logOpts).toEqual({ actor: "manual", reason: "restore #7" });

    mocks.logRow = { ...(mocks.logRow as object), field: "library_links", oldValue: { locationIds: [1] } };
    expect((await post({ action: "restore", logId: 7 })).status).toBe(422);
    mocks.logRow = null;
    expect((await post({ action: "restore", logId: 8 })).status).toBe(404);
    expect(mocks.executed).toBe(1);
  });
});
