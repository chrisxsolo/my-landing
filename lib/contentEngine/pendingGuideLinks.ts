// Server side of pending guide links (pure rules in guideLinks.ts).
//   publish of a location guide → draft/failed journals get the real link;
//                                 approved journals are flagged "ready" only
//                                 (approved content is never changed silently)
//   reject of a location guide  → the dependency is dropped from every
//                                 unpublished journal, unless another proposal
//                                 or a live guide still covers the place
// Published journals are never touched: they never carried the pending link.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyGuideLink, dropPendingGuideLink, markGuideLinkReady,
} from "@/lib/contentEngine/guideLinks";
import { findOpenProposal } from "@/lib/contentEngine/sessionLocation";
import { loadPublishedDbGuides } from "@/lib/locations/registry";
import {
  findGuideForPlace, guideLocationPath, type LocationGuideType,
} from "@/lib/locations/guideCoverage";
import type { PendingGuideLink } from "@/lib/contentEngine/payloads";

interface JournalRow {
  id: string;
  status: string;
  payload_revision: number;
  payload: { body: string; pending_guide_links?: PendingGuideLink[] } & Record<string, unknown>;
}

const UNPUBLISHED = ["draft", "approved", "failed"];

async function journalsWaitingOn(
  client: SupabaseClient, guide: LocationGuideType, locationKey: string,
): Promise<JournalRow[]> {
  const { data, error } = await client.from("session_content_items")
    .select("id,status,payload,payload_revision")
    .eq("content_type", "journal_post")
    .in("status", UNPUBLISHED)
    .contains("payload", { pending_guide_links: [{ guide, location_key: locationKey }] });
  if (error) throw new Error(`could not load journals waiting on ${guide}/${locationKey}: ${error.message}`);
  return (data ?? []) as JournalRow[];
}

/** Optimistic write: a concurrent edit wins and is reported, never clobbered. */
async function writePayload(client: SupabaseClient, row: JournalRow, payload: JournalRow["payload"]) {
  const { data, error } = await client.from("session_content_items")
    .update({ payload, payload_revision: row.payload_revision + 1 })
    .eq("id", row.id)
    .eq("payload_revision", row.payload_revision)
    .select("id");
  if (error) throw new Error(`could not update journal ${row.id}: ${error.message}`);
  return (data ?? []).length > 0;
}

export interface LinkUpdateReport {
  linked: string[];
  flaggedReady: string[];
  dropped: string[];
  conflicts: string[];
}

const emptyReport = (): LinkUpdateReport => ({ linked: [], flaggedReady: [], dropped: [], conflicts: [] });

export async function resolvePendingGuideLinks(
  client: SupabaseClient, guide: LocationGuideType, locationKey: string, slug: string,
): Promise<LinkUpdateReport> {
  const url = guideLocationPath(guide, slug);
  const report = emptyReport();
  for (const row of await journalsWaitingOn(client, guide, locationKey)) {
    const approved = row.status === "approved";
    const next = approved
      ? markGuideLinkReady(row.payload, guide, locationKey)
      : applyGuideLink(row.payload, guide, locationKey, url);
    if (!(await writePayload(client, row, next))) report.conflicts.push(row.id);
    else (approved ? report.flaggedReady : report.linked).push(row.id);
  }
  return report;
}

export async function removePendingGuideLinks(
  client: SupabaseClient, guide: LocationGuideType, locationKey: string,
): Promise<LinkUpdateReport> {
  const report = emptyReport();
  // Another proposal for the same place, or a guide that went live meanwhile,
  // still satisfies the dependency — keep it.
  if (await findOpenProposal(client, guide, locationKey)) return report;
  if (findGuideForPlace(guide, locationKey, await loadPublishedDbGuides(client))) return report;

  for (const row of await journalsWaitingOn(client, guide, locationKey)) {
    const next = dropPendingGuideLink(row.payload, guide, locationKey);
    if (!(await writePayload(client, row, next))) report.conflicts.push(row.id);
    else report.dropped.push(row.id);
  }
  return report;
}
