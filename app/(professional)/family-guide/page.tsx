// FAMILY GUIDE HUB  →  soloxsnaps.com/family-guide
// Server component — exports metadata + Article/Breadcrumb JSON-LD. The body
// (headings, prose, internal links) is server-rendered in FamilyGuideContent.
// Family portfolio photos are fetched here on the server (ISR) and passed down.

import type { Metadata } from "next";
import FamilyGuideContent from "./FamilyGuideContent";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { getPortfolioData } from "@/lib/professionalData";
import { getFamilyLocationSummaries } from "@/lib/familyGuide/locations";

// Cached/ISR: refreshed hourly, or immediately on admin content saves
// (POST /api/admin/revalidate revalidates the root layout).
export const revalidate = 3600;

const SITE_URL = "https://www.soloxsnaps.com";
const PATH = "/family-guide";
// Bare title — the root layout's metadata template appends " | SoloXSnaps".
const TITLE = "San Francisco Family Photography Guide";
const OG_TITLE = "San Francisco Family Photography Guide | SoloXSnaps";
const DESCRIPTION =
  "Plan your San Francisco family photo session with location ideas, outfit guidance, preparation tips, lighting advice, and family photography resources from SoloXSnaps.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  keywords: [
    "San Francisco family photographer",
    "Bay Area family photographer",
    "San Francisco family photography",
    "family photos San Francisco",
    "family photoshoot San Francisco",
    "fall family photos San Francisco",
    "outdoor family photographer San Francisco",
    "soloxsnaps",
  ],
  openGraph: {
    title: OG_TITLE,
    description: DESCRIPTION,
    url: PATH,
    type: "website",
    siteName: "soloxsnaps",
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: DESCRIPTION,
  },
};

export default async function FamilyGuidePage() {
  const { images } = await getPortfolioData();
  const galleryImages = images
    .filter((img) => img.category_slug === "families" && img.image_url)
    .slice(0, 6)
    .map((img) => ({ image_url: img.image_url, alt: img.alt }));

  const locations = getFamilyLocationSummaries();

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "San Francisco Family Photography Guide",
    description: DESCRIPTION,
    mainEntityOfPage: `${SITE_URL}${PATH}`,
    image: `${SITE_URL}${PATH}/opengraph-image`,
    author: { "@type": "Person", name: "Chris Solorzano" },
    publisher: { "@type": "Organization", name: "SoloXSnaps Photography", url: SITE_URL },
    dateModified: new Date().toISOString().slice(0, 10),
  };
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Family Photography Guide", path: PATH },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }}
      />
      <FamilyGuideContent locations={locations} galleryImages={galleryImages} />
    </>
  );
}
