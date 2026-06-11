import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { service, resetDb, createTestSession, createPackage, createItem, ensurePublicBucket } from "./helpers";
import { finalizeUpload } from "@/lib/contentEngine/finalizeUpload";
import { ORIGINALS_BUCKET, issueUploadPath } from "@/lib/contentEngine/uploadConfig";
import { PUBLIC_DERIVATIVES_BUCKET } from "@/lib/contentEngine/derivatives";
import { publishApprovedItem } from "@/lib/contentEngine/publishItem";

beforeAll(async () => {
  resetDb();
  await ensurePublicBucket(PUBLIC_DERIVATIVES_BUCKET);
});

async function realPhoto(sessionId: string, seed: number) {
  const buf = await sharp({
    create: { width: 500 + seed * 2, height: 320, channels: 3, background: { r: (seed * 53) % 255, g: 70, b: 110 } },
  }).jpeg().toBuffer();
  const path = issueUploadPath(sessionId, "image/jpeg");
  const { error } = await service.storage.from(ORIGINALS_BUCKET).upload(path, buf, { contentType: "image/jpeg" });
  if (error) throw error;
  const row = await finalizeUpload({
    client: service, sessionId, storagePath: path,
    declared: { filename: `p${seed}.jpg`, mime: "image/jpeg", sizeBytes: buf.length, contentHash: "" },
  });
  await service.from("session_photos").update({ alt_text: `Alt ${seed}`, analysis_status: "completed" }).eq("id", row.id);
  return row;
}

function trackingRevalidate() {
  const calls: string[] = [];
  return { calls, fn: (path: string) => { calls.push(path); } };
}

describe("publishApprovedItem (spec §9.1 A→B→C)", () => {
  it("publishes a journal end-to-end: derivative + blog row + library rows + targeted revalidation", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 1);
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const slug = `publish-flow-${Date.now()}`;
    const item = await createItem(pkg, "journal_post", {
      title: "Publish Flow", slug, body: "Body.", meta_description: "d", meta_keywords: "k",
      photo_ids: [photo.id], cover_photo_id: photo.id, internal_links: [], testimonial_id: null,
    }, "approved");

    const tracker = trackingRevalidate();
    const outcome = await publishApprovedItem({ client: service, itemId: item, revalidate: tracker.fn });

    expect(outcome.status).toBe("published");
    if (outcome.status !== "published") throw new Error("unreachable");
    expect(outcome.targetType).toBe("blog_post");
    expect(tracker.calls).toEqual(["/blog", `/blog/${slug}`]);
    expect(outcome.revalidationFailures).toEqual([]);

    const { data: post } = await service.from("blog_posts")
      .select("id,cover_image_url").eq("slug", slug).single();
    expect(post!.cover_image_url).toContain(`engine/${sessionId}/${photo.id}/`); // derivative, not original
    const { data: row } = await service.from("session_content_items")
      .select("status,published_target_type").eq("id", item).single();
    expect(row!.status).toBe("published");
  });

  it("Step-C failure is recoverable: item STAYS published, failures reported", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 2);
    const pkg = await createPackage(sessionId, ["portfolio_pick"]);
    await service.from("portfolio_categories").upsert({ slug: "grads", name: "grads" }, { onConflict: "slug" });
    const item = await createItem(pkg, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "T", alt_text: "A", description: "", featured: false,
    }, "approved");

    const outcome = await publishApprovedItem({
      client: service, itemId: item,
      revalidate: () => { throw new Error("revalidation backend down"); },
    });
    expect(outcome.status).toBe("published");
    if (outcome.status !== "published") throw new Error("unreachable");
    expect(outcome.revalidationFailures).toEqual(["/portfolio"]);
    const { data: row } = await service.from("session_content_items").select("status").eq("id", item).single();
    expect(row!.status).toBe("published"); // never flipped back (spec §9.1 Step C)
  });

  it("guard rejections are 'blocked' and leave the item untouched", async () => {
    const sessionId = await createTestSession({ marketing_permission: false });
    const photo = await realPhoto(sessionId, 3);
    const pkg = await createPackage(sessionId, ["portfolio_pick"]);
    const item = await createItem(pkg, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "", alt_text: "a", description: "", featured: false,
    }, "approved");

    const outcome = await publishApprovedItem({ client: service, itemId: item, revalidate: () => {} });
    expect(outcome.status).toBe("blocked");
    const { data: row } = await service.from("session_content_items").select("status,error").eq("id", item).single();
    expect(row!.status).toBe("approved");
    expect(row!.error).toBeNull();
  });

  it("a genuine Step-B failure records status=failed with the error (draft preserved)", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 4);
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const slug = `conflict-${Date.now()}`;
    await service.from("blog_posts").insert({
      title: "Existing", body: "x", slug, category: "professional",
      sites: ["professional"], published_at: new Date().toISOString(),
    });
    const item = await createItem(pkg, "journal_post", {
      title: "Conflict", slug, body: "B", meta_description: "", meta_keywords: "",
      photo_ids: [photo.id], cover_photo_id: photo.id, internal_links: [], testimonial_id: null,
    }, "approved");

    const outcome = await publishApprovedItem({ client: service, itemId: item, revalidate: () => {} });
    expect(outcome.status).toBe("failed");
    const { data: row } = await service.from("session_content_items").select("status,error").eq("id", item).single();
    expect(row!.status).toBe("failed");
    expect(row!.error).toMatch(/slug/i);
  });
});
