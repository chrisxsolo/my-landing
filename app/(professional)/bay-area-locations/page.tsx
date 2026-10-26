// BAY AREA LOCATIONS  →  soloxsnaps.com/bay-area-locations
// Server component — exports metadata + CollectionPage/Breadcrumb JSON-LD.
// Interactive content lives in LocationsExplorer.tsx, styled to match the
// professional graduation guide (sage/green, frosted glass).

import type { Metadata } from "next";
import { getPublicLocations, type PublicLocationCard } from "@/lib/locationLibrary/publicData";
import { environmentLabel, regionLabel, sessionKindLabel } from "@/lib/locationLibrary/taxonomy";
import { buildBreadcrumbJsonLd, SITE_URL } from "@/lib/breadcrumbs";
import LocationsExplorer from "./LocationsExplorer";

// ISR: no request-time data on this page, so serve the cached render and
// refresh hourly. Library edits and Content Engine syncs bust it sooner.
export const revalidate = 3600;

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

function getLocationsJsonLd(locations: PublicLocationCard[]) {
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
        const keywords = [
          ...location.environments.map((e) => environmentLabel(e)),
          ...location.kinds.map(sessionKindLabel),
        ];
        const properties = [
          { name: "Region", value: regionLabel(location.region) },
          { name: "Best for", value: location.best_for },
          { name: "Best light", value: location.best_time },
          { name: "Photographer tip", value: location.tip },
        ].filter((p) => p.value);
        const place: Record<string, unknown> = {
          "@type": "Place",
          name: location.title,
          url: `${SITE_URL}${PATH}#${location.slug}`,
          description: location.description,
          address: {
            "@type": "PostalAddress",
            addressLocality: location.city,
            addressRegion: "CA",
            addressCountry: "US",
          },
          additionalProperty: properties.map((p) => ({ "@type": "PropertyValue", ...p })),
        };
        if (keywords.length) place.keywords = keywords.join(", ");

        if (location.neighborhood) {
          place.containedInPlace = {
            "@type": "Place",
            name: location.neighborhood,
          };
        }

        if (location.image_url) {
          place.image = { "@type": "ImageObject", url: location.image_url, caption: location.image_alt };
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
  const locations = await getPublicLocations();
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
