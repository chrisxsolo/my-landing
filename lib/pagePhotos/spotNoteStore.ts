// Reads and writes the photographer's "Where to find it" notes for school
// location guide spots (school_spot_notes). Server-only, service role.
import type { SupabaseClient } from "@supabase/supabase-js";
import { cachePublicContent } from "@/lib/publicContentCache";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { isSchoolSpotKey, SCHOOL_SPOT_NOTES_TABLE } from "@/lib/schoolSpots";

export type SpotNotes = Record<string, string>;

/** This school's notes by spot key. Notes for spots no longer in the guide are dropped. */
export async function loadSpotNotes(client: SupabaseClient, school: string): Promise<SpotNotes> {
  const { data, error } = await client.from(SCHOOL_SPOT_NOTES_TABLE)
    .select("spot_key,location_note").eq("school_slug", school);
  if (error) throw new Error(`could not read spot notes: ${error.message}`);
  return Object.fromEntries((data ?? [])
    .filter((row) => isSchoolSpotKey(school, row.spot_key))
    .map((row) => [String(row.spot_key), String(row.location_note)]));
}

/** Saves one spot's note, or clears it with null. */
export async function setSpotNote(
  client: SupabaseClient, school: string, spotKey: string, note: string | null,
): Promise<void> {
  if (!isSchoolSpotKey(school, spotKey)) throw new Error("spotKey must be one of this school's guide spots");
  const { error } = note === null
    ? await client.from(SCHOOL_SPOT_NOTES_TABLE).delete().eq("school_slug", school).eq("spot_key", spotKey)
    : await client.from(SCHOOL_SPOT_NOTES_TABLE).upsert({
        school_slug: school, spot_key: spotKey, location_note: note, updated_at: new Date().toISOString(),
      }, { onConflict: "school_slug,spot_key" });
  if (error) throw new Error(`could not save the spot note: ${error.message}`);
}

const cachedSpotNotes = cachePublicContent(
  (school: string) => loadSpotNotes(createSupabaseServerClient(), school),
  ["school-spot-notes"],
);

/**
 * Public guide read. A failed read shows no notes rather than failing the
 * page (the notes are extra detail); the failure is logged and not cached.
 */
export async function getPublicSpotNotes(school: string): Promise<SpotNotes> {
  try {
    return await cachedSpotNotes(school);
  } catch (err) {
    console.error(`[spot-notes] could not load notes for ${school}`, err);
    return {};
  }
}
