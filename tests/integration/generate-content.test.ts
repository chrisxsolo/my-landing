import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { service, resetDb, createTestSession, createTestPhoto, createPackage } from "./helpers";
import { generateContentType, GenerationConflictError } from "@/lib/contentEngine/generateContent";
import { PROMPT_VERSION } from "@/lib/contentEngine/prompts";
import { ORIGINALS_BUCKET } from "@/lib/contentEngine/uploadConfig";
import type { ModelCaller } from "@/lib/contentEngine/aiClient";

beforeAll(() => resetDb());

function fakeModel(text: string): ModelCaller {
  return async (req) => ({
    text, usage: { input_tokens: 800, output_tokens: 300 }, model: req.model,
  });
}

async function analyzedPhoto(sessionId: string, quality = 8) {
  const photo = await createTestPhoto(sessionId);
  await service.from("session_photos").update({
    analysis_status: "completed", quality_score: quality,
    alt_text: "Grad at Tower Lawn", title: "Tower Lawn", description: "Golden hour",
    tags: ["sjsu"], suggested_category: "grads",
  }).eq("id", photo.id);
  return photo;
}

// Like analyzedPhoto, but also uploads a minimal JPEG to the originals bucket
// so journalTarget can downloadOriginal without failing.
async function storedPhoto(sessionId: string, seed = 1, quality = 9) {
  const photo = await createTestPhoto(sessionId);
  const { data: row } = await service.from("session_photos")
    .select("storage_path").eq("id", photo.id).single();
  const buf = await sharp({
    create: { width: 100 + seed, height: 100, channels: 3, background: { r: seed * 30 % 255, g: 100, b: 80 } },
  }).jpeg().toBuffer();
  await service.storage.from(ORIGINALS_BUCKET).upload(row!.storage_path as string, buf, { contentType: "image/jpeg" });
  await service.from("session_photos").update({
    analysis_status: "completed", quality_score: quality,
    alt_text: "Grad at Tower Lawn", title: "Tower Lawn", description: "Golden hour",
    tags: ["sjsu"], suggested_category: "grads",
  }).eq("id", photo.id);
  return photo;
}

async function itemsOf(packageId: string, contentType: string) {
  const { data } = await service.from("session_content_items")
    .select("*").eq("package_id", packageId).eq("content_type", contentType);
  return data ?? [];
}

async function packageState(packageId: string) {
  const { data } = await service.from("session_content_packages")
    .select("status,generation_settings").eq("id", packageId).single();
  return { status: data!.status as string, progress: data!.generation_settings.progress };
}

