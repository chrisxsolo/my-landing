// Writes the photographer's campus-spot tags (school_spot_photos). Server-only,
// service role. Idempotent: repeating a call leaves the same single row, and a
// photo has at most one spot per school.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSchoolSpotKey, SCHOOL_SPOT_PHOTOS_TABLE } from "@/lib/schoolSpots";

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`could not ${what}: ${error.message}`);
}

async function nextPosition(client: SupabaseClient, school: string, spotKey: string): Promise<number> {
  const { data, error } = await client.from(SCHOOL_SPOT_PHOTOS_TABLE)
    .select("position").eq("school_slug", school).eq("spot_key", spotKey);
  check(error, "read spot photos");
  return Math.max(0, ...(data ?? []).map((r) => Number(r.position) || 0)) + 1;
}

async function currentTag(client: SupabaseClient, school: string, imageUrl: string) {
  const { data, error } = await client.from(SCHOOL_SPOT_PHOTOS_TABLE)
    .select("spot_key,position,is_featured").eq("school_slug", school).eq("image_url", imageUrl).maybeSingle();
  check(error, "read the photo's spot");
  return data as { spot_key: string; position: number; is_featured: boolean } | null;
}

/**
 * Tags one photo with a campus spot (or clears it with spotKey null).
 * featured=true makes it that spot's lead photo, replacing the previous one.
 */
export async function setSpotTag(
  client: SupabaseClient, school: string, imageUrl: string, spotKey: string | null, featured = false,
): Promise<void> {
  if (spotKey === null) {
    const { error } = await client.from(SCHOOL_SPOT_PHOTOS_TABLE).delete()
      .eq("school_slug", school).eq("image_url", imageUrl);
    check(error, "clear the photo's spot");
    return;
  }
  if (!isSchoolSpotKey(school, spotKey)) throw new Error("spotKey must be one of this school's guide spots");

  const existing = await currentTag(client, school, imageUrl);
  if (featured) {
    // Clear the old lead first: the one-featured-per-spot index rejects two.
    const { error } = await client.from(SCHOOL_SPOT_PHOTOS_TABLE).update({ is_featured: false })
      .eq("school_slug", school).eq("spot_key", spotKey).eq("is_featured", true).neq("image_url", imageUrl);
    check(error, "clear the previous featured photo");
  }
  const position = existing && existing.spot_key === spotKey
    ? existing.position
    : await nextPosition(client, school, spotKey);
  const { error } = await client.from(SCHOOL_SPOT_PHOTOS_TABLE).upsert({
    school_slug: school, image_url: imageUrl, spot_key: spotKey,
    is_featured: featured, position, updated_at: new Date().toISOString(),
  }, { onConflict: "school_slug,image_url" });
  check(error, "save the photo's spot");
}
