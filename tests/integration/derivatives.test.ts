import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { service, resetDb, createTestSession, ensurePublicBucket } from "./helpers";
import { finalizeUpload } from "@/lib/contentEngine/finalizeUpload";
import { ORIGINALS_BUCKET, issueUploadPath } from "@/lib/contentEngine/uploadConfig";
import {
  prepareApprovedDerivatives, photoIdsFromPayload, DerivativeError,
  PUBLIC_DERIVATIVES_BUCKET,
} from "@/lib/contentEngine/derivatives";

beforeAll(async () => {
  resetDb();
  await ensurePublicBucket(PUBLIC_DERIVATIVES_BUCKET);
});

// Unique real bytes (seed varies dimensions — JPEG quantization collapses
// near-identical solid colors to identical bytes).
async function realPhoto(sessionId: string, seed: number) {
  const buf = await sharp({
    create: { width: 400 + seed * 2, height: 300, channels: 3, background: { r: (seed * 37) % 255, g: 90, b: 60 } },
  }).jpeg().toBuffer();
  const path = issueUploadPath(sessionId, "image/jpeg");
  const { error } = await service.storage.from(ORIGINALS_BUCKET).upload(path, buf, { contentType: "image/jpeg" });
  if (error) throw error;
  return finalizeUpload({
    client: service, sessionId, storagePath: path,
    declared: { filename: `d${seed}.jpg`, mime: "image/jpeg", sizeBytes: buf.length, contentHash: "" },
  });
}

async function approvedItem(sessionId: string, contentType: string, payload: Record<string, unknown>) {
  const { data: pkg, error: pErr } = await service.rpc("create_content_package", {
    p_session_id: sessionId, p_model_name: "claude-sonnet-4-6", p_prompt_version: "v1",
    p_selected_types: [contentType === "portfolio_pick" ? "portfolio_pick" : "journal_post"],
    p_session_facts: { service_type: "grads" }, p_generation_settings: {},
    p_archive_current: true, p_copy_items: [], // archive prior package: tests reuse sessions
  });
  if (pErr) throw pErr;
  const { data, error } = await service.from("session_content_items").insert({
    package_id: pkg, content_type: contentType, status: "approved", payload,
    approved_at: new Date().toISOString(), approved_by: "test",
    idempotency_key: `deriv:${pkg}:${contentType}:${Math.random()}`,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

describe("photoIdsFromPayload", () => {
  it("extracts ids per content type", () => {
    expect(photoIdsFromPayload("journal_post", { photo_ids: ["a", "b"], cover_photo_id: "a" }))
      .toEqual(["a", "b"]);
    expect(photoIdsFromPayload("portfolio_pick", { session_photo_id: "x" })).toEqual(["x"]);
    expect(photoIdsFromPayload("school_page_photo", { session_photo_id: "y" })).toEqual(["y"]);
    expect(photoIdsFromPayload("guide_photo", { session_photo_id: "z" })).toEqual(["z"]);
    expect(photoIdsFromPayload("testimonial_feature", { testimonial_id: "t" })).toEqual([]);
    expect(photoIdsFromPayload("internal_link_suggestion", { links: [] })).toEqual([]);
  });
});

describe("prepareApprovedDerivatives (spec §4.3)", () => {
  it("builds a content-addressed public derivative and records it on the photo", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 1);
    const item = await approvedItem(sessionId, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "t", alt_text: "a", description: "", featured: false,
    });

    const results = await prepareApprovedDerivatives({ client: service, itemId: item });
    expect(results).toHaveLength(1);
    expect(results[0].reused).toBe(false);
    expect(results[0].url).toContain(`engine/${sessionId}/${photo.id}/${photo.content_hash}.jpg`);

    const { data: row } = await service.from("session_photos")
      .select("public_derivative_url,public_derivative_storage_path,public_derivative_content_hash,public_derivative_created_at")
      .eq("id", photo.id).single();
    expect(row!.public_derivative_url).toBe(results[0].url);
    expect(row!.public_derivative_storage_path).toBe(`engine/${sessionId}/${photo.id}/${photo.content_hash}.jpg`);
    expect(row!.public_derivative_content_hash).toBe(photo.content_hash);
    expect(row!.public_derivative_created_at).not.toBeNull();

    // the object is genuinely in the public bucket and is a valid JPEG with no EXIF
    const { data: blob } = await service.storage.from(PUBLIC_DERIVATIVES_BUCKET)
      .download(`engine/${sessionId}/${photo.id}/${photo.content_hash}.jpg`);
    const meta = await sharp(Buffer.from(await blob!.arrayBuffer())).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined(); // metadata stripped (spec §4.3: incl. GPS)
  });

  it("is idempotent: a second run reuses the existing derivative", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 2);
    const item = await approvedItem(sessionId, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "", alt_text: "a", description: "", featured: false,
    });
    const first = await prepareApprovedDerivatives({ client: service, itemId: item });
    const second = await prepareApprovedDerivatives({ client: service, itemId: item });
    expect(first[0].reused).toBe(false);
    expect(second[0].reused).toBe(true);
    expect(second[0].url).toBe(first[0].url);
  });

  it("covers every journal photo (cover + extras), deduplicated", async () => {
    const sessionId = await createTestSession();
    const a = await realPhoto(sessionId, 3);
    const b = await realPhoto(sessionId, 4);
    const item = await approvedItem(sessionId, "journal_post", {
      title: "T", slug: `deriv-journal-${Date.now()}`, body: "B", meta_description: "", meta_keywords: "",
      photo_ids: [a.id, b.id], cover_photo_id: a.id, internal_links: [], testimonial_id: null,
    });
    const results = await prepareApprovedDerivatives({ client: service, itemId: item });
    expect(results).toHaveLength(2);
    expect(new Set(results.map((r) => r.photoId))).toEqual(new Set([a.id, b.id]));
  });

  it("rejects unapproved items, missing permission, and foreign photos", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 5);

    // draft item
    const draft = await approvedItem(sessionId, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "", alt_text: "a", description: "", featured: false,
    });
    await service.from("session_content_items").update({ status: "draft", approved_at: null }).eq("id", draft);
    await expect(prepareApprovedDerivatives({ client: service, itemId: draft }))
      .rejects.toMatchObject({ kind: "not_approved" });

    // marketing permission off
    const noPerm = await createTestSession({ marketing_permission: false });
    const photo2 = await realPhoto(noPerm, 6);
    const item2 = await approvedItem(noPerm, "portfolio_pick", {
      session_photo_id: photo2.id, category: "grads", title: "", alt_text: "a", description: "", featured: false,
    });
    await expect(prepareApprovedDerivatives({ client: service, itemId: item2 }))
      .rejects.toMatchObject({ kind: "permission" });

    // payload referencing another session's photo
    const other = await createTestSession();
    const foreign = await realPhoto(other, 7);
    const item3 = await approvedItem(sessionId, "portfolio_pick", {
      session_photo_id: foreign.id, category: "grads", title: "", alt_text: "a", description: "", featured: false,
    });
    await expect(prepareApprovedDerivatives({ client: service, itemId: item3 }))
      .rejects.toMatchObject({ kind: "foreign_photo" });
  });

  it("returns [] for photo-less content types without touching storage", async () => {
    const sessionId = await createTestSession();
    const item = await approvedItem(sessionId, "internal_link_suggestion", {
      links: [{ url: "/pricing", label: "Pricing", reason: "r" }],
    });
    expect(await prepareApprovedDerivatives({ client: service, itemId: item })).toEqual([]);
  });
});
