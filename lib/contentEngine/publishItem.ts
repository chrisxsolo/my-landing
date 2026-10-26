// The three-step publish flow (spec §9.1). Step A builds derivatives
// (idempotent, content-addressed). Step B is the transactional RPC. Step C is
// targeted revalidation; its failures are RECOVERABLE — they never unpublish.
// Guard rejections (preconditions) are 'blocked' and leave the item untouched;
// genuine Step-B failures record status='failed' with a capped error.
import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareApprovedDerivatives, DerivativeError } from "@/lib/contentEngine/derivatives";
import { pathsForPublishedItem } from "@/lib/contentEngine/publishRevalidation";
import { publishBlockReason } from "@/lib/contentEngine/publishPreflight";
import { resolvePendingGuideLinks, type LinkUpdateReport } from "@/lib/contentEngine/pendingGuideLinks";
import { isLocationGuideType } from "@/lib/locations/guideCoverage";

export type PublishOutcome =
  | { status: "published"; targetType: string; targetId: string | null;
      revalidated: string[]; revalidationFailures: string[];
      /** Journals that received (or were flagged for) this guide's link. */
      linkUpdates?: LinkUpdateReport }
  | { status: "blocked"; reason: string }
  | { status: "failed"; error: string };

const GUARD_PATTERN = /not approved|already published|marketing permission|archived package|claimed by another/i;

export interface PublishArgs {
  client: SupabaseClient;
  itemId: string;
  revalidate: (path: string) => void;
}

// After a location guide goes live, journals waiting on it get the link.
// Recoverable like Step C: the guide is live regardless; a failure is logged.
async function linkWaitingJournals(
  client: SupabaseClient, contentType: string, payload: Record<string, unknown>,
): Promise<LinkUpdateReport | undefined> {
  if (contentType !== "location_guide" || !isLocationGuideType(payload.guide)) return undefined;
  try {
    return await resolvePendingGuideLinks(
      client, payload.guide, String(payload.location_key), String(payload.slug),
    );
  } catch (err) {
    console.error("pending guide link resolution failed (recoverable)", err);
    return undefined;
  }
}

export async function publishApprovedItem(args: PublishArgs): Promise<PublishOutcome> {
  const { client, itemId, revalidate } = args;

  // Preflight — location guards the RPC cannot evaluate (item left untouched)
  const { data: pre, error: preError } = await client.from("session_content_items")
    .select("content_type,payload,package_id").eq("id", itemId).maybeSingle();
  if (preError) return { status: "failed", error: preError.message };
  if (!pre) return { status: "blocked", reason: "content item not found" };
  const blockReason = await publishBlockReason(
    client, pre.content_type, pre.payload as Record<string, unknown>, pre.package_id as string,
  );
  if (blockReason) return { status: "blocked", reason: blockReason };

  // Step A — derivatives (item left approved on failure; retryable)
  try {
    await prepareApprovedDerivatives({ client, itemId });
  } catch (err) {
    if (err instanceof DerivativeError) {
      if (err.kind === "not_approved" || err.kind === "permission" || err.kind === "not_found") {
        return { status: "blocked", reason: err.message };
      }
      return { status: "failed", error: err.message };
    }
    throw err;
  }

  // Step B — transactional live write via the RPC
  const { data, error } = await client.rpc("publish_session_content_item", { p_item_id: itemId });
  if (error) {
    if (GUARD_PATTERN.test(error.message)) {
      return { status: "blocked", reason: error.message };
    }
    // genuine publish failure: record failed, preserve the draft (spec §9.1)
    await client.from("session_content_items")
      .update({ status: "failed", error: error.message.slice(0, 2000) })
      .eq("id", itemId).eq("status", "approved");
    return { status: "failed", error: error.message };
  }
  const result = data as { item_id: string; target_type: string; target_id: string | null };

  // Step C — targeted revalidation (post-commit; failures are recoverable).
  // The item IS live at this point — a failed re-read must never surface as a
  // publish failure (a retry would just 409 "already published"). Report
  // published with the revalidation marked pending; hourly ISR is the backstop.
  const { data: item, error: readError } = await client.from("session_content_items")
    .select("content_type,payload").eq("id", itemId).single();
  if (readError || !item) {
    console.error(`post-publish re-read failed for ${itemId} (recoverable; hourly ISR is the backstop)`, readError);
    return {
      status: "published",
      targetType: result.target_type,
      targetId: result.target_id,
      revalidated: [],
      revalidationFailures: ["(all paths — post-publish read failed)"],
    };
  }
  const linkUpdates = await linkWaitingJournals(client, item.content_type, item.payload as Record<string, unknown>);
  const paths = pathsForPublishedItem(item.content_type, item.payload as Record<string, unknown>);
  const revalidated: string[] = [];
  const revalidationFailures: string[] = [];
  for (const path of paths) {
    try {
      revalidate(path);
      revalidated.push(path);
    } catch (err) {
      console.error(`revalidation failed for ${path} (recoverable; hourly ISR is the backstop)`, err);
      revalidationFailures.push(path);
    }
  }

  return {
    status: "published",
    targetType: result.target_type,
    targetId: result.target_id,
    revalidated,
    revalidationFailures,
    linkUpdates,
  };
}
