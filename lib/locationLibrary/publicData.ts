// Server-only data for the public /bay-area-locations page: published library
// locations with their resolved hero photo, environments, the session types
// actually photographed there, and related links. Nothing private leaves this
// module — no client names, session ids, notes or unapproved photos.
import { cachePublicContent } from "@/lib/publicContentCache";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { DRAFT_BAY_AREA_LOCATIONS, slugifyLocation } from "@/lib/bayAreaLocations";
import { loadLibraryLocations, type LibraryLocation } from "@/lib/locationLibrary/load";
import { loadRelatedContent, type RelatedLink } from "@/lib/locationLibrary/related";
import { LOCATIONS_TABLE, sortEnvironments } from "@/lib/locationLibrary/taxonomy";

export interface PublicLocationCard {
  id: number;
  title: string;
  slug: string;
  region: string;
  city: string;
  neighborhood: string | null;
  description: string;
  best_for: string;
  best_time: string;
  tip: string;
  tags: string[];
  environments: string[];
  kinds: string[];
  image_url: string | null;
  image_alt: string;
  photoCount: number;
  sessionCount: number;
  order: number;
  createdAt: string;
  related: RelatedLink[];
}

function altFor(title: string, city: string, photoAlt: string | null): string {
  return photoAlt?.trim() || `${title} photo location in ${city}`;
}

export function toPublicCard(loc: LibraryLocation, related: RelatedLink[]): PublicLocationCard {
  const r = loc.row;
  const title = r.title.trim();
  const city = r.city.trim();
  return {
    id: r.id, title, slug: r.slug || slugifyLocation(title), region: r.region, city,
    neighborhood: r.neighborhood?.trim() || null,
    description: r.description, best_for: r.best_for, best_time: r.best_time, tip: r.tip,
    tags: r.tags ?? [], environments: sortEnvironments(r.environments ?? []), kinds: loc.kinds,
    image_url: loc.hero?.url ?? null, image_alt: altFor(title, city, loc.hero?.alt ?? null),
    photoCount: loc.publicPhotoCount, sessionCount: loc.sessionCount,
    order: r.order, createdAt: r.created_at, related,
  };
}

function fromDraft(): PublicLocationCard[] {
  return DRAFT_BAY_AREA_LOCATIONS.map((d) => ({
    ...d, environments: [], kinds: [], image_alt: altFor(d.title, d.city, null),
    photoCount: 0, sessionCount: 0, createdAt: "", related: [],
  }));
}

/** The pre-library read, used if the library tables are unavailable (e.g. mid-deploy). */
async function loadPlainRows(): Promise<PublicLocationCard[]> {
  const { data, error } = await createSupabaseServerClient().from(LOCATIONS_TABLE)
    .select("*").eq("active", true).order("order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id, title: String(r.title ?? "").trim(), slug: r.slug, region: r.region, city: String(r.city ?? "").trim(),
    neighborhood: r.neighborhood ?? null, description: r.description ?? "", best_for: r.best_for ?? "",
    best_time: r.best_time ?? "", tip: r.tip ?? "", tags: r.tags ?? [], environments: r.environments ?? [],
    kinds: [], image_url: r.image_url ?? null, image_alt: altFor(String(r.title ?? ""), String(r.city ?? ""), null),
    photoCount: 0, sessionCount: 0, order: r.order ?? 0, createdAt: r.created_at ?? "", related: [],
  }));
}

async function loadPublicLocations(): Promise<PublicLocationCard[]> {
  try {
    const client = createSupabaseServerClient();
    const { locations } = await loadLibraryLocations(client, { publishedOnly: true });
    const related = await loadRelatedContent(client, locations);
    const cards = locations.map((l) => toPublicCard(l, related[l.row.id] ?? []));
    return cards.length ? cards : fromDraft();
  } catch (err) {
    console.error("[bay-area-locations] library read failed; falling back to plain rows", err);
    try {
      const cards = await loadPlainRows();
      return cards.length ? cards : fromDraft();
    } catch (plainErr) {
      console.error("[bay-area-locations] plain read failed", plainErr);
      return fromDraft();
    }
  }
}

export const getPublicLocations = cachePublicContent(loadPublicLocations, ["bay-area-library-v1"]);
