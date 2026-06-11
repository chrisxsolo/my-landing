// Loads the rows deriveSessionEngineState needs (spec §6 consumer) and derives
// the state for one or many sessions. ONLY active-package items are passed in.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deriveSessionEngineState, type SessionEngineState,
  type PhotoState, type PackageState, type ItemState,
} from "@/lib/contentEngine/state";

export interface SessionStateBundle {
  state: SessionEngineState;
  photoCount: number;
  itemCounts: Record<string, number>;
  activePackageId: string | null;
}

export async function assembleSessionStates(
  client: SupabaseClient, sessionIds: string[], now = new Date(),
): Promise<Map<string, SessionStateBundle>> {
  const result = new Map<string, SessionStateBundle>();
  if (sessionIds.length === 0) return result;

  const [{ data: photos }, { data: packages }] = await Promise.all([
    client.from("session_photos")
      .select("photography_session_id,excluded,analysis_status,analysis_lease_expires_at")
      .in("photography_session_id", sessionIds),
    client.from("session_content_packages")
      .select("id,photography_session_id,status")
      .in("photography_session_id", sessionIds)
      .is("archived_at", null),
  ]);

  const pkgIds = (packages ?? []).map((p) => p.id as string);
  const { data: items } = pkgIds.length
    ? await client.from("session_content_items")
        .select("package_id,status,publishing_started_at").in("package_id", pkgIds)
    : { data: [] as { package_id: string; status: string; publishing_started_at: string | null }[] };

  for (const sessionId of sessionIds) {
    const sessionPhotos = (photos ?? []).filter((p) => p.photography_session_id === sessionId);
    const activePackage = (packages ?? []).find((p) => p.photography_session_id === sessionId) ?? null;
    const activeItems = activePackage
      ? (items ?? []).filter((i) => i.package_id === activePackage.id)
      : [];

    const state = deriveSessionEngineState({
      photos: sessionPhotos.map((p): PhotoState => ({
        excluded: p.excluded as boolean,
        analysis_status: p.analysis_status as PhotoState["analysis_status"],
        analysis_lease_expires_at: p.analysis_lease_expires_at as string | null,
      })),
      activePackage: activePackage ? ({ status: activePackage.status } as PackageState) : null,
      activeItems: activeItems.map((i): ItemState => ({
        status: i.status as ItemState["status"],
        publishing_started_at: i.publishing_started_at as string | null,
      })),
      now,
    });

    const itemCounts: Record<string, number> = {};
    for (const i of activeItems) itemCounts[i.status] = (itemCounts[i.status] ?? 0) + 1;
    result.set(sessionId, {
      state, photoCount: sessionPhotos.length, itemCounts,
      activePackageId: (activePackage?.id as string | undefined) ?? null,
    });
  }
  return result;
}
