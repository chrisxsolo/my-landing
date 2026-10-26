// Admin corrections to what belongs to a location: per-photo hide/include,
// session remove / restore / move / attach, and merging duplicates. Every
// correction is recorded so the next sync respects it (an excluded auto link
// is a tombstone; manual links are never touched by sync).
import type { SupabaseClient } from "@supabase/supabase-js";
import { LocationEditError } from "@/lib/locationLibrary/editRules";
import { loadOne } from "@/lib/locationLibrary/adminEdit";
import { LOCATIONS_TABLE, LOCATION_SESSIONS_TABLE, PHOTO_OVERRIDES_TABLE } from "@/lib/locationLibrary/taxonomy";

const isUuidLike = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function fail(error: { message: string } | null, what: string) {
  if (error) throw new Error(`could not ${what}: ${error.message}`);
}

/** mode 'include' | 'hide' records a correction; null returns the photo to automatic. */
export async function setPhotoOverride(
  client: SupabaseClient, locationId: number, photoId: unknown, mode: unknown,
): Promise<void> {
  if (!isUuidLike(photoId)) throw new LocationEditError("photoId must be a uuid");
  const loc = await loadOne(client, locationId);
  if (!loc.photos.some((p) => p.id === photoId)) throw new LocationEditError("that photo is not from a session linked here");
  if (mode === null) {
    const { error } = await client.from(PHOTO_OVERRIDES_TABLE).delete()
      .eq("location_id", locationId).eq("session_photo_id", photoId);
    return fail(error, "reset the photo");
  }
  if (mode !== "include" && mode !== "hide") throw new LocationEditError("mode must be include, hide or null");
  const { error } = await client.from(PHOTO_OVERRIDES_TABLE)
    .upsert({ location_id: locationId, session_photo_id: photoId, mode }, { onConflict: "location_id,session_photo_id" });
  fail(error, "save the photo choice");
  if (mode === "hide" && loc.row.featured_photo_id === photoId) {
    const { error: e2 } = await client.from(LOCATIONS_TABLE).update({ featured_photo_id: null }).eq("id", locationId);
    fail(e2, "clear the hidden hero");
  }
}

async function clearFeaturedSession(client: SupabaseClient, locationId: number, sessionId: string) {
  const { error } = await client.from(LOCATIONS_TABLE)
    .update({ featured_session_id: null, featured_photo_id: null })
    .eq("id", locationId).eq("featured_session_id", sessionId);
  fail(error, "clear the featured session");
}

/** Removes a session from this location. Auto links become tombstones; manual links are deleted. */
export async function excludeSession(client: SupabaseClient, locationId: number, sessionId: string): Promise<void> {
  const { data, error } = await client.from(LOCATION_SESSIONS_TABLE).select("id,source")
    .eq("location_id", locationId).eq("photography_session_id", sessionId).maybeSingle();
  fail(error, "load the link");
  if (!data) throw new LocationEditError("that session is not linked here", 404);
  const res = data.source === "manual"
    ? await client.from(LOCATION_SESSIONS_TABLE).delete().eq("id", data.id)
    : await client.from(LOCATION_SESSIONS_TABLE).update({ excluded: true, updated_at: new Date().toISOString() }).eq("id", data.id);
  fail(res.error, "remove the session");
  await clearFeaturedSession(client, locationId, sessionId);
}

/** Links a session by hand (or restores a removed auto link). */
export async function attachSession(client: SupabaseClient, locationId: number, sessionId: string): Promise<void> {
  const { data: session, error: sErr } = await client.from("photography_sessions").select("id").eq("id", sessionId).maybeSingle();
  fail(sErr, "load the session");
  if (!session) throw new LocationEditError("session not found", 404);
  const { error } = await client.from(LOCATION_SESSIONS_TABLE).upsert(
    { location_id: locationId, photography_session_id: sessionId, source: "manual", excluded: false, updated_at: new Date().toISOString() },
    { onConflict: "location_id,photography_session_id" },
  );
  fail(error, "link the session");
}

/** "This session was really at another place": remove here, link there. */
export async function moveSession(
  client: SupabaseClient, fromId: number, sessionId: string, toId: number,
): Promise<void> {
  if (fromId === toId) throw new LocationEditError("pick a different location");
  await loadOne(client, toId);
  await attachSession(client, toId, sessionId);
  await excludeSession(client, fromId, sessionId);
}

export async function mergeLocations(client: SupabaseClient, targetId: number, sourceId: number): Promise<void> {
  if (targetId === sourceId) throw new LocationEditError("pick a different location to merge");
  const { error } = await client.rpc("merge_library_locations", { p_target: targetId, p_source: sourceId });
  if (error) {
    if (/not found/i.test(error.message)) throw new LocationEditError("location not found", 404);
    throw new Error(`could not merge: ${error.message}`);
  }
}

export function parseSessionId(value: unknown): string {
  if (!isUuidLike(value)) throw new LocationEditError("sessionId must be a uuid");
  return value.toLowerCase();
}
