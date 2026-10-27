// Executes a tag plan (lib/photoTagging/plan.ts). Server-only, service role.
// Writes ONLY categorization fields, through the same code paths the admin
// already uses:
//   portfolio_images.category_slug/category_id/school/location (school must be
//     a registered slug — built-in or content_engine_schools — like a session's)
//   session_photos.photo_location (+ source, confirmed_at) — one photo only
//   photography_sessions facts via updateSessionFacts (same validation as Session facts)
//   school_spot_photos via setSpotTag (same as Page Photos)
// It never writes publication state, curation pins, location_spots or
// campus_spot_auto_photos, so manual picks and drafts are untouched. Each
// write is idempotent: re-running a plan leaves the same values.
//
// Results are counted per photo field: an outcome is "updated" only when the
// write carrying it succeeded; otherwise it is "failed" with that write's error.
// Every updated field is then recorded in photo_change_log (who, before,
// after); a failed log write is logged to the console and never fails the apply.
import type { SupabaseClient } from "@supabase/supabase-js";
import { updateSessionFacts } from "@/lib/contentEngine/createSession";
import { findSchool } from "@/lib/contentEngine/schoolStore";
import { setSpotTag } from "@/lib/pagePhotos/spotTagStore";
import { entriesFromOutcomes, type ChangeActor } from "@/lib/photoChangeLog/entries";
import { logChanges } from "@/lib/photoChangeLog/log";
import type { LibraryEntry } from "@/lib/photoTagging/assemble";
import { planTagChanges, writeIdOf, type TagOutcome, type TagPlan, type TagWrite } from "@/lib/photoTagging/plan";
import {
  canonicalCategory, PORTFOLIO_IMAGES_TABLE, SESSION_PHOTOS_TABLE, type TagChanges,
} from "@/lib/photoTagging/types";

export interface ApplyCounts {
  updated: number;
  failed: number;
  kept: number;
  skipped: number;
  conflicts: number;
}

export interface ApplyResult extends ApplyCounts {
  outcomes: TagOutcome[];
  failures: string[];
  /** Sessions whose facts or photo locations changed (their location-library rows need a sync). */
  sessionIds: string[];
}

interface CategoryRow { id: number; slug: string }

const PORTFOLIO_CATEGORIES_TABLE = "portfolio_categories";

async function loadCategories(client: SupabaseClient): Promise<CategoryRow[]> {
  const { data, error } = await client.from(PORTFOLIO_CATEGORIES_TABLE).select("id,slug");
  if (error) throw new Error(`could not load categories: ${error.message}`);
  return (data ?? []) as CategoryRow[];
}

/** An update that matched no row is a failure, not a success. */
async function updateOne(query: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (!Array.isArray(data) || data.length === 0) throw new Error(`${what} no longer exists`);
}

async function writePortfolio(
  client: SupabaseClient, write: Extract<TagWrite, { kind: "portfolio" }>, categories: () => Promise<CategoryRow[]>,
): Promise<void> {
  const { category, ...rest } = write.patch;
  const patch: Record<string, unknown> = { ...rest };
  // Same registry the session facts use: built-in schools plus content_engine_schools.
  if (typeof rest.school === "string" && !(await findSchool(client, rest.school))) {
    throw new Error(`unknown school "${rest.school}" — add it to the school list first`);
  }
  if (category !== undefined) {
    // The table stores raw category slugs (graduation, family); find the real row.
    const row = (await categories()).find((c) => canonicalCategory(c.slug) === category);
    if (!row) throw new Error(`no portfolio category for "${category}"`);
    patch.category_slug = row.slug;
    patch.category_id = row.id;
  }
  await updateOne(client.from(PORTFOLIO_IMAGES_TABLE).update(patch).eq("id", write.portfolioId).select("id"), "the photo");
}

