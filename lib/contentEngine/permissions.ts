// Permission updates (spec §3.1, §7.3). Two SEPARATE controls, never
// conflated: marketing_permission gates publication; ai_processing_allowed
// gates analysis/generation. Revoking marketing permission while published
// content exists requires explicit acknowledgement (the UI's blocking modal);
// the actual takedown is a separate per-item act (takedown.ts).
import type { SupabaseClient } from "@supabase/supabase-js";

const MARKETING_SOURCES = [
  "contract", "email", "testimonial_form", "manual_confirmation", "portfolio_collaboration",
] as const;
const AI_BASES = [
  "contract", "privacy_policy", "portfolio_collaboration", "manual_confirmation", "internal_business_policy",
] as const;

export interface PermissionChanges {
  marketingPermission?: boolean;
  marketingPermissionSource?: string;
  aiProcessingAllowed?: boolean;
  aiProcessingBasis?: string;
}

export interface UpdatePermissionsArgs {
  client: SupabaseClient;
  sessionId: string;
  changes: PermissionChanges;
  acknowledgePublished?: boolean;
}

export type UpdatePermissionsResult =
  | { outcome: "updated" }
  | { outcome: "requires_acknowledgement"; publishedCounts: Record<string, number> }
  | { outcome: "not_found" };

async function publishedCountsFor(client: SupabaseClient, sessionId: string): Promise<Record<string, number>> {
  const { data: pkgs } = await client.from("session_content_packages")
    .select("id").eq("photography_session_id", sessionId);
  if (!pkgs?.length) return {};
  const { data: items } = await client.from("session_content_items")
    .select("content_type,published_ref").in("package_id", pkgs.map((p) => p.id))
    .eq("status", "published");
  const counts: Record<string, number> = {};
  for (const i of items ?? []) {
    if ((i.published_ref as Record<string, unknown> | null)?.taken_down_at) continue; // already taken down
    counts[i.content_type] = (counts[i.content_type] ?? 0) + 1;
  }
  return counts;
}

export async function updatePermissions(args: UpdatePermissionsArgs): Promise<UpdatePermissionsResult> {
  const { client, sessionId, changes, acknowledgePublished } = args;

  const { data: session } = await client.from("photography_sessions")
    .select("id,marketing_permission").eq("id", sessionId).maybeSingle();
  if (!session) return { outcome: "not_found" };

  const patch: Record<string, unknown> = {};
  const now = new Date().toISOString();

  if (changes.marketingPermission === true) {
    if (!changes.marketingPermissionSource
        || !(MARKETING_SOURCES as readonly string[]).includes(changes.marketingPermissionSource)) {
      throw new Error(`marketing permission source must be one of ${MARKETING_SOURCES.join(", ")}`);
    }
    patch.marketing_permission = true;
    patch.marketing_permission_source = changes.marketingPermissionSource;
    patch.marketing_permission_confirmed_at = now;
    patch.marketing_permission_revoked_at = null;
  } else if (changes.marketingPermission === false && session.marketing_permission) {
    const publishedCounts = await publishedCountsFor(client, sessionId);
    if (Object.keys(publishedCounts).length > 0 && !acknowledgePublished) {
      return { outcome: "requires_acknowledgement", publishedCounts };
    }
    patch.marketing_permission = false;
    patch.marketing_permission_revoked_at = now;
  }

  if (changes.aiProcessingAllowed === true) {
    if (!changes.aiProcessingBasis
        || !(AI_BASES as readonly string[]).includes(changes.aiProcessingBasis)) {
      throw new Error(`ai processing basis must be one of ${AI_BASES.join(", ")}`);
    }
    patch.ai_processing_allowed = true;
    patch.ai_processing_basis = changes.aiProcessingBasis;
    patch.ai_processing_confirmed_at = now;
  } else if (changes.aiProcessingAllowed === false) {
    patch.ai_processing_allowed = false;
  }

  if (Object.keys(patch).length === 0) return { outcome: "updated" };
  const { error } = await client.from("photography_sessions").update(patch).eq("id", sessionId);
  if (error) throw new Error(`permission update failed: ${error.message}`);
  return { outcome: "updated" };
}
