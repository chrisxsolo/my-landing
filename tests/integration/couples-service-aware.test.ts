// Service-aware engine (2026-07-02): a couples session must produce couples
// prompts / keywords / link candidates end-to-end, while a grads session keeps
// the exact pre-service-aware behavior. Runs against the local test DB.
import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { service, resetDb, createTestSession, createTestPhoto, createPackage } from "./helpers";
import { generateContentType } from "@/lib/contentEngine/generateContent";
import { updateSessionFacts } from "@/lib/contentEngine/createSession";
import { buildSessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { ORIGINALS_BUCKET } from "@/lib/contentEngine/uploadConfig";
import type { ModelCaller, ModelCallRequest } from "@/lib/contentEngine/aiClient";

beforeAll(() => resetDb());

// Fake model that records every request so tests can assert prompt routing.
function capturingModel(text: string, calls: ModelCallRequest[]): ModelCaller {
  return async (req) => {
    calls.push(req);
    return { text, usage: { input_tokens: 800, output_tokens: 300 }, model: req.model };
  };
}

async function storedAnalyzedPhoto(sessionId: string, fields: Record<string, unknown>) {
  const photo = await createTestPhoto(sessionId);
  const { data: row } = await service.from("session_photos")
    .select("storage_path").eq("id", photo.id).single();
  const buf = await sharp({
    create: { width: 120, height: 100, channels: 3, background: { r: 90, g: 100, b: 80 } },
  }).jpeg().toBuffer();
  await service.storage.from(ORIGINALS_BUCKET)
    .upload(row!.storage_path as string, buf, { contentType: "image/jpeg" });
  await service.from("session_photos")
    .update({ analysis_status: "completed", quality_score: 9, ...fields }).eq("id", photo.id);
  return photo;
}

const systemOf = (req: ModelCallRequest) => req.system ?? "";

describe("couples session facts (columns + validation)", () => {
  it("stores and snapshots the couples facets; grad sessions still load", async () => {
    const sessionId = await createTestSession({ service_type: "couples", school_slug: null });
    await updateSessionFacts({
      client: service, sessionId,
      facts: {
        primary_location: "Crissy Field", secondary_locations: ["Lovers Lane"],
        lighting_condition: "sunset", vibe: "playful", relationship_type: "engagement",
        outfit_styling: "earth tones", best_moment: "fog reveal at the bridge",
        public_session_summary: "Foggy golden hour walk for two.",
      },
    });
    const { data: session } = await service.from("photography_sessions")
      .select("*").eq("id", sessionId).single();
    const snap = buildSessionFactsSnapshot(session!);
    expect(snap.vibe).toBe("playful");
    expect(snap.relationship_type).toBe("engagement");
    expect(snap.lighting_condition).toBe("sunset");
    expect(snap.outfit_styling).toBe("earth tones");

    // a plain grads session (no couples facets) still loads and snapshots
    const gradId = await createTestSession();
    const { data: grad } = await service.from("photography_sessions")
      .select("*").eq("id", gradId).single();
    expect(buildSessionFactsSnapshot(grad!).vibe).toBeNull();
  });

  it("rejects out-of-taxonomy vibe / relationship_type", async () => {
    const sessionId = await createTestSession({ service_type: "couples" });
    await expect(updateSessionFacts({
      client: service, sessionId, facts: { vibe: "sparkly" },
    })).rejects.toThrow(/invalid vibe/);
    await expect(updateSessionFacts({
      client: service, sessionId, facts: { relationship_type: "situationship" },
    })).rejects.toThrow(/invalid relationship type/);
  });
});

describe("couples generation routing", () => {
  const couplesFacts = {
    service_type: "couples", school_slug: null, public_display_name: "Ana",
    primary_location: "Crissy Field", secondary_locations: [],
    lighting_condition: "golden_hour", vibe: "playful", relationship_type: "engagement",
    public_session_summary: "Foggy golden hour walk for two.",
  };

  it("internal links: prompt offers only couples pages + pricing, no grad/campus links", async () => {
    const sessionId = await createTestSession({ service_type: "couples", school_slug: null });
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"], couplesFacts);
    const calls: ModelCallRequest[] = [];
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "internal_link_suggestion",
      callModel: capturingModel(JSON.stringify({
        links: [{ url: "/couples-guide/locations/crissy-field", label: "Crissy Field couples guide", reason: "session location" }],
      }), calls),
    });
    expect(result.outcome).toBe("completed");
    const userText = JSON.stringify(calls[0].messages);
    expect(userText).toContain("/couples-guide");
    expect(userText).not.toContain("/grads/");
    expect(systemOf(calls[0])).toContain("COUPLES photography session");
  });

  it("journal: couples voice in the prompt and couples-focused deterministic meta keywords", async () => {
    const sessionId = await createTestSession({ service_type: "couples", school_slug: null });
    const photo = await storedAnalyzedPhoto(sessionId, {
      alt_text: "Couple laughing at Crissy Field", title: "Crissy Field",
      description: "Golden hour", tags: ["couples"], suggested_category: "couples",
    });
    const pkg = await createPackage(sessionId, ["journal_post"], couplesFacts);
    const calls: ModelCallRequest[] = [];
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "journal_post",
      callModel: capturingModel(JSON.stringify({
        title: "Golden Hour Couples Session at Crissy Field",
        slug: "golden-hour-couples-crissy-field",
        body: "A foggy golden hour walk.", meta_description: "Couples session at Crissy Field.",
        photo_ids: [photo.id], cover_photo_id: photo.id,
      }), calls),
    });
    expect(result.outcome).toBe("completed");
    expect(systemOf(calls[0])).toContain("COUPLES photography session");
    expect(systemOf(calls[0])).toMatch(/never mention graduation/i);

    const { data: items } = await service.from("session_content_items")
      .select("payload").eq("package_id", pkg).eq("content_type", "journal_post");
    const kw = items![0].payload.meta_keywords as string;
    expect(kw).toContain("couple photoshoot in San Francisco");
    expect(kw).toContain("Crissy Field couples photoshoot");
    expect(kw).toContain("golden hour couple photos");
    expect(kw).not.toContain("graduation");
  });

  it("grads regression: journal keywords keep the pre-service-aware format and prompt has no couples block", async () => {
    const sessionId = await createTestSession();
    const photo = await storedAnalyzedPhoto(sessionId, {
      alt_text: "Grad at Tower Lawn", title: "Tower Lawn",
      description: "Golden hour", tags: ["sjsu"], suggested_category: "grads",
    });
    const pkg = await createPackage(sessionId, ["journal_post"], {
      service_type: "grads", school_slug: "sjsu", primary_location: "Tower Lawn",
    });
    const calls: ModelCallRequest[] = [];
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "journal_post",
      callModel: capturingModel(JSON.stringify({
        title: "Golden Hour at SJSU", slug: "golden-hour-sjsu",
        body: "A grad session.", meta_description: "Grad session at SJSU.",
        photo_ids: [photo.id], cover_photo_id: photo.id,
      }), calls),
    });
    expect(result.outcome).toBe("completed");
    expect(systemOf(calls[0])).not.toContain("COUPLES photography session");
    expect(systemOf(calls[0])).not.toMatch(/not a graduation session/i);

    const { data: items } = await service.from("session_content_items")
      .select("payload").eq("package_id", pkg).eq("content_type", "journal_post");
    expect(items![0].payload.meta_keywords).toBe("sjsu, Tower Lawn, graduation photos, Bay Area");
  });
});
