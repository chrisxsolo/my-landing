// Reads and writes the photographer's light tags and crowd notes for school
// location guide spots (school_spot_conditions). Server-only, service role.
import type { SupabaseClient } from "@supabase/supabase-js";
import { cachePublicContent } from "@/lib/publicContentCache";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { sortLightTags, type LightTag } from "@/lib/photoConditions";
import { isSchoolSpotKey, SCHOOL_SPOT_CONDITIONS_TABLE } from "@/lib/schoolSpots";

export interface SpotCondition {
  lightTags: LightTag[];
  /** Non-null = the spot gets busy; the text says when. */
  crowdNote: string | null;
}
export type SpotConditions = Record<string, SpotCondition>;

/** This school's conditions by spot key. Rows for spots no longer in the guide are dropped. */
export async function loadSpotConditions(client: SupabaseClient, school: string): Promise<SpotConditions> {
  const { data, error } = await client.from(SCHOOL_SPOT_CONDITIONS_TABLE)
    .select("spot_key,light_tags,crowd_note").eq("school_slug", school);
  if (error) throw new Error(`could not read spot conditions: ${error.message}`);
  return Object.fromEntries((data ?? [])
    .filter((row) => isSchoolSpotKey(school, row.spot_key))
    .map((row) => [String(row.spot_key), {
      lightTags: sortLightTags((row.light_tags as string[] | null) ?? []),
      crowdNote: (row.crowd_note as string | null) ?? null,
    }]));
}

/** Saves one spot's conditions; with no tag and no note the row is deleted. */
export async function setSpotConditions(
  client: SupabaseClient, school: string, spotKey: string, condition: SpotCondition,
): Promise<void> {
  if (!isSchoolSpotKey(school, spotKey)) throw new Error("spotKey must be one of this school's guide spots");
  const empty = condition.lightTags.length === 0 && condition.crowdNote === null;
  const { error } = empty
    ? await client.from(SCHOOL_SPOT_CONDITIONS_TABLE).delete().eq("school_slug", school).eq("spot_key", spotKey)
    : await client.from(SCHOOL_SPOT_CONDITIONS_TABLE).upsert({
        school_slug: school, spot_key: spotKey, light_tags: condition.lightTags,
        crowd_note: condition.crowdNote, updated_at: new Date().toISOString(),
      }, { onConflict: "school_slug,spot_key" });
  if (error) throw new Error(`could not save the spot conditions: ${error.message}`);
}

const cachedSpotConditions = cachePublicContent(
  (school: string) => loadSpotConditions(createSupabaseServerClient(), school),
  ["school-spot-conditions"],
);

/**
 * Public guide read. A failed read shows no chips rather than failing the
 * page (they are extra detail); the failure is logged and not cached.
 */
export async function getPublicSpotConditions(school: string): Promise<SpotConditions> {
  try {
    return await cachedSpotConditions(school);
  } catch (err) {
    console.error(`[spot-conditions] could not load conditions for ${school}`, err);
    return {};
  }
}
