// Reconciliation (spec §9.4): surface items stuck publishing past the lease,
// failed items whose intended target detectably exists (hash/constraint proofs
// auto-confirmable; slug matches need manual confirmation — an existing post
// is never assumed ours), and orphaned derivatives. Link actions RE-VERIFY the
// proof server-side before claiming a target.
import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLISHING_LEASE_MS } from "@/lib/contentEngine/state";
import { countLiveReferences } from "@/lib/contentEngine/derivativeRefs";

export interface StuckItem { itemId: string; contentType: string; publishingStartedAt: string }
export interface TargetMatch {
  itemId: string; contentType: string;
  targetType: "portfolio_image" | "school_page_photo" | "blog_post";
  targetId: string; autoConfirmable: boolean; proof: string;
}
export interface OrphanedDerivative { photoId: string; url: string }

export interface ReconcileReport {
  stuckPublishing: StuckItem[];
  failedWithExistingTarget: TargetMatch[];
  orphanedDerivatives: OrphanedDerivative[];
}

interface ItemRow {
  id: string; content_type: string; status: string;
  payload: Record<string, unknown>; publishing_started_at: string | null;
}

async function sessionItems(client: SupabaseClient, sessionId: string): Promise<ItemRow[]> {
  const { data: pkgs } = await client.from("session_content_packages")
    .select("id").eq("photography_session_id", sessionId);
  if (!pkgs?.length) return [];
  const { data } = await client.from("session_content_items")
    .select("id,content_type,status,payload,publishing_started_at")
    .in("package_id", pkgs.map((p) => p.id));
  return (data ?? []) as ItemRow[];
}

function isStuck(item: ItemRow, now: number): boolean {
  if (item.status !== "publishing" || !item.publishing_started_at) return false;
  return new Date(item.publishing_started_at).getTime() + PUBLISHING_LEASE_MS <= now;
}

async function findTargetFor(client: SupabaseClient, item: ItemRow): Promise<TargetMatch | null> {
  const payload = item.payload;
  if (item.content_type === "portfolio_pick" && typeof payload.session_photo_id === "string") {
    const { data: photo } = await client.from("session_photos")
      .select("content_hash").eq("id", payload.session_photo_id).maybeSingle();
    if (!photo) return null;
    const { data: hit } = await client.from("portfolio_images")
      .select("id").eq("content_hash", photo.content_hash).maybeSingle();
    if (!hit) return null;
    return { itemId: item.id, contentType: item.content_type, targetType: "portfolio_image",
             targetId: String(hit.id), autoConfirmable: true, proof: "content_hash" };
  }
  if (item.content_type === "school_page_photo" && typeof payload.session_photo_id === "string") {
    const { data: hit } = await client.from("school_page_photos")
      .select("id").eq("school_slug", payload.school_slug as string)
      .eq("session_photo_id", payload.session_photo_id).maybeSingle();
    if (!hit) return null;
    return { itemId: item.id, contentType: item.content_type, targetType: "school_page_photo",
             targetId: String(hit.id), autoConfirmable: true, proof: "unique_constraint" };
  }
  if (item.content_type === "journal_post" && typeof payload.slug === "string") {
    const { data: hit } = await client.from("blog_posts")
      .select("id").eq("slug", payload.slug).maybeSingle();
    if (!hit) return null;
    return { itemId: item.id, contentType: item.content_type, targetType: "blog_post",
             targetId: String(hit.id), autoConfirmable: false, proof: "slug_match" };
  }
  return null;
}

export async function buildReconcileReport(
  args: { client: SupabaseClient; sessionId: string },
): Promise<ReconcileReport> {
  const { client, sessionId } = args;
  const items = await sessionItems(client, sessionId);
  const now = Date.now();

  const stuckPublishing: StuckItem[] = items.filter((i) => isStuck(i, now)).map((i) => ({
    itemId: i.id, contentType: i.content_type, publishingStartedAt: i.publishing_started_at as string,
  }));

  const failedWithExistingTarget: TargetMatch[] = [];
  for (const item of items.filter((i) => i.status === "failed")) {
    const match = await findTargetFor(client, item);
    if (match) failedWithExistingTarget.push(match);
  }

  const { data: photos } = await client.from("session_photos")
    .select("id,public_derivative_url").eq("photography_session_id", sessionId)
    .not("public_derivative_url", "is", null);
  const orphanedDerivatives: OrphanedDerivative[] = [];
  for (const photo of photos ?? []) {
    const refs = await countLiveReferences(client, photo as { id: string; public_derivative_url: string });
    if (refs.total === 0) {
      orphanedDerivatives.push({ photoId: photo.id as string, url: photo.public_derivative_url as string });
    }
  }

  return { stuckPublishing, failedWithExistingTarget, orphanedDerivatives };
}

export async function linkItemToExistingTarget(args: {
  client: SupabaseClient; itemId: string; targetType: string; targetId: string; confirm?: boolean;
}): Promise<{ linked: boolean }> {
  const { client, itemId, targetType, targetId, confirm } = args;

  const { data: item } = await client.from("session_content_items")
    .select("id,content_type,status,payload,publishing_started_at").eq("id", itemId).maybeSingle();
  if (!item) throw new Error("item not found");
  if (item.status !== "failed") throw new Error(`only failed items can be linked (status=${item.status})`);

  const match = await findTargetFor(client, item as ItemRow);
  if (!match || match.targetType !== targetType || match.targetId !== targetId) {
    throw new Error("target proof could not be re-verified");
  }
  if (!match.autoConfirmable && confirm !== true) {
    throw new Error("slug matches require explicit confirm (an existing post is never assumed ours)");
  }

  const { error } = await client.from("session_content_items").update({
    status: "published",
    published_target_type: targetType,
    published_target_id: targetId,
    published_at: new Date().toISOString(),
    published_ref: { reconciled: true, proof: match.proof },
    error: null,
  }).eq("id", itemId).eq("status", "failed");
  if (error) throw new Error(`link failed: ${error.message}`);
  return { linked: true };
}

export async function markStuckItemFailed(args: {
  client: SupabaseClient; itemId: string;
}): Promise<{ marked: boolean }> {
  const { client, itemId } = args;
  const { data: item } = await client.from("session_content_items")
    .select("id,status,publishing_started_at").eq("id", itemId).maybeSingle();
  if (!item) throw new Error("item not found");
  if (!isStuck(item as ItemRow, Date.now())) {
    throw new Error("item is not stuck — it is still within its publishing lease (live)");
  }
  const { error } = await client.from("session_content_items").update({
    status: "failed",
    error: "publishing interrupted (stuck past lease, marked failed via reconciliation)",
    publishing_started_at: null,
  }).eq("id", itemId).eq("status", "publishing");
  if (error) throw new Error(`mark failed: ${error.message}`);
  return { marked: true };
}
