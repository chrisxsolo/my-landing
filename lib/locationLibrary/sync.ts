// Applies location sync plans to the database. Idempotent by construction:
// one row per place key (unique index; a lost insert race re-reads the
// winner), links are insert-if-absent (never flips an excluded or manual
// link), and only auto links that stopped matching are removed. Nothing here
// calls a model — the AI profile runs separately on the drafts it creates.
// Every read is paged past PostgREST's row cap and throws on a failed page, so
// a link is never removed because of a partial read. Each change to a
// session's links is recorded in photo_change_log as a "system" change.
import type { SupabaseClient } from "@supabase/supabase-js";
import { linkChangeEntry } from "@/lib/photoChangeLog/entries";
import { logChanges } from "@/lib/photoChangeLog/log";
import { medianCoordinates, matchPlacesByName, type Coordinates } from "@/lib/locations/match";
import type { KnownPlace } from "@/lib/locations/places";
import { loadKnownPlaces } from "@/lib/locations/registry";
import type { CampusEvidence } from "@/lib/locationLibrary/campusEvidence";
import { slugifyLocation } from "@/lib/bayAreaLocations";
import { fetchAllPages } from "@/lib/supabasePaging";
import {
  planSessionSync, rowForKey, type LibraryRowRef, type SessionLinkRef, type SyncPlan, type SyncSession,
} from "@/lib/locationLibrary/syncPlan";
import { LOCATIONS_TABLE, LOCATION_SESSIONS_TABLE, regionForPlace } from "@/lib/locationLibrary/taxonomy";

export interface SyncContext {
  places: KnownPlace[];
  rows: (LibraryRowRef & { slug: string; title: string; order: number })[];
}

export interface SessionSyncReport {
  sessionId: string;
  status: SyncPlan["status"];
  message: string;
  createdKeys: string[];
  createdLocationIds: number[];
  linkedKeys: string[];
  removedLinks: number;
  /** Schools / campus spots the location named — recorded on the session, never made into places. */
  campus: CampusEvidence[];
  dryRun: boolean;
}

const PG_UNIQUE_VIOLATION = "23505";

type Row = Record<string, unknown>;

export async function loadSyncContext(client: SupabaseClient): Promise<SyncContext> {
  const [places, rowData] = await Promise.all([
    loadKnownPlaces(client),
    fetchAllPages<Row>((from, to) => client.from(LOCATIONS_TABLE)
      .select("id,location_key,alias_keys,slug,title,order").order("id").range(from, to), "library locations"),
  ]);
  const rows = rowData.map((r) => ({
    id: r.id as number,
    locationKey: (r.location_key as string | null) ?? null,
    aliasKeys: (r.alias_keys as string[] | null) ?? [],
    slug: r.slug as string,
    title: r.title as string,
    order: (r.order as number) ?? 0,
  }));
  return { places, rows };
}

async function loadSyncSession(client: SupabaseClient, sessionId: string): Promise<SyncSession | null> {
  // Every photo counts: the median GPS of a partial read can name another place.
  const [sessionRes, photos] = await Promise.all([
    client.from("photography_sessions")
      .select("id,primary_location,secondary_locations,school_slug,marketing_permission,marketing_permission_revoked_at")
      .eq("id", sessionId).maybeSingle(),
    fetchAllPages<Row>((from, to) => client.from("session_photos")
      .select("id,gps_latitude,gps_longitude,public_derivative_url")
      .eq("photography_session_id", sessionId).eq("excluded", false).order("id").range(from, to), "session photos"),
  ]);
  if (sessionRes.error) throw new Error(`could not load session: ${sessionRes.error.message}`);
  const s = sessionRes.data;
  if (!s) return null;
  const points: Coordinates[] = photos
    .filter((p) => typeof p.gps_latitude === "number" && typeof p.gps_longitude === "number")
    .map((p) => ({ latitude: p.gps_latitude as number, longitude: p.gps_longitude as number }));
  const permissionOk = !!s.marketing_permission && !s.marketing_permission_revoked_at;
  return {
    id: s.id as string,
    primaryLocation: (s.primary_location as string | null) ?? null,
    secondaryLocations: (s.secondary_locations as string[] | null) ?? [],
    schoolSlug: (s.school_slug as string | null) ?? null,
    gps: medianCoordinates(points),
    approved: permissionOk && photos.some((p) => !!p.public_derivative_url),
  };
}

