// Writes the admin's per-page photo choices (page_photo_curation) and the
// school tag on portfolio photos. Server-only, service role. Every action is
// idempotent: repeating it leaves the same single row.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSchoolSlug } from "@/lib/contentEngine/taxonomy";
import { PAGE_PHOTO_CURATION_TABLE } from "@/lib/pagePhotos/pageKeys";

export const CURATION_ACTIONS = ["pin", "unpin", "hide", "unhide", "hero", "unhero", "up", "down"] as const;
export type CurationAction = (typeof CURATION_ACTIONS)[number];

export function isCurationAction(value: unknown): value is CurationAction {
  return typeof value === "string" && (CURATION_ACTIONS as readonly string[]).includes(value);
}

interface Row { id: string; image_url: string; mode: "pin" | "hide"; position: number; is_hero: boolean }

async function pageRows(client: SupabaseClient, pageKey: string): Promise<Row[]> {
  const { data, error } = await client.from(PAGE_PHOTO_CURATION_TABLE)
    .select("id,image_url,mode,position,is_hero").eq("page_key", pageKey);
  if (error) throw new Error(`could not read page curation: ${error.message}`);
  return (data ?? []) as Row[];
}

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`could not ${what}: ${error.message}`);
}

async function upsert(client: SupabaseClient, pageKey: string, imageUrl: string, fields: Partial<Row>) {
  const { error } = await client.from(PAGE_PHOTO_CURATION_TABLE).upsert(
    { page_key: pageKey, image_url: imageUrl, ...fields, updated_at: new Date().toISOString() },
    { onConflict: "page_key,image_url" },
  );
  check(error, "save page curation");
}

async function remove(client: SupabaseClient, pageKey: string, imageUrl: string) {
  const { error } = await client.from(PAGE_PHOTO_CURATION_TABLE).delete()
    .eq("page_key", pageKey).eq("image_url", imageUrl);
  check(error, "clear page curation");
}

function nextPinPosition(rows: Row[]): number {
  return Math.max(0, ...rows.filter((r) => r.mode === "pin").map((r) => r.position)) + 1;
}

async function setHero(client: SupabaseClient, pageKey: string, imageUrl: string, rows: Row[]) {
  // Clear the old hero first: the one-hero-per-page index rejects two at once.
  const { error } = await client.from(PAGE_PHOTO_CURATION_TABLE).update({ is_hero: false })
    .eq("page_key", pageKey).eq("is_hero", true);
  check(error, "clear the previous hero");
  const existing = rows.find((r) => r.image_url === imageUrl && r.mode === "pin");
  await upsert(client, pageKey, imageUrl, { mode: "pin", is_hero: true, position: existing?.position ?? nextPinPosition(rows) });
}

async function movePin(client: SupabaseClient, rows: Row[], imageUrl: string, direction: -1 | 1) {
  const pins = rows.filter((r) => r.mode === "pin" && !r.is_hero).sort((a, b) => a.position - b.position);
  const index = pins.findIndex((r) => r.image_url === imageUrl);
  const other = pins[index + direction];
  if (index < 0 || !other) return;
  // Renumber so equal positions can still be swapped.
  const reordered = pins.map((r, i) => ({ ...r, position: i + 1 }));
  [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
  await Promise.all(reordered.map((r, i) => client.from(PAGE_PHOTO_CURATION_TABLE)
    .update({ position: i + 1, updated_at: new Date().toISOString() }).eq("id", r.id)
    .then(({ error }) => check(error, "reorder pinned photos"))));
}

export async function applyCuration(
  client: SupabaseClient, pageKey: string, imageUrl: string, action: CurationAction,
): Promise<void> {
  const rows = await pageRows(client, pageKey);
  const current = rows.find((r) => r.image_url === imageUrl);
  switch (action) {
    case "pin":
      if (current?.mode !== "pin") await upsert(client, pageKey, imageUrl, { mode: "pin", is_hero: false, position: nextPinPosition(rows) });
      return;
    case "hide":
      await upsert(client, pageKey, imageUrl, { mode: "hide", is_hero: false, position: 0 });
      return;
    case "unpin":
    case "unhide":
      if (current) await remove(client, pageKey, imageUrl);
      return;
    case "hero":
      await setHero(client, pageKey, imageUrl, rows);
      return;
    case "unhero":
      if (current?.is_hero) await upsert(client, pageKey, imageUrl, { mode: "pin", is_hero: false, position: current.position });
      return;
    case "up":
    case "down":
      await movePin(client, rows, imageUrl, action === "up" ? -1 : 1);
  }
}

/** Sets (or clears) the explicit school tag on one portfolio photo. */
export async function setPortfolioSchool(client: SupabaseClient, portfolioId: number, school: string | null) {
  if (school !== null && !isSchoolSlug(school)) throw new Error("school must be a school page slug or null");
  const { data, error } = await client.from("portfolio_images")
    .update({ school }).eq("id", portfolioId).select("id").maybeSingle();
  check(error, "save the photo's school");
  if (!data) throw new Error("photo not found");
}
