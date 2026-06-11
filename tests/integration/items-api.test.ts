import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createPackage, createItem } from "./helpers";
import { applyAutosave, applyStatusAction } from "@/lib/contentEngine/itemTransitions";

beforeAll(() => resetDb());

const LINKS = { links: [{ url: "/pricing", label: "Pricing", reason: "r" }] };
const LINKS2 = { links: [{ url: "/grads/sjsu", label: "SJSU", reason: "r2" }] };

describe("applyAutosave (payload_revision optimistic concurrency, spec §7.4)", () => {
  it("saves with the matching revision and bumps it", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", LINKS, "draft");

    const result = await applyAutosave({ client: service, itemId: item, payload: LINKS2, expectedRevision: 1 });
    expect(result.outcome).toBe("saved");
    if (result.outcome !== "saved") throw new Error("unreachable");
    expect(result.payloadRevision).toBe(2);

    const { data: row } = await service.from("session_content_items")
      .select("payload,payload_revision").eq("id", item).single();
    expect(row!.payload_revision).toBe(2);
    expect(row!.payload.links[0].url).toBe("/grads/sjsu");
  });

  it("a stale revision conflicts (409 semantics) and returns the server copy", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", LINKS, "draft");

    await applyAutosave({ client: service, itemId: item, payload: LINKS2, expectedRevision: 1 });
    const stale = await applyAutosave({ client: service, itemId: item, payload: LINKS, expectedRevision: 1 });
    expect(stale.outcome).toBe("conflict");
    if (stale.outcome !== "conflict") throw new Error("unreachable");
    expect(stale.server.payload_revision).toBe(2);
    expect(stale.server.payload.links[0].url).toBe("/grads/sjsu");
  });

  it("rejects an invalid payload (Zod, closed lists) without writing", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", LINKS, "draft");

    const bad = await applyAutosave({
      client: service, itemId: item,
      payload: { links: [{ url: "/nope", label: "x", reason: "y" }] }, expectedRevision: 1,
    });
    expect(bad.outcome).toBe("invalid");
    const { data: row } = await service.from("session_content_items")
      .select("payload_revision").eq("id", item).single();
    expect(row!.payload_revision).toBe(1);
  });

  it("editing an APPROVED item reverts it to draft (re-review required)", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", LINKS, "approved");

    const result = await applyAutosave({ client: service, itemId: item, payload: LINKS2, expectedRevision: 1 });
    expect(result.outcome).toBe("saved");
    const { data: row } = await service.from("session_content_items")
      .select("status,approved_at").eq("id", item).single();
    expect(row!.status).toBe("draft");
    expect(row!.approved_at).toBeNull();
  });

  it("refuses to edit published or publishing items", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", LINKS, "approved");
    await service.from("session_content_items")
      .update({ status: "published", published_target_type: "none", published_at: new Date().toISOString() })
      .eq("id", item);
    const result = await applyAutosave({ client: service, itemId: item, payload: LINKS2, expectedRevision: 1 });
    expect(result.outcome).toBe("not_editable");
  });
});

describe("applyStatusAction (approve / reject / unreject)", () => {
  async function freshItem(status: "draft" | "approved" = "draft") {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    return createItem(pkg, "internal_link_suggestion", LINKS, status);
  }

  it("approves a draft (stamps approved_at/by) and a failed item (clears error)", async () => {
    const item = await freshItem("draft");
    const ok = await applyStatusAction({ client: service, itemId: item, action: "approve" });
    expect(ok.outcome).toBe("done");
    const { data: row } = await service.from("session_content_items")
      .select("status,approved_at,approved_by").eq("id", item).single();
    expect(row!.status).toBe("approved");
    expect(row!.approved_at).not.toBeNull();
    expect(row!.approved_by).toBe("admin");

    const failed = await freshItem("draft");
    await service.from("session_content_items").update({ status: "failed", error: "boom" }).eq("id", failed);
    await applyStatusAction({ client: service, itemId: failed, action: "approve" });
    const { data: row2 } = await service.from("session_content_items")
      .select("status,error").eq("id", failed).single();
    expect(row2!.status).toBe("approved");
    expect(row2!.error).toBeNull();
  });

  it("rejects with an optional reason; unreject returns to draft", async () => {
    const item = await freshItem("approved");
    await applyStatusAction({ client: service, itemId: item, action: "reject", reason: "off-brand" });
    const { data: row } = await service.from("session_content_items")
      .select("status,rejected_at,rejection_reason,approved_at").eq("id", item).single();
    expect(row!.status).toBe("rejected");
    expect(row!.rejection_reason).toBe("off-brand");
    expect(row!.approved_at).toBeNull();

    await applyStatusAction({ client: service, itemId: item, action: "unreject" });
    const { data: row2 } = await service.from("session_content_items")
      .select("status,rejected_at,rejection_reason").eq("id", item).single();
    expect(row2!.status).toBe("draft");
    expect(row2!.rejected_at).toBeNull();
  });

  it("forbids transitions on published/publishing items and unknown actions", async () => {
    const item = await freshItem("approved");
    await service.from("session_content_items")
      .update({ status: "published", published_target_type: "none", published_at: new Date().toISOString() })
      .eq("id", item);
    const blocked = await applyStatusAction({ client: service, itemId: item, action: "reject" });
    expect(blocked.outcome).toBe("forbidden");

    const item2 = await freshItem("draft");
    const unknown = await applyStatusAction({ client: service, itemId: item2, action: "explode" as never });
    expect(unknown.outcome).toBe("forbidden");
  });
});
