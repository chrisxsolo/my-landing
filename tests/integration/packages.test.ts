import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createPackage, createItem } from "./helpers";

beforeAll(() => resetDb());

describe("create_content_package", () => {
  it("creates package #1 with a pending progress map", async () => {
    const sessionId = await createTestSession();
    const pkgId = await createPackage(sessionId, ["journal_post", "portfolio_pick"]);

    const { data: pkg } = await service
      .from("session_content_packages")
      .select("*")
      .eq("id", pkgId)
      .single();
    expect(pkg.generation_number).toBe(1);
    expect(pkg.status).toBe("generating");
    expect(pkg.generation_settings.selected_types).toEqual(["journal_post", "portfolio_pick"]);
    expect(pkg.generation_settings.progress.journal_post.status).toBe("pending");
    expect(pkg.generation_settings.progress.journal_post.attempt).toBe(0);
  });

  it("rejects social_caption and unknown types", async () => {
    const sessionId = await createTestSession();
    await expect(createPackage(sessionId, ["social_caption"])).rejects.toThrow(/not offered|invalid/i);
    await expect(createPackage(sessionId, ["nonsense"])).rejects.toThrow(/not offered|invalid/i);
  });

  it("rejects generation when ai_processing_allowed is false", async () => {
    const sessionId = await createTestSession({ ai_processing_allowed: false });
    await expect(createPackage(sessionId)).rejects.toThrow(/ai processing/i);
  });

  it("requires archive_current when an active package exists, then archives consistently", async () => {
    const sessionId = await createTestSession();
    await createPackage(sessionId);
    await expect(createPackage(sessionId)).rejects.toThrow(/active package/i);

    const { data: pkg2, error } = await service.rpc("create_content_package", {
      p_session_id: sessionId,
      p_model_name: "claude-sonnet-4-6",
      p_prompt_version: "v1",
      p_selected_types: ["journal_post"],
      p_session_facts: {},
      p_generation_settings: {},
      p_archive_current: true,
      p_copy_items: [],
    });
    expect(error).toBeNull();

    const { data: pkgs } = await service
      .from("session_content_packages")
      .select("id,generation_number,status,archived_at")
      .eq("photography_session_id", sessionId)
      .order("generation_number");
    expect(pkgs).toHaveLength(2);
    expect(pkgs![0].status).toBe("archived");
    expect(pkgs![0].archived_at).not.toBeNull();
    expect(pkgs![1].id).toBe(pkg2);
    expect(pkgs![1].generation_number).toBe(2);
  });

  it("serializes concurrent creation — exactly one active package survives", async () => {
    const sessionId = await createTestSession();
    await createPackage(sessionId);

    const attempt = () =>
      service.rpc("create_content_package", {
        p_session_id: sessionId,
        p_model_name: "claude-sonnet-4-6",
        p_prompt_version: "v1",
        p_selected_types: ["journal_post"],
        p_session_facts: {},
        p_generation_settings: {},
        p_archive_current: true,
        p_copy_items: [],
      });
    await Promise.allSettled([attempt(), attempt()]);

    const { count } = await service
      .from("session_content_packages")
      .select("id", { count: "exact", head: true })
      .eq("photography_session_id", sessionId)
      .is("archived_at", null);
    expect(count).toBe(1);
  });

  it("copy-forward: draft copies as draft; approved preserved only with flag; published refused", async () => {
    const sessionId = await createTestSession();
    const pkg1 = await createPackage(sessionId);
    const draftId = await createItem(pkg1, "internal_link_suggestion", { links: [] }, "draft");
    const approvedId = await createItem(pkg1, "portfolio_pick", { session_photo_id: null, category: "grads" }, "approved");

    const { data: pkg2, error } = await service.rpc("create_content_package", {
      p_session_id: sessionId,
      p_model_name: "claude-sonnet-4-6",
      p_prompt_version: "v1",
      p_selected_types: ["journal_post"],
      p_session_facts: {},
      p_generation_settings: {},
      p_archive_current: true,
      p_copy_items: [
        { item_id: draftId, preserve_approval: false },
        { item_id: approvedId, preserve_approval: true },
      ],
    });
    expect(error).toBeNull();

    const { data: copies } = await service
      .from("session_content_items")
      .select("content_type,status,copied_from_item_id,published_target_id")
      .eq("package_id", pkg2);
    const byType = Object.fromEntries(copies!.map((c) => [c.content_type, c]));
    expect(byType.internal_link_suggestion.status).toBe("draft");
    expect(byType.internal_link_suggestion.copied_from_item_id).toBe(draftId);
    expect(byType.portfolio_pick.status).toBe("approved");
    expect(byType.portfolio_pick.published_target_id).toBeNull();

    // published source must be refused
    await service.from("session_content_items")
      .update({ status: "published", published_target_type: "none", published_at: new Date().toISOString() })
      .eq("id", approvedId); // mark the pkg1 source item published
    await expect(
      service.rpc("create_content_package", {
        p_session_id: sessionId,
        p_model_name: "claude-sonnet-4-6",
        p_prompt_version: "v1",
        p_selected_types: ["journal_post"],
        p_session_facts: {},
        p_generation_settings: {},
        p_archive_current: true,
        p_copy_items: [{ item_id: approvedId, preserve_approval: true }],
      }).then(({ error }) => { if (error) throw new Error(error.message); }),
    ).rejects.toThrow(/published/i);
  });
});
