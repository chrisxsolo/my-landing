// Location intelligence, publish side (scenarios F–G from the 2026-10-25
// brief): a journal that wants a not-yet-approved guide never ships a broken
// URL, publishing the guide turns the pending reference into a real link, and
// rejecting the guide drops the dependency without touching the post.
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createPackage, createItem } from "./helpers";
import { SHARK_FIN_SLUG, couplesFacts, couplesSession, guidePayload } from "./locationFixtures";
import { publishApprovedItem } from "@/lib/contentEngine/publishItem";
import { applyStatusAction } from "@/lib/contentEngine/itemTransitions";
import { ensurePublicBucket } from "./helpers";
import { PUBLIC_DERIVATIVES_BUCKET } from "@/lib/contentEngine/derivatives";

const GUIDE_URL = `/couples-guide/locations/${SHARK_FIN_SLUG}`;

beforeAll(async () => {
  resetDb();
  await ensurePublicBucket(PUBLIC_DERIVATIVES_BUCKET);
});

const noRevalidate = () => {};

const pending = {
  guide: "couples", location_key: "shark-fin-cove", place_name: "Shark Fin Cove",
  slug: SHARK_FIN_SLUG, label: "Shark Fin Cove couples photography guide", status: "pending",
};

function journal(photoIds: string[], slug: string, extra: Record<string, unknown> = {}) {
  return {
    title: "Golden Hour at Shark Fin Cove", slug,
    body: "A golden hour session at Shark Fin Cove. See the [couples guide](/couples-guide).",
    meta_description: "d", meta_keywords: "k", photo_ids: photoIds.slice(0, 2), cover_photo_id: photoIds[0],
    internal_links: [{ url: "/couples-guide", label: "Couples guide" }],
    pending_guide_links: [pending], testimonial_id: null, ...extra,
  };
}

async function payloadOf(itemId: string) {
  const { data } = await service.from("session_content_items").select("status,payload").eq("id", itemId).single();
  return data!;
}

describe("Test F — pending guide", () => {
  it("a journal never publishes a link to a guide that is not live", async () => {
    const { sessionId, photoIds } = await couplesSession("Shark Fin Cove");
    const pkg = await createPackage(sessionId, ["journal_post"], couplesFacts("Shark Fin Cove"));
    const bad = await createItem(pkg, "journal_post", journal(photoIds, `sfc-bad-${Date.now()}`, {
      internal_links: [{ url: GUIDE_URL, label: "Shark Fin Cove guide" }],
    }));
    const blocked = await publishApprovedItem({ client: service, itemId: bad, revalidate: noRevalidate });
    expect(blocked.status).toBe("blocked");
    if (blocked.status === "blocked") expect(blocked.reason).toMatch(/not live yet/);
    expect((await payloadOf(bad)).status).toBe("approved"); // untouched, still publishable later
  });

  it("the journal publishes with the pending reference only — no URL in the live post", async () => {
    const { sessionId, photoIds } = await couplesSession("Shark Fin Cove");
    const pkg = await createPackage(sessionId, ["journal_post"], couplesFacts("Shark Fin Cove"));
    const slug = `sfc-ok-${Date.now()}`;
    const item = await createItem(pkg, "journal_post", journal(photoIds, slug));
    const outcome = await publishApprovedItem({ client: service, itemId: item, revalidate: noRevalidate });
    expect(outcome.status).toBe("published");
    const { data: post } = await service.from("blog_posts").select("body").eq("slug", slug).single();
    expect(post!.body).not.toContain("shark-fin-cove-santa-cruz");
    expect(post!.body).toContain("/couples-guide");
  });

  it("publishing the guide links draft journals and flags approved ones for review", async () => {
    const { sessionId, photoIds } = await couplesSession("Shark Fin Cove");
    const pkg = await createPackage(sessionId, ["journal_post", "guide_photo"], couplesFacts("Shark Fin Cove"));
    const draftJournal = await createItem(pkg, "journal_post", journal(photoIds, `sfc-draft-${Date.now()}`), "draft");
    const approvedJournal = await createItem(pkg, "journal_post", journal(photoIds, `sfc-appr-${Date.now()}`));
    const approvedBody = (await payloadOf(approvedJournal)).payload.body;
    const guide = await createItem(pkg, "location_guide", guidePayload(sessionId, photoIds));

    const outcome = await publishApprovedItem({ client: service, itemId: guide, revalidate: noRevalidate });
    expect(outcome.status).toBe("published");
    if (outcome.status !== "published") throw new Error("unreachable");
    expect(outcome.targetType).toBe("location_guide");
    expect(outcome.revalidated).toContain(GUIDE_URL);
    expect(outcome.linkUpdates?.linked).toContain(draftJournal);
    expect(outcome.linkUpdates?.flaggedReady).toContain(approvedJournal);

    const { data: row } = await service.from("location_guides")
      .select("slug,location_key,published,indexable").eq("slug", SHARK_FIN_SLUG).single();
    expect(row).toMatchObject({ location_key: "shark-fin-cove", published: true, indexable: true });
    const { count } = await service.from("couples_location_photos")
      .select("id", { count: "exact", head: true }).eq("location_slug", SHARK_FIN_SLUG).eq("published", true);
    expect(count).toBe(photoIds.length);

    const linked = (await payloadOf(draftJournal)).payload;
    expect(linked.body).toContain(`](${GUIDE_URL})`);
    expect(linked.internal_links.map((l: { url: string }) => l.url)).toContain(GUIDE_URL);
    expect(linked.pending_guide_links).toHaveLength(0);

    const flagged = await payloadOf(approvedJournal);
    expect(flagged.status).toBe("approved");
    expect(flagged.payload.body).toBe(approvedBody); // approved content never changed silently
    expect(flagged.payload.pending_guide_links[0].status).toBe("ready");

    // with the guide live, the previously blocked kind of link now publishes
    const nowOk = await createItem(pkg, "journal_post", journal(photoIds, `sfc-live-${Date.now()}`, {
      internal_links: [{ url: GUIDE_URL, label: "Shark Fin Cove guide" }], pending_guide_links: [],
    }));
    expect((await publishApprovedItem({ client: service, itemId: nowOk, revalidate: noRevalidate })).status).toBe("published");

    // a second proposal for the same published place is refused by the RPC
    const dup = await createItem(pkg, "location_guide", guidePayload(sessionId, photoIds));
    expect((await publishApprovedItem({ client: service, itemId: dup, revalidate: noRevalidate })).status).toBe("failed");
  });
});