async function loadSessionLinks(client: SupabaseClient, sessionId: string): Promise<SessionLinkRef[]> {
  const data = await fetchAllPages<Row>((from, to) => client.from(LOCATION_SESSIONS_TABLE)
    .select("id,location_id,source,excluded").eq("photography_session_id", sessionId).order("id").range(from, to),
  "session links");
  return data.map((l) => ({
    id: l.id as string, locationId: l.location_id as number,
    source: l.source as "auto" | "manual", excluded: !!l.excluded,
  }));
}

function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = slugifyLocation(base) || "location";
  if (!taken.has(root)) return root;
  for (let n = 2; ; n += 1) if (!taken.has(`${root}-${n}`)) return `${root}-${n}`;
}

/** A review draft built only from the place's verified geography. */
export function draftRowFor(place: KnownPlace, takenSlugs: ReadonlySet<string>, order: number) {
  return {
    title: place.name,
    slug: uniqueSlug(place.key, takenSlugs),
    region: regionForPlace(place),
    city: place.city,
    neighborhood: place.city === "San Francisco" ? place.areaTerms[0] ?? null : null,
    description: "", best_for: "", best_time: "", tip: "",
    tags: [], environments: [],
    order, active: false, needs_review: true, origin: "engine",
    location_key: place.key,
  };
}

async function createDraft(client: SupabaseClient, ctx: SyncContext, place: KnownPlace): Promise<number> {
  const row = draftRowFor(place, new Set(ctx.rows.map((r) => r.slug)), Math.max(0, ...ctx.rows.map((r) => r.order)) + 1);
  const { data, error } = await client.from(LOCATIONS_TABLE).insert(row).select("id").single();
  if (error && error.code !== PG_UNIQUE_VIOLATION) throw new Error(`could not create ${place.name}: ${error.message}`);
  if (data) {
    ctx.rows.push({ id: data.id as number, locationKey: place.key, aliasKeys: [], slug: row.slug, title: row.title, order: row.order });
    return data.id as number;
  }
  // Another sync created it first — use theirs.
  const fresh = await loadSyncContext(client);
  ctx.rows.splice(0, ctx.rows.length, ...fresh.rows);
  const winner = rowForKey(ctx.rows, place.key);
  if (!winner) throw new Error(`could not create ${place.name}: ${error?.message}`);
  return winner.id;
}

/** Dry runs remember the drafts they would create, so a preview lists each place once. */
function simulateDrafts(ctx: SyncContext, places: readonly KnownPlace[]): void {
  for (const place of places) {
    ctx.rows.push({ id: -(ctx.rows.length + 1), locationKey: place.key, aliasKeys: [], slug: place.key, title: place.name, order: 0 });
  }
}

async function writeSessionStatus(
  client: SupabaseClient, sessionId: string, status: SyncPlan["status"], message: string,
): Promise<void> {
  const { error } = await client.from("photography_sessions").update({
    location_sync_status: status, location_sync_message: message.slice(0, 500),
    location_synced_at: new Date().toISOString(),
  }).eq("id", sessionId);
  if (error) console.error(`[location-library] could not record sync status for ${sessionId}`, error.message);
}

/** The location ids a session is linked to after the plan: current links minus removals, plus the new auto links. */
function linksAfter(links: readonly SessionLinkRef[], plan: SyncPlan, linkedIds: readonly number[]): number[] {
  const removed = new Set(plan.removeLinkIds);
  return [...links.filter((l) => !l.excluded && !removed.has(l.id)).map((l) => l.locationId), ...linkedIds];
}

async function applyPlan(
  client: SupabaseClient, ctx: SyncContext, sessionId: string, plan: SyncPlan, links: readonly SessionLinkRef[],
): Promise<number[]> {
  const created: number[] = [];
  for (const place of plan.createFor) created.push(await createDraft(client, ctx, place));

  const linkedIds = plan.linkKeys
    .map((key) => rowForKey(ctx.rows, key)?.id)
    .filter((id): id is number => id !== undefined);
  const linkRows = linkedIds
    .map((locationId) => ({ location_id: locationId, photography_session_id: sessionId, source: "auto" }));
  if (linkRows.length > 0) {
    const { error } = await client.from(LOCATION_SESSIONS_TABLE)
      .upsert(linkRows, { onConflict: "location_id,photography_session_id", ignoreDuplicates: true });
    if (error) throw new Error(`could not link the session: ${error.message}`);
  }
  if (plan.removeLinkIds.length > 0) {
    const { error } = await client.from(LOCATION_SESSIONS_TABLE).delete()
      .in("id", plan.removeLinkIds).eq("source", "auto").eq("excluded", false);
    if (error) throw new Error(`could not remove stale links: ${error.message}`);
  }
  const before = links.filter((l) => !l.excluded).map((l) => l.locationId);
  const change = linkChangeEntry(sessionId, before, linksAfter(links, plan, linkedIds), plan.message);
  if (change) await logChanges(client, [change]);
  return created;
}

