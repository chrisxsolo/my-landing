import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto, createPackage, createItem } from "./helpers";
import { buildReconcileReport, linkItemToExistingTarget, markStuckItemFailed } from "@/lib/contentEngine/reconcile";
import { PUBLISHING_LEASE_MS } from "@/lib/contentEngine/state";

beforeAll(() => resetDb());

describe("buildReconcileReport (spec §9.4)", () => {
  it("reports items stuck publishing past the lease", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const stuck = await createItem(pkg, "internal_link_suggestion", { links: [] }, "approved");
    await service.from("session_content_items").update({
      status: "publishing",
      publishing_started_at: new Date(Date.now() - PUBLISHING_LEASE_MS - 60_000).toISOString(),
    }).eq("id", stuck);
    const live = await createItem(pkg, "internal_link_suggestion", {
      links: [{ url: "/pricing", label: "P", reason: "r" }],
    }, "approved");
    await service.from("session_content_items").update({
      status: "publishing", publishing_started_at: new Date().toISOString(),
    }).eq("id", live);

    const report = await buildReconcileReport({ client: service, sessionId });
    expect(report.stuckPublishing.map((s) => s.itemId)).toContain(stuck);
    expect(report.stuckPublishing.map((s) => s.itemId)).not.toContain(live);
  });

  it("detects a failed portfolio item whose target exists by content hash (auto-confirmable)", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId); // helper provides derivative + hash
    const pkg = await createPackage(sessionId, ["portfolio_pick"]);
    const item = await createItem(pkg, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "", alt_text: "a", description: "", featured: false,
    }, "approved");
    await service.from("session_content_items").update({ status: "failed", error: "interrupted" }).eq("id", item);
    const { data: existing } = await service.from("portfolio_images").insert({
      title: "Existing", alt: "Existing", image_url: photo.public_derivative_url!,
      category_slug: "grads", featured: false, sort_order: 1, content_hash: photo.content_hash,
    }).select("id").single();

    const report = await buildReconcileReport({ client: service, sessionId });
    const match = report.failedWithExistingTarget.find((m) => m.itemId === item);
    expect(match).toBeTruthy();
    expect(match!.targetType).toBe("portfolio_image");
    expect(match!.targetId).toBe(String(existing!.id));
    expect(match!.autoConfirmable).toBe(true); // hash proof
  });

  it("detects a failed journal item by slug match (manual confirmation required)", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const slug = `reconcile-slug-${Date.now()}`;
    await service.from("blog_posts").insert({
      title: "Existing", body: "x", slug, category: "professional",
      sites: ["professional"], published_at: new Date().toISOString(),
    });
    const item = await createItem(pkg, "journal_post", {
      title: "T", slug, body: "B", meta_description: "", meta_keywords: "",
      photo_ids: [photo.id], cover_photo_id: photo.id, internal_links: [], testimonial_id: null,
    }, "approved");
    await service.from("session_content_items").update({ status: "failed", error: "interrupted" }).eq("id", item);

    const report = await buildReconcileReport({ client: service, sessionId });
    const match = report.failedWithExistingTarget.find((m) => m.itemId === item);
    expect(match!.targetType).toBe("blog_post");
    expect(match!.autoConfirmable).toBe(false); // slug alone is not proof of provenance (spec §9.2)
  });

  it("reports orphaned derivatives (derivative present, zero live references)", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId); // derivative URL set, nothing live references it
    const report = await buildReconcileReport({ client: service, sessionId });
    expect(report.orphanedDerivatives.map((o) => o.photoId)).toContain(photo.id);
  });
});

describe("reconcile actions", () => {
  it("links a failed item to its existing target with proof re-verified", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId, ["portfolio_pick"]);
    const item = await createItem(pkg, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads", title: "", alt_text: "a", description: "", featured: false,
    }, "approved");
    await service.from("session_content_items").update({ status: "failed", error: "x" }).eq("id", item);
    const { data: target } = await service.from("portfolio_images").insert({
      title: "E", alt: "E", image_url: photo.public_derivative_url!,
      category_slug: "grads", featured: false, sort_order: 2, content_hash: photo.content_hash,
    }).select("id").single();

    const result = await linkItemToExistingTarget({
      client: service, itemId: item, targetType: "portfolio_image", targetId: String(target!.id),
    });
    expect(result.linked).toBe(true);
    const { data: row } = await service.from("session_content_items")
      .select("status,published_target_type,published_target_id,published_at,error").eq("id", item).single();
    expect(row!.status).toBe("published");
    expect(row!.published_target_type).toBe("portfolio_image");
    expect(row!.published_target_id).toBe(String(target!.id));
    expect(row!.error).toBeNull();
  });

  it("refuses to link a blog slug match without confirm, accepts with confirm", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const slug = `link-slug-${Date.now()}`;
    const { data: post } = await service.from("blog_posts").insert({
      title: "E", body: "x", slug, category: "professional",
      sites: ["professional"], published_at: new Date().toISOString(),
    }).select("id").single();
    const item = await createItem(pkg, "journal_post", {
      title: "T", slug, body: "B", meta_description: "", meta_keywords: "",
      photo_ids: [photo.id], cover_photo_id: photo.id, internal_links: [], testimonial_id: null,
    }, "approved");
    await service.from("session_content_items").update({ status: "failed", error: "x" }).eq("id", item);

    await expect(linkItemToExistingTarget({
      client: service, itemId: item, targetType: "blog_post", targetId: String(post!.id),
    })).rejects.toThrow(/confirm/i);

    const result = await linkItemToExistingTarget({
      client: service, itemId: item, targetType: "blog_post", targetId: String(post!.id), confirm: true,
    });
    expect(result.linked).toBe(true);
  });

  it("marks a stuck publishing item failed (resume path)", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", { links: [] }, "approved");
    await service.from("session_content_items").update({
      status: "publishing",
      publishing_started_at: new Date(Date.now() - PUBLISHING_LEASE_MS - 60_000).toISOString(),
    }).eq("id", item);

    const result = await markStuckItemFailed({ client: service, itemId: item });
    expect(result.marked).toBe(true);
    const { data: row } = await service.from("session_content_items")
      .select("status,error").eq("id", item).single();
    expect(row!.status).toBe("failed");
    expect(row!.error).toMatch(/interrupted/i);

    // a LIVE publishing item is protected
    const live = await createItem(pkg, "internal_link_suggestion", {
      links: [{ url: "/pricing", label: "P", reason: "r" }],
    }, "approved");
    await service.from("session_content_items").update({
      status: "publishing", publishing_started_at: new Date().toISOString(),
    }).eq("id", live);
    await expect(markStuckItemFailed({ client: service, itemId: live })).rejects.toThrow(/still within|live/i);
  });
});
