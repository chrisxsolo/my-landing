import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createPackage, createItem } from "./helpers";
import { recordContentEvent } from "@/lib/contentEngine/recordEvent";

beforeAll(() => resetDb());

async function publishedLinkItem(sessionId: string) {
  const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
  const item = await createItem(pkg, "internal_link_suggestion", { links: [] }, "approved");
  // simulate a published target the reverse lookup can resolve. 'none' targets
  // are excluded from the lookup index, so use a fake portfolio target id.
  await service.from("session_content_items").update({
    status: "published", published_target_type: "portfolio_image",
    published_target_id: "424242", published_at: new Date().toISOString(),
  }).eq("id", item);
  return item;
}

describe("recordContentEvent (spec §10 attribution)", () => {
  it("shared page_view stores nulls for session/item (never false attribution)", async () => {
    const result = await recordContentEvent(service, {
      event: "page_view", path: "/grads/sjsu", contentType: "school_page",
      contentId: "sjsu", referrer: "https://www.google.com/", target: null,
    });
    expect(result.recorded).toBe(true);
    const { data } = await service.from("content_events")
      .select("*").eq("path", "/grads/sjsu").order("id", { ascending: false }).limit(1).single();
    expect(data!.event_type).toBe("page_view");
    expect(data!.referrer_domain).toBe("www.google.com");
    expect(data!.photography_session_id).toBeNull();
    expect(data!.content_item_id).toBeNull();
  });

  it("single-session content resolves the item via (target_type, target_id)", async () => {
    const sessionId = await createTestSession();
    const item = await publishedLinkItem(sessionId);

    const result = await recordContentEvent(service, {
      event: "page_view", path: "/portfolio", contentType: "portfolio",
      contentId: "424242", referrer: "", target: { type: "portfolio_image", id: "424242" },
    });
    expect(result.recorded).toBe(true);
    const { data } = await service.from("content_events")
      .select("content_item_id,photography_session_id")
      .eq("content_item_id", item).single();
    expect(data!.content_item_id).toBe(item);
    expect(data!.photography_session_id).toBe(sessionId);
  });

  it("an unresolvable target records the event with nulls (no failure, no guess)", async () => {
    const result = await recordContentEvent(service, {
      event: "page_view", path: "/blog/some-post", contentType: "blog_post",
      contentId: "999999", referrer: "", target: { type: "blog_post", id: "999999" },
    });
    expect(result.recorded).toBe(true);
    const { data } = await service.from("content_events")
      .select("photography_session_id,content_item_id")
      .eq("path", "/blog/some-post").order("id", { ascending: false }).limit(1).single();
    expect(data!.photography_session_id).toBeNull();
  });

  it("cta_click NEVER attributes to a session even when a target sneaks in", async () => {
    const sessionId = await createTestSession();
    await publishedLinkItem(sessionId);
    await recordContentEvent(service, {
      event: "cta_click", path: "/grads/sjsu", contentType: "school_page",
      contentId: "sjsu", referrer: "", target: { type: "portfolio_image", id: "424242" },
    });
    const { data } = await service.from("content_events")
      .select("photography_session_id,content_item_id").eq("event_type", "cta_click")
      .order("id", { ascending: false }).limit(1).single();
    expect(data!.photography_session_id).toBeNull();
    expect(data!.content_item_id).toBeNull();
  });

  it("rejects bad event types, bad content types, and unknown paths", async () => {
    expect((await recordContentEvent(service, {
      event: "inquiry_submit", path: "/", contentType: "page", contentId: null, referrer: "", target: null,
    })).recorded).toBe(false); // v1 allowlist
    expect((await recordContentEvent(service, {
      event: "page_view", path: "/admin/content-engine", contentType: "page", contentId: null, referrer: "", target: null,
    })).recorded).toBe(false);
    expect((await recordContentEvent(service, {
      event: "page_view", path: "/", contentType: "weird", contentId: null, referrer: "", target: null,
    })).recorded).toBe(false);
  });
});
