import { describe, it, expect, beforeAll } from "vitest";
import { service, anon, resetDb, createTestSession, createTestPhoto, createPackage, createItem, publish } from "./helpers";

beforeAll(() => resetDb());

function journalPayload(photo: { id: string }) {
  return {
    title: "Golden Hour at SJSU",
    slug: `golden-hour-sjsu-${Date.now()}`,
    body: "Para one.\n\nPara two.",
    meta_description: "Grad session at SJSU.",
    meta_keywords: "sjsu, graduation photos",
    photo_ids: [photo.id],
    cover_photo_id: photo.id,
    internal_links: [{ url: "/grads/sjsu", label: "SJSU grad sessions" }],
    testimonial_id: null,
  };
}

describe("publish_session_content_item guards", () => {
  it("rejects when marketing_permission is false and leaves the item approved", async () => {
    const sessionId = await createTestSession({ marketing_permission: false });
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId);
    const item = await createItem(pkg, "journal_post", journalPayload(photo));

    const { error } = await publish(item);
    expect(error?.message).toMatch(/marketing permission/i);
    const { data } = await service.from("session_content_items").select("status").eq("id", item).single();
    expect(data!.status).toBe("approved"); // transaction rolled back, claim undone
  });

  it("rejects items that are not approved", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId);
    const item = await createItem(pkg, "journal_post", journalPayload(photo), "draft");
    const { error } = await publish(item);
    expect(error?.message).toMatch(/not approved/i);
  });

  it("rejects a second publication of the same item", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId);
    const item = await createItem(pkg, "journal_post", journalPayload(photo));
    const first = await publish(item);
    expect(first.error).toBeNull();
    const second = await publish(item);
    expect(second.error?.message).toMatch(/already published|not approved/i);
  });

  it("concurrent publishes: exactly one wins", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId);
    const payload = journalPayload(photo); // build ONCE — slug must be stable
    const item = await createItem(pkg, "journal_post", payload);
    const results = await Promise.allSettled([publish(item), publish(item)]);
    const successes = results.filter(
      (r) => r.status === "fulfilled" && !(r.value as { error: unknown }).error,
    );
    expect(successes).toHaveLength(1);
    const { count } = await service
      .from("blog_posts").select("id", { count: "exact", head: true })
      .eq("slug", payload.slug);
    expect(count).toBe(1);
  });

  it("slug conflict rolls back everything — no blog row, item still approved", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId);
    const payload = journalPayload(photo);
    await service.from("blog_posts").insert({
      title: "Existing", body: "x", slug: payload.slug, category: "professional",
      sites: ["professional"], published_at: new Date().toISOString(),
    });
    const item = await createItem(pkg, "journal_post", payload);
    const { error } = await publish(item);
    expect(error?.message).toMatch(/slug/i);
    const { data } = await service.from("session_content_items")
      .select("status,published_target_id").eq("id", item).single();
    expect(data!.status).toBe("approved");
    expect(data!.published_target_id).toBeNull();
  });

  it("missing public derivative is rejected (Step A must run first)", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId, { derivative: false });
    const pkg = await createPackage(sessionId);
    const item = await createItem(pkg, "journal_post", journalPayload(photo));
    const { error } = await publish(item);
    expect(error?.message).toMatch(/derivative/i);
  });

  it("RPCs are not executable by anon (PUBLIC/authenticated covered by _verify.sql)", async () => {
    // The authoritative privilege checks (PUBLIC via aclexplode, anon and
    // authenticated via has_function_privilege, pinned search_path) run in
    // 20260611000008_..._verify.sql on every db reset. This is the
    // behavioral double-check through the API surface:
    const { error: anonErr } = await anon.rpc("publish_session_content_item", {
      p_item_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(anonErr).not.toBeNull(); // permission denied for function
    expect(String(anonErr!.message)).toMatch(/permission denied|not.*exist/i);
  });
});
