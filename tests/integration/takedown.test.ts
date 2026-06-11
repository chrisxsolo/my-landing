import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { service, resetDb, createTestSession, createPackage, createItem, ensurePublicBucket } from "./helpers";
import { finalizeUpload } from "@/lib/contentEngine/finalizeUpload";
import { ORIGINALS_BUCKET, issueUploadPath } from "@/lib/contentEngine/uploadConfig";
import { PUBLIC_DERIVATIVES_BUCKET } from "@/lib/contentEngine/derivatives";
import { publishApprovedItem } from "@/lib/contentEngine/publishItem";
import { takedownPublishedItem } from "@/lib/contentEngine/takedown";

beforeAll(async () => {
  resetDb();
  await ensurePublicBucket(PUBLIC_DERIVATIVES_BUCKET);
  await service.from("portfolio_categories").upsert({ slug: "grads", name: "grads" }, { onConflict: "slug" });
});

async function realPhoto(sessionId: string, seed: number) {
  const buf = await sharp({
    create: { width: 600 + seed * 2, height: 360, channels: 3, background: { r: (seed * 71) % 255, g: 50, b: 140 } },
  }).jpeg().toBuffer();
  const path = issueUploadPath(sessionId, "image/jpeg");
  const { error } = await service.storage.from(ORIGINALS_BUCKET).upload(path, buf, { contentType: "image/jpeg" });
  if (error) throw error;
  const row = await finalizeUpload({
    client: service, sessionId, storagePath: path,
    declared: { filename: `t${seed}.jpg`, mime: "image/jpeg", sizeBytes: buf.length, contentHash: "" },
  });
  await service.from("session_photos").update({ alt_text: `Alt ${seed}`, analysis_status: "completed" }).eq("id", row.id);
  return row;
}

async function publishItemOfType(sessionId: string, contentType: string, payload: Record<string, unknown>, selected: string) {
  const pkg = await createPackage(sessionId, [selected], undefined, true); // archive prior package: helper publishes several items per session
  const item = await createItem(pkg, contentType, payload, "approved");
  const outcome = await publishApprovedItem({ client: service, itemId: item, revalidate: () => {} });
  expect(outcome.status).toBe("published");
  return item;
}

async function derivativeExists(storagePath: string) {
  const { data } = await service.storage.from(PUBLIC_DERIVATIVES_BUCKET).download(storagePath);
  return data !== null;
}

describe("takedownPublishedItem (spec §7.3 + §4.3 shared-derivative rule)", () => {
  it("journal takedown deletes the post + its image_library rows and the now-unreferenced derivative", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 1);
    const slug = `takedown-journal-${Date.now()}`;
    const item = await publishItemOfType(sessionId, "journal_post", {
      title: "T", slug, body: "B", meta_description: "", meta_keywords: "",
      photo_ids: [photo.id], cover_photo_id: photo.id, internal_links: [], testimonial_id: null,
    }, "journal_post");

    const result = await takedownPublishedItem({ client: service, itemId: item, revalidate: () => {} });
    expect(result.removed).toBe(true);

    const { count: posts } = await service.from("blog_posts")
      .select("id", { count: "exact", head: true }).eq("slug", slug);
    expect(posts).toBe(0);
    const { data: photoRow } = await service.from("session_photos")
      .select("public_derivative_url,public_derivative_storage_path").eq("id", photo.id).single();
    expect(photoRow!.public_derivative_url).toBeNull(); // unreferenced derivative removed

    const { data: itemRow } = await service.from("session_content_items")
      .select("status,published_ref").eq("id", item).single();
    expect(itemRow!.status).toBe("published"); // history preserved
    expect(itemRow!.published_ref.taken_down_at).toBeTruthy();
  });

  it("shared derivative survives when another live placement still references the photo", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 2);

    // publish the SAME photo to portfolio AND a school page
    const portfolioItem = await publishItemOfType(sessionId, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "P", alt_text: "A", description: "", featured: false,
    }, "portfolio_pick");
    await publishItemOfType(sessionId, "school_page_photo", {
      session_photo_id: photo.id, school_slug: "sjsu", alt_override: "", caption: "", sort_order: 0,
    }, "school_page_photo");

    const { data: before } = await service.from("session_photos")
      .select("public_derivative_storage_path").eq("id", photo.id).single();

    // take down only the portfolio placement
    const result = await takedownPublishedItem({ client: service, itemId: portfolioItem, revalidate: () => {} });
    expect(result.removed).toBe(true);
    expect(result.derivativesDeleted).toEqual([]); // school placement still references it

    expect(await derivativeExists(before!.public_derivative_storage_path)).toBe(true);
    const { data: photoRow } = await service.from("session_photos")
      .select("public_derivative_url").eq("id", photo.id).single();
    expect(photoRow!.public_derivative_url).not.toBeNull();
  });

  it("school takedown deactivates (active=false) instead of deleting", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 3);
    const item = await publishItemOfType(sessionId, "school_page_photo", {
      session_photo_id: photo.id, school_slug: "sjsu", alt_override: "", caption: "", sort_order: 0,
    }, "school_page_photo");

    await takedownPublishedItem({ client: service, itemId: item, revalidate: () => {} });
    const { data: rows } = await service.from("school_page_photos")
      .select("active").eq("session_photo_id", photo.id);
    expect(rows!.every((r) => r.active === false)).toBe(true);
    expect(rows!.length).toBeGreaterThan(0); // row preserved, deactivated
  });

  it("testimonial takedown unlinks without touching the testimonial row", async () => {
    const sessionId = await createTestSession();
    const { data: t } = await service.from("testimonials").insert({
      first_name: "Mia", last_name: "R", message: "An absolutely wonderful experience all around!",
      consent_to_marketing: true, status: "approved",
    }).select("id").single();
    const item = await publishItemOfType(sessionId, "testimonial_feature",
      { testimonial_id: t!.id, quote_excerpt: "wonderful" }, "testimonial_feature");

    await takedownPublishedItem({ client: service, itemId: item, revalidate: () => {} });
    const { data: after } = await service.from("testimonials")
      .select("photography_session_id,message").eq("id", t!.id).single();
    expect(after!.photography_session_id).toBeNull();
    expect(after!.message).toContain("wonderful");
  });

  it("refuses items that are not published", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", { links: [] }, "draft");
    await expect(takedownPublishedItem({ client: service, itemId: item, revalidate: () => {} }))
      .rejects.toThrow(/not published/i);
  });
});
