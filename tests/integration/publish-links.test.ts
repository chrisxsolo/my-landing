import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createPackage, createItem, publish } from "./helpers";

beforeAll(() => resetDb());

describe("internal_link_suggestion publisher (spec §9.2)", () => {
  it("publishes as applied: target type 'none', null target id, and cannot re-publish", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", {
      links: [{ url: "/pricing", label: "Pricing", reason: "ready to book" }],
    }, "approved");

    const { error } = await publish(item);
    expect(error).toBeNull();

    const { data: row } = await service.from("session_content_items")
      .select("status,published_target_type,published_target_id,published_at")
      .eq("id", item).single();
    expect(row!.status).toBe("published");
    expect(row!.published_target_type).toBe("none");
    expect(row!.published_target_id).toBeNull();
    expect(row!.published_at).not.toBeNull();

    // the unique published-target index excludes 'none'; the STATUS guard is
    // what must reject a re-publish here
    const again = await publish(item);
    expect(again.error?.message).toMatch(/not approved|already published/i);
  });
});