async function writePhotoLocation(client: SupabaseClient, write: Extract<TagWrite, { kind: "photo" }>): Promise<void> {
  const { location, source, evidence } = write.patch;
  const patch = location === null
    ? { photo_location: null, photo_location_source: null, photo_location_evidence: null, photo_location_confirmed_at: null }
    : {
      photo_location: location, photo_location_source: source, photo_location_evidence: evidence,
      photo_location_confirmed_at: new Date().toISOString(),
    };
  await updateOne(client.from(SESSION_PHOTOS_TABLE).update(patch).eq("id", write.enginePhotoId).select("id"), "the photo");
}

async function execute(client: SupabaseClient, write: TagWrite, categories: () => Promise<CategoryRow[]>): Promise<void> {
  if (write.kind === "portfolio") return writePortfolio(client, write, categories);
  if (write.kind === "photo") return writePhotoLocation(client, write);
  if (write.kind === "session") {
    await updateSessionFacts({ client, sessionId: write.sessionId, facts: { ...write.patch } });
    return;
  }
  await setSpotTag(client, write.school, write.url, write.spotKey);
}

function describe(write: TagWrite): string {
  if (write.kind === "portfolio") return `portfolio photo ${write.portfolioId}`;
  if (write.kind === "photo") return `Content Engine photo ${write.enginePhotoId}`;
  if (write.kind === "session") return `session ${write.sessionId}`;
  return `spot tag on ${write.url}`;
}

/** Counts and per-field outcomes, given which writes failed (write id → error). */
export function summarize(plan: TagPlan, errors: ReadonlyMap<string, string>): ApplyResult {
  const outcomes = plan.outcomes.map((o): TagOutcome => (o.result === "updated" && o.writeId && errors.has(o.writeId)
    ? { ...o, result: "failed", reason: errors.get(o.writeId) ?? "write failed" } : o));
  const count = (result: TagOutcome["result"]) => outcomes.filter((o) => o.result === result).length;
  const succeeded = plan.writes.filter((w) => !errors.has(writeIdOf(w)));
  return {
    updated: count("updated"), failed: count("failed"), kept: count("kept"), skipped: count("skipped"),
    conflicts: count("conflict"), outcomes, failures: [...errors.values()],
    sessionIds: [...new Set(succeeded.flatMap((w) => (w.kind === "session" || w.kind === "photo") && w.sessionId ? [w.sessionId] : []))],
  };
}

export interface ExecuteOptions {
  /** Who is making the change (default "manual": an admin edit). */
  actor?: ChangeActor;
  /** Why, for the history ("undo", "restore #12", "apply-high"). */
  reason?: string | null;
}

export async function executePlan(client: SupabaseClient, plan: TagPlan, opts: ExecuteOptions = {}): Promise<ApplyResult> {
  let categories: Promise<CategoryRow[]> | null = null;
  const lazyCategories = () => (categories ??= loadCategories(client));
  const errors = new Map<string, string>();
  // Rows first: a spot write may depend on a school written in the same plan.
  const ordered = [...plan.writes].sort((a, b) => Number(a.kind === "spot") - Number(b.kind === "spot"));
  for (const write of ordered) {
    const id = writeIdOf(write);
    try {
      if (write.kind === "spot" && write.dependsOn && errors.has(write.dependsOn)) {
        throw new Error("not tagged — the university it belongs to could not be saved");
      }
      await execute(client, write, lazyCategories);
    } catch (err) {
      const message = `${describe(write)}: ${err instanceof Error ? err.message : String(err)}`;
      console.error("[photo-tagging] write failed", message);
      errors.set(id, message);
    }
  }
  const result = summarize(plan, errors);
  await logChanges(client, entriesFromOutcomes(result.outcomes, opts.actor ?? "manual", opts.reason ?? null));
  return result;
}

/** The plan for an explicit edit on the chosen photos. */
export function planForEntries(entries: readonly LibraryEntry[], changes: TagChanges, replace: boolean): TagPlan {
  return planTagChanges(entries.map((e) => e.target), changes, replace);
}
