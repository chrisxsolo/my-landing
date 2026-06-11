// The three-step publish flow (spec §9.1). Step A builds derivatives
// (idempotent, content-addressed). Step B is the transactional RPC. Step C is
// targeted revalidation; its failures are RECOVERABLE — they never unpublish.
// Guard rejections (preconditions) are 'blocked' and leave the item untouched;
// genuine Step-B failures record status='failed' with a capped error.
import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareApprovedDerivatives, DerivativeError } from "@/lib/contentEngine/derivatives";
import { pathsForPublishedItem } from "@/lib/contentEngine/publishRevalidation";

export type PublishOutcome =
  | { status: "published"; targetType: string; targetId: string | null;
      revalidated: string[]; revalidationFailures: string[] }
  | { status: "blocked"; reason: string }
  | { status: "failed"; error: string };

const GUARD_PATTERN = /not approved|already published|marketing permission|archived package|claimed by another/i;

export interface PublishArgs {
  client: SupabaseClient;
  itemId: string;
  revalidate: (path: string) => void;
}

export async function publishApprovedItem(args: PublishArgs): Promise<PublishOutcome> {
  const { client, itemId, revalidate } = args;

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

  // Step C — targeted revalidation (post-commit; failures are recoverable)
  const { data: item } = await client.from("session_content_items")
    .select("content_type,payload").eq("id", itemId).single();
  const paths = pathsForPublishedItem(item!.content_type, item!.payload as Record<string, unknown>);
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
  };
}
