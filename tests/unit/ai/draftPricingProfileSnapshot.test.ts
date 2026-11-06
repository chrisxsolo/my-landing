// ─────────────────────────────────────────────────────────────────────────────
// The server-owned pricing-profile snapshot.
//
// A fresh sports-team draft is checked against a thread-aware quote input. A
// restored one used to be rebuilt from the inquiry row alone, which cannot see
// the Gmail context that resolved the profile, so after a reload the same
// draft reverted to ordinary graduation or manual pricing.
//
// /api/draft-reply now writes draft + ai_draft + a versioned profile snapshot
// in ONE upsert, bound to the AI baseline by digest. The browser can neither
// assert nor clear the profile; /api/admin/drafts restores it only when the
// digest still matches the stored ai_draft, and fails closed with a visible
// warning otherwise. No prices and no prose are stored in the snapshot.
// ─────────────────────────────────────────────────────────────────────────────

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  buildDraftPricingProfileSnapshot,
  draftPricingProfileKey,
  readDraftPricingProfileSnapshot,
  serializeDraftPricingProfileSnapshot,
  sha256Hex,
} from "@/lib/ai/draftPricingProfileSnapshot";
import { DRAFT_KEY_PREFIXES, EDITABLE_SETTING_KEYS, isDraftKey } from "@/lib/siteSettingsShared";
import type { QuoteInput } from "@/lib/ai/quotePricing";
import { AVAILABILITY, fakeCaller } from "./fixtures";

const TEAM_INQUIRY = "Hi Chris! I coach a high school team and we'd like sports senior portraits for 8 of our senior athletes. Could you send over your rates and what the 30-minute and one-hour options would look like?";

const TEAM_DRAFT = `Hi Jordan,

For eight people I can do this two ways. A 30-minute session is $800 total, which works out to $100 per person. A 60-minute session is $1,200 total, or $150 per person

Everyone gets 5 edited images, 2 headshots and 3 full-body portraits, so 40 edited images for the group

I'd strongly recommend the 60-minute option so nobody feels rushed

This is a custom standardized sports-team portrait rate, separate from my regular graduation group pricing`;

const GRAD_DRAFT = "Hi Sarah,\n\nMy graduation sessions start at $325 for a 30-minute mini, or $425 for a 1-hour session";

const db = vi.hoisted(() => ({
  settings: new Map<string, string>(),
  inquiry: null as Record<string, unknown> | null,
  upserts: [] as { key: string; value: string }[][],
  deletes: [] as string[][],
  failUpsert: false,
  usage: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/requireAdmin", () => ({ requireAdmin: () => null }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClient: () => ({
    from: (table: string) => ({
      select: () => ({
        in: async (_column: string, keys: string[]) => ({
          data: keys.filter((k) => db.settings.has(k)).map((k) => ({ key: k, value: db.settings.get(k) })),
          error: null,
        }),
        eq: () => ({ maybeSingle: async () => ({ data: table === "inquiries" ? db.inquiry : null, error: null }) }),
      }),
      upsert: async (rows: { key: string; value: string }[]) => {
        db.upserts.push(rows);
        if (db.failUpsert) return { error: new Error("connection reset") };
        for (const row of rows) db.settings.set(row.key, row.value);
        return { error: null };
      },
      delete: () => ({
        in: async (_column: string, keys: string[]) => {
          db.deletes.push(keys);
          for (const key of keys) db.settings.delete(key);
          return { error: null };
        },
      }),
    }),
  }),
}));
vi.mock("@/lib/ai/availabilitySnapshot", () => ({ fetchAvailabilitySnapshot: async () => AVAILABILITY }));
vi.mock("@/lib/ai/aiEmailStore", () => ({
  fetchWritingRules: async () => [],
  fetchExamplePool: async () => [],
  fetchMonthToDateSpendUsd: async () => 0,
  fetchInquiryAdminRow: async () => null,
  recordUsage: async (record: Record<string, unknown>) => { db.usage.push(record); },
}));
const model = vi.hoisted(() => ({ reply: "" }));
vi.mock("@/lib/ai/emailModel", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/emailModel")>();
  return { ...original, createEmailModelCaller: () => fakeCaller(() => model.reply) };
});

const { POST: draftReply } = await import("@/app/api/draft-reply/route");
const { GET, PUT, DELETE } = await import("@/app/api/admin/drafts/route");

