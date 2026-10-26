// Reads and writes campus_spot_auto_photos. Server-only, service role.
// Writes are conditional, so concurrent syncs are safe:
//   • claim   — the claim_campus_spot_photo RPC inserts only into an empty
//               spot with an unused photo (ON CONFLICT DO NOTHING)
//   • release — deletes only the exact (school, spot, photo) row it planned to,
//               so a row another sync just claimed is never removed
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CAMPUS_SPOT_AUTO_PHOTOS_TABLE, CLAIM_CAMPUS_SPOT_PHOTO_RPC,
  type AutoRow, type Claim, type FillEvidence,
} from "@/lib/campusSpotFill/match";

// Deployed ahead of its migration: no automatic photos instead of an error.
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);
const EVIDENCE = new Set<FillEvidence>(["tag", "place", "session", "text"]);

function toAutoRow(row: Record<string, unknown>): AutoRow | null {
  const evidence = row.evidence as FillEvidence;
  if (typeof row.image_url !== "string" || !EVIDENCE.has(evidence)) return null;
  return {
    schoolSlug: String(row.school_slug), spotKey: String(row.spot_key),
    imageUrl: row.image_url, evidence,
  };
}

export async function readAutoRows(client: SupabaseClient): Promise<AutoRow[]> {
  const { data, error } = await client.from(CAMPUS_SPOT_AUTO_PHOTOS_TABLE)
    .select("school_slug,spot_key,image_url,evidence");
  if (error && MISSING_TABLE_CODES.has((error as { code?: string }).code ?? "")) {
    console.warn(`[campus-spots] ${CAMPUS_SPOT_AUTO_PHOTOS_TABLE} not migrated yet; no automatic spot photos`);
    return [];
  }
  if (error) throw new Error(`could not read automatic spot photos: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(toAutoRow).filter((r): r is AutoRow => r !== null);
}

export async function releaseAutoRow(client: SupabaseClient, row: AutoRow): Promise<void> {
  const { error } = await client.from(CAMPUS_SPOT_AUTO_PHOTOS_TABLE).delete()
    .eq("school_slug", row.schoolSlug).eq("spot_key", row.spotKey).eq("image_url", row.imageUrl);
  if (error) throw new Error(`could not release ${row.schoolSlug}/${row.spotKey}: ${error.message}`);
}

/** True when this call assigned the photo; false when the spot or photo was taken meanwhile. */
export async function claimSpotPhoto(client: SupabaseClient, claim: Claim): Promise<boolean> {
  const { data, error } = await client.rpc(CLAIM_CAMPUS_SPOT_PHOTO_RPC, {
    p_school_slug: claim.schoolSlug, p_spot_key: claim.spotKey, p_image_url: claim.imageUrl,
    p_evidence: claim.evidence, p_evidence_detail: claim.detail,
  });
  if (error) throw new Error(`could not claim ${claim.schoolSlug}/${claim.spotKey}: ${error.message}`);
  return data === true;
}