describe("generateContentType (spec §8.2)", () => {
  it("internal_link_suggestion: model output validated against the closed list, item drafted, usage recorded", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "internal_link_suggestion",
      callModel: fakeModel(JSON.stringify({
        links: [{ url: "/grads/sjsu", label: "SJSU grad sessions", reason: "session school" }],
      })),
    });

    expect(result.outcome).toBe("completed");
    expect(result.packageStatus).toBe("ready");
    const items = await itemsOf(pkg, "internal_link_suggestion");
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("draft");
    expect(items[0].payload.links[0].url).toBe("/grads/sjsu");
    expect(items[0].prompt_version).toBe(PROMPT_VERSION);
    expect(items[0].generation_model).toBe("claude-sonnet-4-6");

    const { progress } = await packageState(pkg);
    expect(progress.internal_link_suggestion.status).toBe("completed");
    expect(progress.internal_link_suggestion.usage.input_tokens).toBe(800);
  });

  it("a non-canonical link FAILS the type and the package needs attention", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "internal_link_suggestion",
      callModel: fakeModel(JSON.stringify({ links: [{ url: "/nope", label: "x", reason: "y" }] })),
    });
    expect(result.outcome).toBe("failed");
    expect(result.error).toMatch(/canonical|validation/i);
    expect(result.packageStatus).toBe("needs_attention");
    expect(await itemsOf(pkg, "internal_link_suggestion")).toHaveLength(0);
  });

  it("a second call for the same type conflicts (no double generation)", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    await generateContentType({
      client: service, packageId: pkg, contentType: "internal_link_suggestion",
      callModel: fakeModel(JSON.stringify({ links: [] })),
    });
    await expect(generateContentType({
      client: service, packageId: pkg, contentType: "internal_link_suggestion",
      callModel: fakeModel(JSON.stringify({ links: [] })),
    })).rejects.toBeInstanceOf(GenerationConflictError);
  });

  it("portfolio_pick: one draft per pick, photo identity enforced, duplicate picks deduped", async () => {
    const sessionId = await createTestSession();
    const a = await analyzedPhoto(sessionId, 9);
    const b = await analyzedPhoto(sessionId, 8);
    const pkg = await createPackage(sessionId, ["portfolio_pick"]);

    const pick = (id: string) => ({
      session_photo_id: id, category: "grads", title: "Pick", alt_text: "Pick alt",
      description: "", featured: false,
    });
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "portfolio_pick",
      callModel: fakeModel(JSON.stringify({ picks: [pick(a.id), pick(b.id), pick(a.id)] })), // dup a
    });
    expect(result.outcome).toBe("completed");
    const items = await itemsOf(pkg, "portfolio_pick");
    expect(items).toHaveLength(2); // dedup by idempotency key
    const keys = items.map((i) => i.idempotency_key);
    expect(new Set(keys).size).toBe(2);
  });

  it("portfolio_pick: a foreign photo id fails the type", async () => {
    const sessionId = await createTestSession();
    await analyzedPhoto(sessionId);
    const pkg = await createPackage(sessionId, ["portfolio_pick"]);
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "portfolio_pick",
      callModel: fakeModel(JSON.stringify({
        picks: [{ session_photo_id: randomUUID(), category: "grads", title: "", alt_text: "x",
                  description: "", featured: false }],
      })),
    });
    expect(result.outcome).toBe("failed");
    expect(result.error).toMatch(/unknown photo/i);
  });

  it("school_page_photo: placements draft against the session school", async () => {
    const sessionId = await createTestSession({ school_slug: "sjsu" });
    const photo = await analyzedPhoto(sessionId);
    // Pass school_slug in facts so the snapshot has it (canonical generation input, spec §8.3)
    const pkg = await createPackage(sessionId, ["school_page_photo"], { service_type: "grads", school_slug: "sjsu" });
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "school_page_photo",
      callModel: fakeModel(JSON.stringify({
        placements: [{ session_photo_id: photo.id, school_slug: "sjsu", alt_override: "",
                       caption: "Tower Lawn", sort_order: 1 }],
      })),
    });
    expect(result.outcome).toBe("completed");
    const items = await itemsOf(pkg, "school_page_photo");
    expect(items).toHaveLength(1);
    expect(items[0].payload.school_slug).toBe("sjsu");
  });

  it("school_page_photo: skipped when the session has no school", async () => {
    const sessionId = await createTestSession({ school_slug: null });
    await analyzedPhoto(sessionId);
    const pkg = await createPackage(sessionId, ["school_page_photo"]);
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "school_page_photo",
      callModel: fakeModel("{}"),
    });
    expect(result.outcome).toBe("skipped");
    expect(result.packageStatus).toBe("ready"); // skipped counts as terminal-good
  });

  it("guide_photo: empty placements complete with zero items; non-guide service is skipped", async () => {
    const famSession = await createTestSession({ service_type: "families" });
    await analyzedPhoto(famSession);
    // Pass service_type in facts so the snapshot reflects it
    const famPkg = await createPackage(famSession, ["guide_photo"], { service_type: "families" });
    const empty = await generateContentType({
      client: service, packageId: famPkg, contentType: "guide_photo",
      callModel: fakeModel(JSON.stringify({ placements: [] })),
    });
    expect(empty.outcome).toBe("completed");
    expect(await itemsOf(famPkg, "guide_photo")).toHaveLength(0);

    const gradSession = await createTestSession({ service_type: "grads" });
    await analyzedPhoto(gradSession);
    const gradPkg = await createPackage(gradSession, ["guide_photo"], { service_type: "grads" });
    const skipped = await generateContentType({
      client: service, packageId: gradPkg, contentType: "guide_photo",
      callModel: fakeModel("{}"),
    });
    expect(skipped.outcome).toBe("skipped");
  });

  it("testimonial_feature: deterministic email match; skipped when no candidate", async () => {
    const email = `mia-${Date.now()}@example.com`;
    const { data: cs } = await service.from("client_sessions")
      .insert({ client_email: email, current_status: "delivered" }).select("id").single();
    const sessionId = await createTestSession({ client_session_id: cs!.id });
    const { data: t } = await service.from("testimonials").insert({
      first_name: "Mia", last_name: "R", email,
      message: "Chris made the whole session feel easy and fun from start to finish!",
      consent_to_marketing: true, status: "approved",
    }).select("id").single();

    const pkg = await createPackage(sessionId, ["testimonial_feature"]);
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "testimonial_feature",
      callModel: fakeModel("{}"), // never called — deterministic target
    });
    expect(result.outcome).toBe("completed");
    const items = await itemsOf(pkg, "testimonial_feature");
    expect(items).toHaveLength(1);
    expect(items[0].payload.testimonial_id).toBe(t!.id);
    expect(items[0].payload.quote_excerpt.length).toBeGreaterThan(0);

    const lonely = await createTestSession(); // no client session link
    const lonelyPkg = await createPackage(lonely, ["testimonial_feature"]);
    const none = await generateContentType({
      client: service, packageId: lonelyPkg, contentType: "testimonial_feature",
      callModel: fakeModel("{}"),
    });
    expect(none.outcome).toBe("skipped");
  });

  it("journal_post: weaves prior link + testimonial items, deterministic meta_keywords, package → ready", async () => {
    const email = `leo-${Date.now()}@example.com`;
    const { data: cs } = await service.from("client_sessions")
      .insert({ client_email: email, current_status: "delivered" }).select("id").single();
    const sessionId = await createTestSession({
      client_session_id: cs!.id, school_slug: "sjsu",
    });
    await service.from("testimonials").insert({
      first_name: "Leo", last_name: "M", email,
      message: "An amazing experience — the photos came out better than we hoped!",
      consent_to_marketing: true, status: "approved",
    });
    const photo = await storedPhoto(sessionId, 1, 9);
    // Pass school_slug in facts so deterministicKeywords includes it (spec §9.3)
    const pkg = await createPackage(sessionId,
      ["internal_link_suggestion", "testimonial_feature", "journal_post"],
      { service_type: "grads", school_slug: "sjsu" });

    await generateContentType({
      client: service, packageId: pkg, contentType: "internal_link_suggestion",
      callModel: fakeModel(JSON.stringify({
        links: [{ url: "/grads/sjsu", label: "SJSU grad sessions", reason: "school page" }],
      })),
    });
    await generateContentType({
      client: service, packageId: pkg, contentType: "testimonial_feature",
      callModel: fakeModel("{}"),
    });
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "journal_post",
      callModel: fakeModel(JSON.stringify({
        title: "Golden Hour at SJSU", slug: `golden-hour-sjsu-${Date.now()}`,
        body: "Para one.\n\nPara two.", meta_description: "A golden hour grad session at SJSU.",
        photo_ids: [photo.id], cover_photo_id: photo.id,
      })),
    });

    expect(result.outcome).toBe("completed");
    expect(result.packageStatus).toBe("ready");
    const items = await itemsOf(pkg, "journal_post");
    expect(items).toHaveLength(1);
    const payload = items[0].payload;
    expect(payload.internal_links).toEqual([{ url: "/grads/sjsu", label: "SJSU grad sessions" }]);
    expect(payload.testimonial_id).not.toBeNull();
    expect(payload.meta_keywords).toContain("Bay Area");
    expect(payload.meta_keywords.toLowerCase()).toContain("graduation");
  });

  it("journal_post fails cleanly when no analyzed photos exist", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "journal_post",
      callModel: fakeModel("{}"),
    });
    expect(result.outcome).toBe("failed");
    expect(result.error).toMatch(/no analyzed photos/i);
  });
});
