// Scheduled publishing against the real local database: the claim RPC, the
// transactional commit RPCs, the worker loop, fencing, cancellation and the
// standalone-draft publisher. Concurrency is exercised INSIDE tests with
// Promise.all — the integration config runs files serially on one database.
import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { service, anon, resetDb, createTestSession, createPackage, createItem, ensurePublicBucket } from "./helpers";
import { finalizeUpload } from "@/lib/contentEngine/finalizeUpload";
import { ORIGINALS_BUCKET, issueUploadPath } from "@/lib/contentEngine/uploadConfig";
import { PUBLIC_DERIVATIVES_BUCKET } from "@/lib/contentEngine/derivatives";
import { applyAutosave, applyStatusAction } from "@/lib/contentEngine/itemTransitions";
import { publishApprovedItem } from "@/lib/contentEngine/publishItem";
import { BLOG_DRAFTS_BUCKET, PUBLICATION_SCHEDULES_TABLE } from "@/lib/contentPublishing/constants";
import { createDraft, updateDraft } from "@/lib/contentPublishing/blogDrafts";
import {
  cancelSchedule, claimScheduleNow, createSchedule, reschedule, retrySchedule,
} from "@/lib/contentPublishing/scheduleService";
import { publishBlogDraft } from "@/lib/contentPublishing/publishBlogDraft";
import { runPublicationWorker, settleSchedule } from "@/lib/contentPublishing/worker";
import type { RevalidateFns } from "@/lib/contentPublishing/refresh";
import type { PublicationScheduleRow } from "@/lib/contentPublishing/types";

beforeAll(async () => {
  resetDb();
  await ensurePublicBucket(PUBLIC_DERIVATIVES_BUCKET);
});

const okFns: RevalidateFns = { tag: () => {}, path: () => {} };
const FUTURE = { localWallTime: "2031-06-15T09:00", timeZone: "America/Los_Angeles" };
const PAST_ISO = new Date(Date.now() - 60_000).toISOString();

