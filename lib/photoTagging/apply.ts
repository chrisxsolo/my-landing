// Executes a tag plan (lib/photoTagging/plan.ts). Server-only, service role.
// Writes ONLY existing categorization fields, through the same code paths
// the admin already uses:
//   portfolio_images.category_slug/category_id/school/location
//   photography_sessions facts via updateSessionFacts (same validation as Session facts)
//   school_spot_photos via setSpotTag (same as Page Photos)
// It never writes publication state, curation pins, location_spots or
// campus_spot_auto_photos, so manual picks and drafts are untouched. Each
// write is idempotent: re-running a plan leaves the same values.
import type { SupabaseClient } from "@supabase/supabase-js";
import { updateSessionFacts } from "@/lib/contentEngine/createSession";
import { setSpotTag } from "@/lib/pagePhotos/spotTagStore";
import type { LibraryEntry } from "@/lib/photoTagging/assemble";
import { planTagChanges, type TagOutcome, type TagPlan, type TagWrite } from "@/lib/photoTagging/plan";
import { canonicalCategory, type TagChanges, type TagField } from "@/lib/photoTagging/types";

export interface ApplyResult {
  updated: number;
  kept: number;
  skipped: number;
  outcomes: TagOutcome[];
  failures: string[];
  /** Sessions whose facts changed (their location-library rows need a sync). */
  sessionIds: string[];
}

interface CategoryRow { id: number; slug: string }

async function loadCategories(client: SupabaseClient): Promise<CategoryRow[]> {
  const { data, error } = await client.from("portfolio_categories").select("id,slug");
  if (error) throw new Error(`portfolio_categories: ${error.message}`);
  return (data ?? []) as CategoryRow[];
}

async function writePortfolio(
  client: SupabaseClient, write: Extract<TagWrite, { kind: "portfolio" }>, categories: CategoryRow[],
): Promise<void> {
  const { category, ...rest } = write.patch;
  const patch: Record<string, unknown> = { ...rest };
  if (category !== undefined) {
    // The table stores raw category slugs (graduation, family); find the real row.
    const row = categories.find((c) => canonicalCategory(c.slug) === category);
    if (!row) throw new Error(`no portfolio category for "${category}"`);
    patch.category_slug = row.slug;
    patch.category_id = row.id;
  }
  const { error } = await client.from("portfolio_images").update(patch).eq("id", write.portfolioId);
  if (error) throw new Error(error.message);
}

async function execute(client: SupabaseClient, write: TagWrite, categories: CategoryRow[]): Promise<void> {
  if (write.kind === "portfolio") return writePortfolio(client, write, categories);
  if (write.kind === "session") {
    await updateSessionFacts({ client, sessionId: write.sessionId, facts: { ...write.patch } });
    return;
  }
  await setSpotTag(client, write.school, write.url, write.spotKey);
}

function describe(write: TagWrite): string {
  if (write.kind === "portfolio") return `portfolio photo ${write.portfolioId}`;
  if (write.kind === "session") return `session ${write.sessionId}`;
  return `spot tag on ${write.url}`;
}

export async function executePlan(client: SupabaseClient, plan: TagPlan): Promise<ApplyResult> {
  const needsCategories = plan.writes.some((w) => w.kind === "portfolio" && w.patch.category !== undefined);
  const categories = needsCategories ? await loadCategories(client) : [];
  const failures: string[] = [];
  // Portfolio and session rows first: a spot write may depend on a new school.
  const ordered = [...plan.writes].sort((a, b) => Number(a.kind === "spot") - Number(b.kind === "spot"));
  for (const write of ordered) {
    try {
      await execute(client, write, categories);
    } catch (err) {
      const message = `${describe(write)}: ${err instanceof Error ? err.message : String(err)}`;
      console.error("[photo-tagging] write failed", message);
      failures.push(message);
    }
  }
  const count = (result: TagOutcome["result"]) => plan.outcomes.filter((o) => o.result === result).length;
  return {
    updated: failures.length === 0 ? count("updated") : Math.max(0, count("updated") - failures.length),
    kept: count("kept"),
    skipped: count("skipped"),
    outcomes: plan.outcomes,
    failures,
    sessionIds: plan.writes.flatMap((w) => (w.kind === "session" ? [w.sessionId] : [])),
  };
}

/** The plan for an explicit edit on the chosen photos. */
export function planForEntries(entries: readonly LibraryEntry[], changes: TagChanges, replace: boolean): TagPlan {
  return planTagChanges(entries.map((e) => e.target), changes, replace);
}

/**
 * Applies every HIGH-confidence suggestion, filling empty fields only. Medium
 * suggestions always wait for the photographer. Safe to repeat: an applied
 * field is no longer missing, so it is never suggested again.
 */
export function planHighConfidence(entries: readonly LibraryEntry[]): TagPlan {
  const plans = entries.map((entry) => {
    const changes: TagChanges = {};
    const seen = new Set<TagField>();
    for (const s of entry.photo.suggestions) {
      if (s.confidence !== "high" || seen.has(s.field) || s.field === "category") continue;
      seen.add(s.field);
      changes[s.field] = s.value;
    }
    return planTagChanges([entry.target], changes, false);
  });
  return {
    writes: dedupeSessionWrites(plans.flatMap((p) => p.writes)),
    outcomes: plans.flatMap((p) => p.outcomes),
  };
}

function dedupeSessionWrites(writes: TagWrite[]): TagWrite[] {
  const sessions = new Map<string, Extract<TagWrite, { kind: "session" }>>();
  const rest: TagWrite[] = [];
  for (const w of writes) {
    if (w.kind !== "session") { rest.push(w); continue; }
    const prev = sessions.get(w.sessionId);
    sessions.set(w.sessionId, { kind: "session", sessionId: w.sessionId, patch: { ...w.patch, ...prev?.patch } });
  }
  return [...rest, ...sessions.values()];
}
