import Nav from "@/app/components/Nav";
import { C } from "@/lib/colors";
import { GUIDE_STYLES } from "@/lib/guidestyles";
import {
  DRAFT_BAY_AREA_LOCATIONS,
  slugifyLocation,
  type BayAreaLocationEntry,
} from "@/lib/bayAreaLocations";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import LocationsExplorer from "./LocationsExplorer";

export const dynamic = "force-dynamic";

function normalizeLocation(raw: Partial<BayAreaLocationEntry>, index: number): BayAreaLocationEntry {
  return {
    id: raw.id ?? index + 1,
    title: raw.title ?? "Untitled location",
    slug: raw.slug || slugifyLocation(raw.title ?? `location-${index + 1}`),
    region: raw.region ?? "south-bay",
    city: raw.city ?? "Bay Area",
    neighborhood: raw.neighborhood ?? null,
    description: raw.description ?? "",
    best_for: raw.best_for ?? "",
    best_time: raw.best_time ?? "",
    tip: raw.tip ?? "",
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    image_url: raw.image_url ?? null,
    order: raw.order ?? index + 1,
    active: raw.active ?? true,
  };
}

async function getLocations() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bay_area_locations")
    .select("*")
    .eq("active", true)
    .order("order", { ascending: true });

  if (error) {
    console.error("Failed to load bay_area_locations", error);
    return DRAFT_BAY_AREA_LOCATIONS;
  }

  if (!data || data.length === 0) {
    return DRAFT_BAY_AREA_LOCATIONS;
  }

  return data.map((location, index) => normalizeLocation(location, index));
}

export default async function BayAreaLocationsPage() {
  const locations = await getLocations();

  return (
    <div className="min-h-screen overflow-x-hidden font-sans" style={{ background: C.page }}>
      <style>{GUIDE_STYLES}</style>
      <Nav />
      <LocationsExplorer locations={locations} />
      <footer
        className="border-t px-6 py-8"
        style={{ borderColor: C.borderSubtle, background: C.surfaceStrong }}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <span className="text-lg font-black" style={C.text}>
            Chris.
          </span>
          <span className="text-sm text-slate-400">
            © 2026 · Bay Area portraits, couples, and creative sessions
          </span>
        </div>
      </footer>
    </div>
  );
}