const INQUIRY_ID = 777;
const TEAM_ROW = { session_type: "Other", message: TEAM_INQUIRY, school: null, location: null, people: 8 };
const GRAD_ROW = { session_type: "Graduation", message: "Hi! I'd love to book graduation photos.", school: "USF", location: null, people: 1 };

type RestoreBody = {
  draft: string | null; ai_draft: string | null; original_ai_draft: string | null;
  quote: { input: QuoteInput; stalePrices: number[] } | null;
  warnings?: { code: string; severity: string; message: string }[];
};

async function restore(): Promise<RestoreBody> {
  const res = await GET(new NextRequest(`https://soloxsnaps.com/api/admin/drafts?inquiryId=${INQUIRY_ID}`));
  return await res.json() as RestoreBody;
}

async function put(body: unknown) {
  return PUT(new NextRequest("https://soloxsnaps.com/api/admin/drafts", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
}

async function del(body: unknown) {
  return DELETE(new NextRequest("https://soloxsnaps.com/api/admin/drafts", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
}

async function generate(overrides: Record<string, unknown> = {}, reply = TEAM_DRAFT) {
  model.reply = reply;
  const body = {
    mode: "generate", inquiry_id: INQUIRY_ID, name: "Jordan Reyes", email: `jordan+${Math.random()}@example.com`,
    session_type: "Other", message: TEAM_INQUIRY, people: 8, thread_messages: [], thread_loaded: true, ...overrides,
  };
  const res = await draftReply(new NextRequest("https://soloxsnaps.com/api/draft-reply", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  return { status: res.status, json: await res.json() as { draft?: string; error?: string; code?: string; quote?: { input: QuoteInput } | null } };
}

const profileKey = draftPricingProfileKey(INQUIRY_ID);
const snapshotOf = () => JSON.parse(db.settings.get(profileKey) ?? "null") as { version: number; profile: string | null; aiDraftSha256: string } | null;

beforeEach(() => {
  db.settings.clear(); db.inquiry = TEAM_ROW; db.upserts = []; db.deletes = []; db.failUpsert = false; db.usage = [];
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("the snapshot helper", () => {
  it("stores a version, a profile discriminator and a digest of the AI baseline, nothing else", () => {
    const snapshot = buildDraftPricingProfileSnapshot("sports_team_portrait", TEAM_DRAFT);
    expect(snapshot).toEqual({ version: 1, profile: "sports_team_portrait", aiDraftSha256: sha256Hex(TEAM_DRAFT) });
    const raw = serializeDraftPricingProfileSnapshot(snapshot);
    expect(raw).not.toContain("$");
    expect(raw).not.toContain("Jordan");
    expect(raw).not.toContain("800");
  });

  it("reads a matching snapshot, and fails closed on anything else", () => {
    const raw = serializeDraftPricingProfileSnapshot(buildDraftPricingProfileSnapshot("sports_team_portrait", TEAM_DRAFT));
    expect(readDraftPricingProfileSnapshot(raw, TEAM_DRAFT)).toEqual({ status: "valid", profile: "sports_team_portrait" });
    expect(readDraftPricingProfileSnapshot(null, TEAM_DRAFT)).toEqual({ status: "absent" });
    expect(readDraftPricingProfileSnapshot(raw, `${TEAM_DRAFT} edited`).status).toBe("invalid");
    expect(readDraftPricingProfileSnapshot(raw, null).status).toBe("invalid");
    expect(readDraftPricingProfileSnapshot("{not json", TEAM_DRAFT).status).toBe("invalid");
    expect(readDraftPricingProfileSnapshot(JSON.stringify({ version: 2, profile: "sports_team_portrait", aiDraftSha256: sha256Hex(TEAM_DRAFT) }), TEAM_DRAFT).status).toBe("invalid");
    expect(readDraftPricingProfileSnapshot(JSON.stringify({ version: 1, profile: "graduation", aiDraftSha256: sha256Hex(TEAM_DRAFT) }), TEAM_DRAFT).status).toBe("invalid");
    expect(readDraftPricingProfileSnapshot(JSON.stringify({ version: 1, profile: null, aiDraftSha256: sha256Hex(TEAM_DRAFT) }), TEAM_DRAFT)).toEqual({ status: "valid", profile: null });
  });

  it("keeps the profile key out of every browser-writable key set", () => {
    expect(profileKey).toBe("ai_pricing_profile_777");
    expect((DRAFT_KEY_PREFIXES as readonly string[]).some((k) => profileKey.startsWith(`${k}_`))).toBe(false);
    expect(isDraftKey(profileKey)).toBe(false);
    expect((EDITABLE_SETTING_KEYS as readonly string[]).includes(profileKey)).toBe(false);
  });
});

describe("POST /api/draft-reply persists the draft, the AI baseline and the profile as one unit", () => {
  it("writes the three bound rows in one upsert for a sports-team generation", async () => {
    const { status, json } = await generate();
    expect(status).toBe(200);
    expect(json.draft).toBe(TEAM_DRAFT);
    expect(json.quote?.input.playbook).toBe("sports_team_portrait");
    expect(db.upserts).toHaveLength(1);
    const keys = db.upserts[0].map((r) => r.key).sort();
    expect(keys).toEqual(["ai_draft_777", "ai_pricing_profile_777", "draft_777", "original_ai_draft_777"]);
    expect(db.settings.get("draft_777")).toBe(TEAM_DRAFT);
    expect(db.settings.get("ai_draft_777")).toBe(TEAM_DRAFT);
    expect(snapshotOf()).toEqual({ version: 1, profile: "sports_team_portrait", aiDraftSha256: sha256Hex(TEAM_DRAFT) });
  });

  it("restores the special quote after reload with no browser save at all", async () => {
    await generate();
    const body = await restore();
    expect(body.ai_draft).toBe(TEAM_DRAFT);
    expect(body.warnings ?? []).toEqual([]);
    expect(body.quote?.input.playbook).toBe("sports_team_portrait");
    expect(body.quote?.input.basePrices).toEqual([800, 1200]);
    expect(body.quote?.input.informationalPrices).toEqual([100, 150]);
  });

  it("rebuilds the restored quote from the current source and the inquiry's current location, not stored values", async () => {
    await generate();
    db.inquiry = { ...TEAM_ROW, location: "UC Berkeley" };
    const body = await restore();
    expect(body.quote?.input.playbook).toBe("sports_team_portrait");
    expect(body.quote?.input.travel).toMatchObject({ kind: "verified", fee: 45 });
  });

  it("never overwrites the cycle's first AI draft on a regeneration or refine", async () => {
    await generate();
    await generate({ is_regeneration: true, current_draft: TEAM_DRAFT }, `${TEAM_DRAFT}\n\nLet me know which works!`);
    expect(db.settings.get("original_ai_draft_777")).toBe(TEAM_DRAFT);
    expect(db.settings.get("ai_draft_777")).toBe(`${TEAM_DRAFT}\n\nLet me know which works!`);
    expect(db.upserts[1].map((r) => r.key)).not.toContain("original_ai_draft_777");
    await generate({ mode: "refine", current_draft: TEAM_DRAFT, feedback: "shorter" }, TEAM_DRAFT);
    expect(db.settings.get("original_ai_draft_777")).toBe(TEAM_DRAFT);
    expect(snapshotOf()?.aiDraftSha256).toBe(sha256Hex(TEAM_DRAFT));
  });

  it("writes a null profile with the new baseline when a later generation is not special", async () => {
    await generate();
    db.inquiry = GRAD_ROW;
    const { status } = await generate({ session_type: "Graduation", message: GRAD_ROW.message, school: "USF", people: 1 }, GRAD_DRAFT);
    expect(status).toBe(200);
    expect(db.upserts).toHaveLength(2);
    expect(db.upserts[1].map((r) => r.key)).toContain(profileKey);
    expect(snapshotOf()).toEqual({ version: 1, profile: null, aiDraftSha256: sha256Hex(GRAD_DRAFT) });
    const body = await restore();
    expect(body.quote?.input.playbook).toBe("graduation");
    expect(body.warnings ?? []).toEqual([]);
  });

  it("returns an explicit save failure, records usage, and leaves no half-written unit when the upsert fails", async () => {
    await generate();
    db.failUpsert = true;
    const { status, json } = await generate({ is_regeneration: true, current_draft: TEAM_DRAFT }, `${TEAM_DRAFT}\n\nTalk soon!`);
    expect(status).toBe(500);
    expect(json.draft).toBeUndefined();
    expect(json.code).toBe("draft_save_failed");
    expect(json.error).toMatch(/could not be saved/i);
    expect(db.usage.filter((u) => u.success === true)).toHaveLength(2);
    // The stored unit is still the earlier, consistent one.
    expect(db.settings.get("ai_draft_777")).toBe(TEAM_DRAFT);
    expect(snapshotOf()?.aiDraftSha256).toBe(sha256Hex(TEAM_DRAFT));
  });

  it("starts the cycle on a first generation even when Chris had typed into the compose box", async () => {
    // The browser flags any generate over existing text as a regeneration;
    // the server still writes the first AI draft when none is stored.
    await generate({ is_regeneration: true, current_draft: "my own notes" });
    expect(db.settings.get("original_ai_draft_777")).toBe(TEAM_DRAFT);
  });

  it("leaves the live draft and its snapshot alone when only the first-draft baseline is cleared", async () => {
    await generate();
    await del({ inquiryId: INQUIRY_ID, kinds: ["original_ai_draft"] });
    expect(db.settings.has("original_ai_draft_777")).toBe(false);
    expect(db.settings.has(profileKey)).toBe(true);
    expect((await restore()).quote?.input.playbook).toBe("sports_team_portrait");
  });

  it("does not persist without a valid inquiry id", async () => {
    await generate({ inquiry_id: null });
    expect(db.upserts).toHaveLength(0);
  });
});

describe("the browser cannot assert or clear the profile", () => {
  it("ignores a profile snapshot sent through PUT", async () => {
    await generate();
    const forged = serializeDraftPricingProfileSnapshot(buildDraftPricingProfileSnapshot("sports_team_portrait", GRAD_DRAFT));
    const res = await put({ inquiryId: INQUIRY_ID, draft: GRAD_DRAFT, ai_pricing_profile: forged, [profileKey]: forged });
    expect(res.status).toBe(200);
    expect(db.upserts.at(-1)?.map((r) => r.key)).toEqual(["draft_777"]);
    expect(snapshotOf()?.aiDraftSha256).toBe(sha256Hex(TEAM_DRAFT));
    // A manual edit to the compose draft does not invalidate the binding.
    expect((await restore()).quote?.input.playbook).toBe("sports_team_portrait");
  });

  it("cannot create a profile for an inquiry that never had a server-resolved one", async () => {
    db.inquiry = GRAD_ROW;
    await put({ inquiryId: INQUIRY_ID, ai_draft: TEAM_DRAFT, draft: TEAM_DRAFT, ai_pricing_profile: serializeDraftPricingProfileSnapshot(buildDraftPricingProfileSnapshot("sports_team_portrait", TEAM_DRAFT)) });
    expect(db.settings.has(profileKey)).toBe(false);
    const body = await restore();
    expect(body.quote?.input.playbook).toBe("graduation");
    expect(body.warnings ?? []).toEqual([]);
  });

  it("fails closed with a visible warning when the baseline no longer matches the snapshot", async () => {
    await generate();
    await put({ inquiryId: INQUIRY_ID, ai_draft: `${TEAM_DRAFT} tampered` });
    const body = await restore();
    expect(body.quote?.input.playbook).not.toBe("sports_team_portrait");
    expect(body.quote).not.toBeNull();
    expect(body.warnings?.map((w) => w.code)).toEqual(["pricing_profile_restore_invalid"]);
    expect(body.warnings?.[0].severity).toBe("high");
  });

  it.each([
    ["malformed", "{not json"],
    ["unknown version", JSON.stringify({ version: 9, profile: "sports_team_portrait", aiDraftSha256: sha256Hex(TEAM_DRAFT) })],
    ["unknown profile", JSON.stringify({ version: 1, profile: "mystery", aiDraftSha256: sha256Hex(TEAM_DRAFT) })],
  ])("fails closed and warns on a %s snapshot", async (_label, raw) => {
    db.settings.set("ai_draft_777", TEAM_DRAFT);
    db.settings.set(profileKey, raw);
    const body = await restore();
    expect(body.quote?.input.playbook).not.toBe("sports_team_portrait");
    expect(body.warnings?.map((w) => w.code)).toEqual(["pricing_profile_restore_invalid"]);
  });

  it("keeps the generic restored quote for a pre-change draft with no snapshot", async () => {
    db.inquiry = GRAD_ROW;
    db.settings.set("ai_draft_777", GRAD_DRAFT);
    const body = await restore();
    expect(body.quote?.input.playbook).toBe("graduation");
    expect(body.warnings ?? []).toEqual([]);
  });

  it("clears the snapshot with the cycle rows even when only text kinds are requested", async () => {
    await generate();
    const res = await del({ inquiryId: INQUIRY_ID, kinds: ["draft", "ai_draft"] });
    expect(res.status).toBe(200);
    expect(db.deletes.at(-1)).toContain(profileKey);
    expect(db.settings.has(profileKey)).toBe(false);
    expect(db.settings.has("draft_777")).toBe(false);
    expect(db.settings.has("ai_draft_777")).toBe(false);
  });
});