async function realPhoto(sessionId: string, seed: number) {
  const buf = await sharp({
    create: { width: 420 + seed * 3, height: 300, channels: 3, background: { r: (seed * 37) % 255, g: 90, b: 140 } },
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

let seed = 10;
async function approvedJournal(slugPrefix: string) {
  seed += 1;
  const sessionId = await createTestSession();
  const photo = await realPhoto(sessionId, seed);
  const pkg = await createPackage(sessionId, ["journal_post"]);
  const slug = `${slugPrefix}-${Date.now()}-${seed}`;
  const itemId = await createItem(pkg, "journal_post", {
    title: `Scheduled ${slugPrefix}`, slug, body: "Body.", meta_description: "d", meta_keywords: "k",
    photo_ids: [photo.id], cover_photo_id: photo.id, internal_links: [], testimonial_id: null,
  }, "approved");
  return { sessionId, itemId, slug };
}

async function scheduleItem(itemId: string, when = FUTURE) {
  const result = await createSchedule({ client: service, target: { kind: "content_item", id: itemId }, when });
  if (result.outcome !== "ok") throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  return result.schedule;
}

const makeDue = (id: string) => service.from(PUBLICATION_SCHEDULES_TABLE).update({ due_at: PAST_ISO }).eq("id", id);
const row = async (id: string) =>
  (await service.from(PUBLICATION_SCHEDULES_TABLE).select("*").eq("id", id).single()).data as PublicationScheduleRow;
const postCount = async (slug: string) =>
  (await service.from("blog_posts").select("id", { count: "exact", head: true }).eq("slug", slug)).count ?? 0;

describe("scheduling engine items", () => {
  it("three schedules on different days: only the due one publishes; siblings stay queued and private", async () => {
    const a = await approvedJournal("day-a");
    const b = await approvedJournal("day-b");
    const c = await approvedJournal("day-c");
    const sa = await scheduleItem(a.itemId, { localWallTime: "2031-06-15T09:00", timeZone: "America/Los_Angeles" });
    const sb = await scheduleItem(b.itemId, { localWallTime: "2031-06-16T09:00", timeZone: "America/Los_Angeles" });
    const sc = await scheduleItem(c.itemId, { localWallTime: "2031-06-17T09:00", timeZone: "America/Los_Angeles" });
    expect(sa.due_at).toBe("2031-06-15T16:00:00+00:00");
    expect(sa.local_wall_time).toBe("2031-06-15T09:00");

    // Scheduling promoted nothing: no derivative, no live row.
    expect(await postCount(a.slug)).toBe(0);
    const { data: photo } = await service.from("session_photos").select("public_derivative_url")
      .eq("photography_session_id", a.sessionId).single();
    expect(photo!.public_derivative_url).toBeNull();

    await makeDue(sa.id);
    const summary = await runPublicationWorker({ client: service, source: "test", revalidate: okFns });
    expect(summary.claimed).toBe(1);
    expect(summary.published).toBe(1);
    expect(await postCount(a.slug)).toBe(1);
    expect(await postCount(b.slug)).toBe(0);
    expect((await row(sa.id)).state).toBe("published");
    expect((await row(sa.id)).published_target_type).toBe("blog_post");
    expect((await row(sb.id)).state).toBe("queued");
    expect((await row(sc.id)).state).toBe("queued");
    const { data: item } = await service.from("session_content_items").select("status").eq("id", a.itemId).single();
    expect(item!.status).toBe("published");
    // The live row's date is the ACTUAL publication time, not the planned 2031 instant.
    const { data: post } = await service.from("blog_posts").select("published_at").eq("slug", a.slug).single();
    expect(Date.parse(post!.published_at)).toBeLessThan(Date.now() + 5_000);
  });

  it("two concurrent ticks claim one due row once; two concurrent worker runs produce one post", async () => {
    const a = await approvedJournal("dup");
    const s = await scheduleItem(a.itemId);
    await makeDue(s.id);
    const [r1, r2] = await Promise.all([
      runPublicationWorker({ client: service, source: "t1", revalidate: okFns }),
      runPublicationWorker({ client: service, source: "t2", revalidate: okFns }),
    ]);
    expect(r1.claimed + r2.claimed).toBe(1);
    expect(r1.published + r2.published).toBe(1);
    expect(await postCount(a.slug)).toBe(1);
    // A third run finds nothing: the published row is terminal.
    const r3 = await runPublicationWorker({ client: service, source: "t3", revalidate: okFns });
    expect(r3.claimed).toBe(0);
    expect(await postCount(a.slug)).toBe(1);
  });

  it("editing a scheduled item cancels its schedule; a stale revision that slipped through is blocked at commit", async () => {
    const a = await approvedJournal("edit");
    const s = await scheduleItem(a.itemId);
    const { data: item } = await service.from("session_content_items").select("payload,payload_revision").eq("id", a.itemId).single();
    const saved = await applyAutosave({
      client: service, itemId: a.itemId, expectedRevision: item!.payload_revision,
      payload: { ...(item!.payload as Record<string, unknown>), title: "Edited" },
    });
    expect(saved.outcome).toBe("saved");
    if (saved.outcome === "saved") expect(saved.scheduleCancelled).toBe(true);
    expect((await row(s.id)).state).toBe("cancelled");

    // Force the race the RPC exists for: a queued row bound to a revision that is no longer current.
    const b = await approvedJournal("stale");
    const sb = await scheduleItem(b.itemId);
    await service.from(PUBLICATION_SCHEDULES_TABLE).update({ due_at: PAST_ISO, source_revision: 999 }).eq("id", sb.id);
    const summary = await runPublicationWorker({ client: service, source: "test", revalidate: okFns });
    expect(summary.blocked).toBe(1);
    const after = await row(sb.id);
    expect(after.state).toBe("blocked");
    expect(after.last_error).toMatch(/content changed/i);
    expect(await postCount(b.slug)).toBe(0);
    const { data: still } = await service.from("session_content_items").select("status").eq("id", b.itemId).single();
    expect(still!.status).toBe("approved");
  });

  it("rejecting a scheduled item cancels the schedule; a cancelled claim cannot commit", async () => {
    const a = await approvedJournal("reject");
    const s = await scheduleItem(a.itemId);
    await applyStatusAction({ client: service, itemId: a.itemId, action: "reject" });
    expect((await row(s.id)).state).toBe("cancelled");

    const b = await approvedJournal("cancel-race");
    const sb = await scheduleItem(b.itemId);
    await makeDue(sb.id);
    const { data: claimed } = await service.rpc("claim_publication_schedules", { p_limit: 5, p_lease_seconds: 180 });
    const claimedRow = (claimed as PublicationScheduleRow[]).find((r) => r.id === sb.id)!;
    expect(claimedRow.state).toBe("processing");
    const cancel = await cancelSchedule(service, sb.id, claimedRow.schedule_version);
    expect(cancel.outcome).toBe("ok");
    const { error } = await service.rpc("publish_scheduled_content_item", {
      p_schedule_id: sb.id, p_claim_token: claimedRow.claim_token, p_allow_early: false,
    });
    expect(error?.message).toMatch(/claim is not current/);
    expect(await postCount(b.slug)).toBe(0);
    // A worker settling its (lost) claim must not overwrite the cancellation.
    await settleSchedule(service, claimedRow, { kind: "failed", error: "late" }, new Date());
    expect((await row(sb.id)).state).toBe("cancelled");
  });

  it("an expired lease is reclaimed with a new token; the stale worker cannot settle or commit", async () => {
    const a = await approvedJournal("lease");
    const s = await scheduleItem(a.itemId);
    await makeDue(s.id);
    const { data: first } = await service.rpc("claim_publication_schedules", { p_limit: 5, p_lease_seconds: 0 });
    const stale = (first as PublicationScheduleRow[]).find((r) => r.id === s.id)!;
    const { data: second } = await service.rpc("claim_publication_schedules", { p_limit: 5, p_lease_seconds: 180 });
    const fresh = (second as PublicationScheduleRow[]).find((r) => r.id === s.id)!;
    expect(fresh.claim_token).not.toBe(stale.claim_token);
    expect(fresh.attempts).toBe(2);

    const { error } = await service.rpc("publish_scheduled_content_item", {
      p_schedule_id: s.id, p_claim_token: stale.claim_token, p_allow_early: false,
    });
    expect(error?.message).toMatch(/claim is not current/);
    await settleSchedule(service, stale, { kind: "blocked", reason: "stale" }, new Date());
    expect((await row(s.id)).state).toBe("processing");
    expect((await row(s.id)).claim_token).toBe(fresh.claim_token);
  });

  it("Publish now claims ahead of the due time and commits; a repeat reports already published", async () => {
    const a = await approvedJournal("now");
    const s = await scheduleItem(a.itemId);
    const claimed = await claimScheduleNow(service, s.id, s.schedule_version);
    expect(claimed.outcome).toBe("claimed");
    if (claimed.outcome !== "claimed") return;
    // The same publisher the worker runs (derivatives, then the scheduled commit), ahead of due_at.
    const outcome = await publishApprovedItem({
      client: service, itemId: a.itemId, revalidate: () => {},
      schedule: { id: s.id, claimToken: claimed.row.claim_token as string, allowEarly: true },
    });
    expect(outcome.status).toBe("published");
    expect((await row(s.id)).state).toBe("published");
    // The worker's due-time check would have refused this claim: it is 2031.
    const again = await service.rpc("publish_scheduled_content_item", {
      p_schedule_id: s.id, p_claim_token: claimed.row.claim_token, p_allow_early: true,
    });
    expect((again.data as { already_published: boolean }).already_published).toBe(true);
    expect(await postCount(a.slug)).toBe(1);
    const cancel = await cancelSchedule(service, s.id, (await row(s.id)).schedule_version);
    expect(cancel.outcome).toBe("already_published");
  });

  it("reschedule and cancel are version-guarded; past, nonexistent and ambiguous times are rejected", async () => {
    const a = await approvedJournal("version");
    const s = await scheduleItem(a.itemId);
    const moved = await reschedule({ client: service, id: s.id, version: s.schedule_version, when: { localWallTime: "2031-07-01T18:30", timeZone: "Asia/Tokyo" } });
    expect(moved.outcome).toBe("ok");
    if (moved.outcome === "ok") {
      expect(moved.schedule.due_at).toBe("2031-07-01T09:30:00+00:00");
      expect(moved.schedule.schedule_version).toBe(s.schedule_version + 1);
    }
    const staleCancel = await cancelSchedule(service, s.id, s.schedule_version);
    expect(staleCancel.outcome).toBe("conflict");
    expect((await row(s.id)).state).toBe("queued");

    const b = await approvedJournal("times");
    const past = await createSchedule({ client: service, target: { kind: "content_item", id: b.itemId }, when: { localWallTime: "2020-01-01T09:00", timeZone: "America/Los_Angeles" } });
    expect(past).toMatchObject({ outcome: "invalid", code: "past" });
    const gap = await createSchedule({ client: service, target: { kind: "content_item", id: b.itemId }, when: { localWallTime: "2031-03-09T02:30", timeZone: "America/Los_Angeles" } });
    expect(gap).toMatchObject({ outcome: "invalid", code: "nonexistent" });
    const twice = await createSchedule({ client: service, target: { kind: "content_item", id: b.itemId }, when: { localWallTime: "2031-11-02T01:30", timeZone: "America/Los_Angeles" } });
    expect(twice).toMatchObject({ outcome: "invalid", code: "ambiguous" });
    const later = await createSchedule({ client: service, target: { kind: "content_item", id: b.itemId }, when: { localWallTime: "2031-11-02T01:30", timeZone: "America/Los_Angeles", disambiguation: "later" } });
    expect(later.outcome).toBe("ok");
    if (later.outcome === "ok") expect(later.schedule.due_at).toBe("2031-11-02T09:30:00+00:00");
    const dupe = await createSchedule({ client: service, target: { kind: "content_item", id: b.itemId }, when: FUTURE });
    expect(dupe.outcome).toBe("conflict");
  });

  it("refuses to schedule a draft item, an unpublishable type, or a session without marketing permission", async () => {
    const sessionId = await createTestSession({ marketing_permission: false });
    const photo = await realPhoto(sessionId, 99);
    const pkg = await createPackage(sessionId, ["journal_post", "internal_link_suggestion"]);
    const draftItem = await createItem(pkg, "journal_post", {
      title: "Draft", slug: `draft-${Date.now()}`, body: "B", meta_description: "", meta_keywords: "",
      photo_ids: [photo.id], cover_photo_id: photo.id, internal_links: [], testimonial_id: null,
    }, "draft");
    const r1 = await createSchedule({ client: service, target: { kind: "content_item", id: draftItem }, when: FUTURE });
    expect(r1).toMatchObject({ outcome: "not_ready" });
    expect((r1 as { message: string }).message).toMatch(/approved/);
    const links = await createItem(pkg, "internal_link_suggestion", { links: [] }, "approved");
    const r2 = await createSchedule({ client: service, target: { kind: "content_item", id: links }, when: FUTURE });
    expect((r2 as { message: string }).message).toMatch(/by hand/);
    await service.from("session_content_items").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", draftItem);
    const r3 = await createSchedule({ client: service, target: { kind: "content_item", id: draftItem }, when: FUTURE });
    expect((r3 as { message: string }).message).toMatch(/marketing permission/);
  });

  it("a failed cache refresh leaves the item published with refresh pending, which a later tick clears", async () => {
    const a = await approvedJournal("refresh");
    const s = await scheduleItem(a.itemId);
    await makeDue(s.id);
    const failing: RevalidateFns = { tag: () => {}, path: (p) => { if (p === "/blog") throw new Error("down"); } };
    const summary = await runPublicationWorker({ client: service, source: "test", revalidate: failing });
    expect(summary.published).toBe(1);
    const after = await row(s.id);
    expect(after.state).toBe("published");
    expect(after.refresh_pending).toBe(true);
    expect(after.refresh_paths).toEqual(["/blog"]);
    const next = await runPublicationWorker({ client: service, source: "test", revalidate: okFns });
    expect(next.refreshed).toBe(1);
    expect((await row(s.id)).refresh_pending).toBe(false);
  });
});

describe("standalone blog drafts", () => {
  async function privateImage(draftId: string, seed: number) {
    const buf = await sharp({ create: { width: 320 + seed, height: 200, channels: 3, background: { r: 20, g: seed % 255, b: 200 } } }).jpeg().toBuffer();
    const path = `${draftId}/${randomUUID()}.jpg`;
    const { error } = await service.storage.from(BLOG_DRAFTS_BUCKET).upload(path, buf, { contentType: "image/jpeg" });
    if (error) throw error;
    return path;
  }

  it("saving a draft creates no live post; an incomplete draft cannot be scheduled; a complete one publishes once with public copies", async () => {
    const draft = await createDraft(service, { title: "", body: "Notes so far", slug: "" });
    expect(await postCount("")).toBe(0);
    const incomplete = await createSchedule({ client: service, target: { kind: "blog_draft", id: draft.id }, when: FUTURE });
    expect(incomplete).toMatchObject({ outcome: "not_ready" });
    expect((incomplete as { message: string }).message).toMatch(/title/);

    const slug = `draft-live-${Date.now()}`;
    const img1 = await privateImage(draft.id, 1);
    const img2 = await privateImage(draft.id, 2);
    const saved = await updateDraft(service, draft.id, {
      title: "Draft goes live", slug, images: [{ path: img1, alt: "Cover alt" }, { path: img2, alt: "" }],
    }, draft.revision);
    expect(saved.outcome).toBe("saved");
    if (saved.outcome !== "saved") return;
    const s = await createSchedule({ client: service, target: { kind: "blog_draft", id: draft.id }, when: FUTURE });
    expect(s.outcome).toBe("ok");
    if (s.outcome !== "ok") return;
    expect(s.schedule.source_revision).toBe(saved.draft.revision);
    await makeDue(s.schedule.id);

    const [r1, r2] = await Promise.all([
      runPublicationWorker({ client: service, source: "t1", revalidate: okFns }),
      runPublicationWorker({ client: service, source: "t2", revalidate: okFns }),
    ]);
    expect(r1.published + r2.published).toBe(1);
    expect(await postCount(slug)).toBe(1);
    const { data: post } = await service.from("blog_posts").select("*").eq("slug", slug).single();
    expect(post!.cover_image_url).toContain(`/public/grad-photos/blog/drafts/${draft.id}/`);
    expect(post!.cover_image_alt).toBe("Cover alt");
    expect(post!.extra_image_urls).toHaveLength(1);
    expect(post!.og_image_url).toBe(post!.cover_image_url);
    const { count: libRows } = await service.from("image_library").select("id", { count: "exact", head: true }).eq("source_post_id", post!.id);
    expect(libRows).toBe(2);
    const { data: d } = await service.from("blog_post_drafts").select("status,published_post_id").eq("id", draft.id).single();
    expect(d!.status).toBe("published");
    expect(d!.published_post_id).toBe(post!.id);

    // A repeat publication of the same draft creates nothing.
    const again = await publishBlogDraft({ client: service, draftId: draft.id, revalidate: () => {} });
    expect(again.status).toBe("published");
    if (again.status === "published") expect(again.alreadyPublished).toBe(true);
    expect(await postCount(slug)).toBe(1);
    const { count: libAgain } = await service.from("image_library").select("id", { count: "exact", head: true }).eq("source_post_id", post!.id);
    expect(libAgain).toBe(2);
  });

  it("a draft edit cancels its schedule; a missing private image is a transient failure with bounded retry", async () => {
    const slug = `draft-edit-${Date.now()}`;
    const draft = await createDraft(service, { title: "Edit me", body: "Body", slug });
    const s = await createSchedule({ client: service, target: { kind: "blog_draft", id: draft.id }, when: FUTURE });
    expect(s.outcome).toBe("ok");
    if (s.outcome !== "ok") return;
    const edited = await updateDraft(service, draft.id, { body: "Body v2" }, draft.revision);
    expect(edited.outcome).toBe("saved");
    if (edited.outcome === "saved") expect(edited.scheduleCancelled).toBe(true);
    expect((await row(s.schedule.id)).state).toBe("cancelled");
    const staleSave = await updateDraft(service, draft.id, { body: "Body v3" }, draft.revision);
    expect(staleSave.outcome).toBe("conflict");

    const broken = await createDraft(service, { title: "Broken image", body: "Body", slug: `${slug}-broken` });
    await updateDraft(service, broken.id, { images: [{ path: `${broken.id}/${randomUUID()}.jpg`, alt: "" }] }, broken.revision);
    const sb = await createSchedule({ client: service, target: { kind: "blog_draft", id: broken.id }, when: FUTURE });
    if (sb.outcome !== "ok") throw new Error("expected ok");
    await makeDue(sb.schedule.id);
    const summary = await runPublicationWorker({ client: service, source: "test", revalidate: okFns });
    expect(summary.retried).toBe(1);
    const after = await row(sb.schedule.id);
    expect(after.state).toBe("queued");
    expect(after.attempts).toBe(1);
    expect(after.next_attempt_at).not.toBeNull();
    expect(Date.parse(after.next_attempt_at!)).toBeGreaterThan(Date.now());
    expect(await postCount(`${slug}-broken`)).toBe(0);
    // Not claimable again until the back-off passes.
    const second = await runPublicationWorker({ client: service, source: "test", revalidate: okFns });
    expect(second.claimed).toBe(0);
    // Retry from the admin resets the back-off; a later blocked state can be retried too.
    const retried = await retrySchedule(service, sb.schedule.id, after.schedule_version);
    expect(retried.outcome).toBe("conflict"); // only blocked/failed rows take an explicit retry
  });

  it("a slug that went live meanwhile blocks the draft at commit", async () => {
    const slug = `draft-collide-${Date.now()}`;
    const draft = await createDraft(service, { title: "Collide", body: "Body", slug });
    const s = await createSchedule({ client: service, target: { kind: "blog_draft", id: draft.id }, when: FUTURE });
    if (s.outcome !== "ok") throw new Error("expected ok");
    await service.from("blog_posts").insert({ title: "Existing", body: "x", slug, category: "professional", sites: ["professional"] });
    await makeDue(s.schedule.id);
    const summary = await runPublicationWorker({ client: service, source: "test", revalidate: okFns });
    expect(summary.blocked).toBe(1);
    const after = await row(s.schedule.id);
    expect(after.state).toBe("blocked");
    expect(after.last_error).toMatch(/already uses the slug|slug conflict/); // caught in preflight, before any photo goes public
    expect(await postCount(slug)).toBe(1);
  });
});

describe("privacy", () => {
  it("the anon key reads nothing from drafts, schedules or worker runs", async () => {
    for (const table of ["blog_post_drafts", "publication_schedules", "publication_worker_runs"]) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    }
    const { error } = await anon.rpc("claim_publication_schedules", { p_limit: 1, p_lease_seconds: 1 });
    expect(error).not.toBeNull();
  });
});