export async function syncSessionLocations(
  client: SupabaseClient, sessionId: string, opts: { dryRun?: boolean; ctx?: SyncContext } = {},
): Promise<SessionSyncReport> {
  const dryRun = opts.dryRun ?? false;
  const base = { sessionId, createdKeys: [], createdLocationIds: [], linkedKeys: [], removedLinks: 0, campus: [], dryRun };
  try {
    const ctx = opts.ctx ?? await loadSyncContext(client);
    const session = await loadSyncSession(client, sessionId);
    if (!session) return { ...base, status: "error", message: "session not found" };
    const links = await loadSessionLinks(client, sessionId);
    const plan = planSessionSync(session, ctx.places, ctx.rows, links);
    const createdLocationIds = dryRun ? [] : await applyPlan(client, ctx, sessionId, plan, links);
    if (dryRun) simulateDrafts(ctx, plan.createFor);
    if (!dryRun) await writeSessionStatus(client, sessionId, plan.status, plan.message);
    return {
      ...base, status: plan.status, message: plan.message,
      createdKeys: plan.createFor.map((p) => p.key), createdLocationIds,
      linkedKeys: plan.linkKeys, removedLinks: plan.removeLinkIds.length, campus: plan.campus,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "location sync failed";
    console.error(`[location-library] sync failed for session ${sessionId}`, err);
    if (!dryRun) await writeSessionStatus(client, sessionId, "error", message);
    return { ...base, status: "error", message };
  }
}

export interface LegacyClaim {
  locationId: number;
  title: string;
  key: string;
}

/**
 * Hand-written rows that predate the library get the place key their title
 * names — exact name/alias only, one match, key not already used. Their
 * content is untouched (it is locked by the migration).
 */
export async function claimLegacyRows(
  client: SupabaseClient, ctx: SyncContext, dryRun: boolean,
): Promise<LegacyClaim[]> {
  const used = new Set(ctx.rows.flatMap((r) => [r.locationKey, ...r.aliasKeys]).filter(Boolean) as string[]);
  const claims: LegacyClaim[] = [];
  for (const row of ctx.rows.filter((r) => !r.locationKey)) {
    const hits = matchPlacesByName(row.title, ctx.places);
    if (hits.length !== 1 || used.has(hits[0].key)) continue;
    used.add(hits[0].key);
    claims.push({ locationId: row.id, title: row.title.trim(), key: hits[0].key });
  }
  for (const claim of claims) {
    if (!dryRun) {
      const { error } = await client.from(LOCATIONS_TABLE)
        .update({ location_key: claim.key }).eq("id", claim.locationId).is("location_key", null);
      if (error) throw new Error(`could not claim ${claim.title}: ${error.message}`);
    }
    // Later sessions in this run must see the claim, in a dry run too.
    const row = ctx.rows.find((r) => r.id === claim.locationId);
    if (row) row.locationKey = claim.key;
  }
  return claims;
}

export interface FullSyncReport {
  claims: LegacyClaim[];
  sessions: SessionSyncReport[];
  dryRun: boolean;
}

/** Every session, sequentially, sharing one context (so drafts are created once). */
export async function syncAllSessions(
  client: SupabaseClient, opts: { dryRun?: boolean } = {},
): Promise<FullSyncReport> {
  const dryRun = opts.dryRun ?? false;
  const ctx = await loadSyncContext(client);
  const claims = await claimLegacyRows(client, ctx, dryRun);
  const list = await fetchAllPages<Row>((from, to) => client.from("photography_sessions")
    .select("id").order("created_at").order("id").range(from, to), "sessions");
  const sessions: SessionSyncReport[] = [];
  for (const s of list) {
    sessions.push(await syncSessionLocations(client, s.id as string, { dryRun, ctx }));
  }
  return { claims, sessions, dryRun };
}
