import type { Metadata } from "next";
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

const PAGE_TITLE = "Bay Area Photo Location Guide | Chris Solorzano";
const PAGE_DESCRIPTION =
  "Explore Chris Solorzano's favorite Bay Area photo locations for portraits, couples, creative shoots, beaches, South Bay, San Francisco, East Bay, and Peninsula sessions.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/bay-area-locations",
  },
  keywords: [
    "Bay Area photo locations",
    "Bay Area portrait photographer",
    "Bay Area photography spots",
    "San Francisco photo locations",
    "South Bay photo locations",
    "East Bay photo locations",
    "Peninsula photo locations",
    "Bay Area beaches photoshoot",
    "portrait session locations",
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    type: "website",
    siteName: "Chris Solorzano",
  },
  twitter: {
    card: "summary",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

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

function getLocationsJsonLd(locations: BayAreaLocationEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    isPartOf: {
      "@type": "WebSite",
      name: "Chris Solorzano",
    },
    creator: {
      "@type": "Person",
      name: "Chris Solorzano",
      jobTitle: "Bay Area Portrait Photographer",
      address: {
        "@type": "PostalAddress",
        addressLocality: "San Francisco",
        addressRegion: "CA",
        addressCountry: "US",
      },
    },
    about: [
      {
        "@type": "Thing",
        name: "Bay Area portrait photography locations",
      },
      {
        "@type": "Thing",
        name: "Photography session planning",
      },
    ],
    mainEntity: {
      "@type": "ItemList",
      name: "Bay Area photo locations",
      numberOfItems: locations.length,
      itemListElement: locations.map((location, index) => {
        const place: Record<string, unknown> = {
          "@type": "Place",
          name: location.title,
          description: `${location.description} Best for: ${location.best_for}. Best time: ${location.best_time}.`,
          keywords: location.tags.join(", "),
          address: {
            "@type": "PostalAddress",
            addressLocality: location.city,
            addressRegion: "CA",
            addressCountry: "US",
          },
          additionalProperty: [
            {
              "@type": "PropertyValue",
              name: "Region",
              value: location.region,
            },
            {
              "@type": "PropertyValue",
              name: "Best for",
              value: location.best_for,
            },
            {
              "@type": "PropertyValue",
              name: "Best time",
              value: location.best_time,
            },
            {
              "@type": "PropertyValue",
              name: "Photographer tip",
              value: location.tip,
            },
          ],
        };

        if (location.neighborhood) {
          place.containedInPlace = {
            "@type": "Place",
            name: location.neighborhood,
          };
        }

        if (location.image_url) {
          place.image = location.image_url;
        }

        return {
          "@type": "ListItem",
          position: index + 1,
          item: place,
        };
      }),
    },
  };
}

export default async function BayAreaLocationsPage() {
  const locations = await getLocations();
  const locationsJsonLd = getLocationsJsonLd(locations);

  return (
    <div className="min-h-screen overflow-x-hidden font-sans" style={{ background: C.page }}>
      <style>{GUIDE_STYLES}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(locationsJsonLd).replace(/</g, "\\u003c"),
        }}
      />
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