describe("Test G — rejected guide", () => {
  it("rejecting the proposal removes the pending dependency without breaking the journal", async () => {
    const { sessionId, photoIds } = await couplesSession("Shark Fin Cove");
    const pkg = await createPackage(sessionId, ["journal_post", "guide_photo"], couplesFacts("Shark Fin Cove"));
    const waiting = { ...pending, location_key: "test-g-cove", slug: "test-g-cove", place_name: "Test G Cove" };
    const draft = await createItem(pkg, "journal_post", journal(photoIds, `g-${Date.now()}`, { pending_guide_links: [waiting] }), "draft");
    const before = (await payloadOf(draft)).payload;
    const guide = await createItem(pkg, "location_guide",
      guidePayload(sessionId, photoIds, { location_key: "test-g-cove", slug: "test-g-cove" }), "draft");

    const result = await applyStatusAction({ client: service, itemId: guide, action: "reject", reason: "not now" });
    expect(result).toMatchObject({ outcome: "done", status: "rejected" });
    const after = await payloadOf(draft);
    expect(after.status).toBe("draft");
    expect(after.payload.pending_guide_links).toHaveLength(0);
    expect(after.payload.body).toBe(before.body);
    expect(after.payload.internal_links).toEqual(before.internal_links);
  });

  it("the dependency survives when another proposal for the same place is still open", async () => {
    const { sessionId, photoIds } = await couplesSession("Shark Fin Cove");
    const pkg = await createPackage(sessionId, ["journal_post", "guide_photo"], couplesFacts("Shark Fin Cove"));
    const waiting = { ...pending, location_key: "test-g2-cove", slug: "test-g2-cove", place_name: "Test G2 Cove" };
    const draft = await createItem(pkg, "journal_post", journal(photoIds, `g2-${Date.now()}`, { pending_guide_links: [waiting] }), "draft");
    const proposal = guidePayload(sessionId, photoIds, { location_key: "test-g2-cove", slug: "test-g2-cove" });
    const first = await createItem(pkg, "location_guide", proposal, "draft");
    await createItem(pkg, "location_guide", proposal, "draft");

    await applyStatusAction({ client: service, itemId: first, action: "reject" });
    expect((await payloadOf(draft)).payload.pending_guide_links).toHaveLength(1);
  });
});
