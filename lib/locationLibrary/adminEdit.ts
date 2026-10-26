// Admin writes to a library location: field edits (with locks), publishing,
// featured session/photo, place assignment, manual create and delete.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureDerivativesForPhotos } from "@/lib/contentEngine/derivatives";
import { loadKnownPlaces } from "@/lib/locations/registry";
import {
  LocationEditError, nextLockedFields, parseLocationPatch, placeDefaults, publishProblems,
} from "@/lib/locationLibrary/editRules";
import { loadLibraryLocations, type LibraryLocation } from "@/lib/locationLibrary/load";
import { draftRowFor, loadSyncContext } from "@/lib/locationLibrary/sync";
import { rowForKey } from "@/lib/locationLibrary/syncPlan";
import { LOCATIONS_TABLE, isLibraryRegion } from "@/lib/locationLibrary/taxonomy";
import { slugifyLocation } from "@/lib/bayAreaLocations";

export async function loadOne(client: SupabaseClient, id: number): Promise<LibraryLocation> {
  const { locations } = await loadLibraryLocations(client, { ids: [id] });
  if (!locations[0]) throw new LocationEditError("location not found", 404);
  return locations[0];
}

async function featuredPhotoFields(
  client: SupabaseClient, loc: LibraryLocation, photoId: unknown, approve: boolean,
): Promise<Record<string, unknown>> {
  if (photoId === null) return { featured_photo_id: null };
  const photo = loc.photos.find((p) => p.id === photoId);
  if (!photo || photo.state === "hidden" || photo.state === "excluded") {
    throw new LocationEditError("that photo is not part of this location");
  }
  if (photo.state === "unassigned") throw new LocationEditError("assign that photo to this location first");
  if (photo.state === "not_public") {
    if (!approve) throw new LocationEditError("that photo has no public web copy yet — confirm to publish it", 409);
    const { data: s, error } = await client.from("photography_sessions")
      .select("marketing_permission,marketing_permission_revoked_at").eq("id", photo.sessionId).maybeSingle();
    if (error) throw new Error(`could not check marketing permission: ${error.message}`);
    if (!s?.marketing_permission || s.marketing_permission_revoked_at) {
      throw new LocationEditError("this session does not have marketing permission");
    }
    await ensureDerivativesForPhotos(client, photo.sessionId, [photo.id]);
  }
  return { featured_photo_id: photo.id, featured_session_id: photo.sessionId };
}

function featuredSessionFields(loc: LibraryLocation, sessionId: unknown): Record<string, unknown> {
  if (sessionId === null) return { featured_session_id: null };
  if (!loc.links.some((l) => l.sessionId === sessionId && !l.excluded)) {
    throw new LocationEditError("that session is not linked to this location");
  }
  return { featured_session_id: sessionId, featured_photo_id: null };
}

async function placeKeyFields(client: SupabaseClient, loc: LibraryLocation, key: unknown) {
  if (loc.row.location_key) throw new LocationEditError("this location already has a place — merge instead", 409);
  const ctx = await loadSyncContext(client);
  const place = ctx.places.find((p) => p.key === key);
  if (!place) throw new LocationEditError("unknown place");
  if (rowForKey(ctx.rows, place.key)) throw new LocationEditError(`${place.name} already has a library location — merge them`, 409);
  return { location_key: place.key };
}

async function publishFields(loc: LibraryLocation, active: unknown, pending: Record<string, unknown>) {
  if (typeof active !== "boolean") throw new LocationEditError("active must be true or false");
  if (!active) return { active: false };
  const problems = publishProblems({
    title: String(pending.title ?? loc.row.title), description: String(pending.description ?? loc.row.description),
  });
  if (problems.length) throw new LocationEditError(`add ${problems.join(" and ")} before publishing`);
  return { active: true, needs_review: false };
}

/** Applies one admin PATCH. Returns the reloaded location. */
export async function updateLocation(
  client: SupabaseClient, id: number, body: Record<string, unknown>,
): Promise<LibraryLocation> {
  const loc = await loadOne(client, id);
  const { fields, lock, unlock } = parseLocationPatch(body);
  const defaults = loc.place ? placeDefaults(loc.place) : {};
  const updates: Record<string, unknown> = { ...fields };
  for (const f of unlock) if (f in defaults) updates[f] = defaults[f as keyof typeof defaults];
  if (lock.length || unlock.length) updates.locked_fields = nextLockedFields(loc.row.locked_fields, lock, unlock);
  if ("featured_session_id" in body) Object.assign(updates, featuredSessionFields(loc, body.featured_session_id));
  if ("featured_photo_id" in body) {
    Object.assign(updates, await featuredPhotoFields(client, loc, body.featured_photo_id, body.approve === true));
  }
  if ("location_key" in body) Object.assign(updates, await placeKeyFields(client, loc, body.location_key));
  if ("active" in body) Object.assign(updates, await publishFields(loc, body.active, updates));
  if ("needs_review" in body && typeof body.needs_review === "boolean") updates.needs_review = body.needs_review;
  if (Object.keys(updates).length === 0) throw new LocationEditError("nothing to update");

  const { error } = await client.from(LOCATIONS_TABLE).update(updates).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new LocationEditError("another location already uses that slug or place", 409);
    throw new Error(`could not save the location: ${error.message}`);
  }
  return loadOne(client, id);
}

/** { placeKey } creates a draft from a verified place; { title, city, region } a custom one. */
export async function createLocation(client: SupabaseClient, body: Record<string, unknown>): Promise<number> {
  const ctx = await loadSyncContext(client);
  const order = Math.max(0, ...ctx.rows.map((r) => r.order)) + 1;
  const slugs = new Set(ctx.rows.map((r) => r.slug));
  let row: Record<string, unknown>;
  if (typeof body.placeKey === "string" && body.placeKey) {
    const place = (await loadKnownPlaces(client)).find((p) => p.key === body.placeKey);
    if (!place) throw new LocationEditError("unknown place");
    if (rowForKey(ctx.rows, place.key)) throw new LocationEditError(`${place.name} is already in the library`, 409);
    row = { ...draftRowFor(place, slugs, order), origin: "manual" };
  } else {
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
    const city = typeof body.city === "string" ? body.city.trim().slice(0, 80) : "";
    if (!title || !city) throw new LocationEditError("name and city are required");
    if (!isLibraryRegion(body.region)) throw new LocationEditError("unknown region");
    const base = slugifyLocation(title) || "location";
    let slug = base;
    for (let n = 2; slugs.has(slug); n += 1) slug = `${base}-${n}`;
    row = {
      title, city, region: body.region, slug, neighborhood: null,
      description: "", best_for: "", best_time: "", tip: "", tags: [], environments: [],
      order, active: false, needs_review: true, origin: "manual",
    };
  }
  const { data, error } = await client.from(LOCATIONS_TABLE).insert(row).select("id").single();
  if (error) throw new Error(`could not create the location: ${error.message}`);
  return data.id as number;
}

/**
 * Deletes a location only when no session was ever linked. A linked place
 * would be re-created by the next sync, so those are unpublished or merged.
 */
export async function deleteLocation(client: SupabaseClient, id: number): Promise<void> {
  const loc = await loadOne(client, id);
  if (loc.links.length > 0) {
    throw new LocationEditError("sessions are linked here — unpublish it or merge it instead", 409);
  }
  const { error } = await client.from(LOCATIONS_TABLE).delete().eq("id", id);
  if (error) throw new Error(`could not delete the location: ${error.message}`);
}
