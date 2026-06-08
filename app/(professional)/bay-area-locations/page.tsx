// BAY AREA LOCATIONS  →  soloxsnaps.com/bay-area-locations
// Server component — exports metadata + CollectionPage/Breadcrumb JSON-LD.
// Interactive content lives in LocationsExplorer.tsx, styled to match the
// professional graduation guide (sage/green, frosted glass).

import type { Metadata } from "next";
import {
  DRAFT_BAY_AREA_LOCATIONS,
  slugifyLocation,
  type BayAreaLocationEntry,
} from "@/lib/bayAreaLocations";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import LocationsExplorer from "./LocationsExplorer";

export const dynamic = "force-dynamic";

const PATH = "/bay-area-locations";
const PAGE_TITLE = "Bay Area Photo Location Guide";
const PAGE_DESCRIPTION =
  "Explore Chris Solorzano's favorite Bay Area photo locations for portraits, couples, creative shoots, beaches, South Bay, San Francisco, East Bay, and Peninsula sessions.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: PATH,
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
    siteName: "soloxsnaps",
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
      name: "soloxsnaps",
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
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Bay Area Locations", path: PATH },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(locationsJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c"),
        }}
      />
      <LocationsExplorer locations={locations} />
    </>
  );
}
