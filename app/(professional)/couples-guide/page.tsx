// COUPLES GUIDE HUB  →  soloxsnaps.com/couples-guide
// Server component — exports metadata + Article/Breadcrumb JSON-LD. The body
// (headings, prose, internal links) is server-rendered in CouplesGuideContent.
// Couples portfolio photos are fetched here on the server (ISR) and passed down.

import type { Metadata } from "next";
import CouplesGuideContent from "./CouplesGuideContent";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { getPortfolioData } from "@/lib/professionalData";
import { getCouplesLocationSummaries } from "@/lib/couplesGuide/locations";

// Cached/ISR: refreshed hourly, or immediately on admin content saves
// (POST /api/admin/revalidate revalidates the root layout).
export const revalidate = 3600;

const SITE_URL = "https://www.soloxsnaps.com";
const PATH = "/couples-guide";
// Bare title — the root layout's metadata template appends " | SoloXSnaps".
const TITLE = "San Francisco Couples Photography Guide";
const OG_TITLE = "San Francisco Couples Photography Guide | SoloXSnaps";
const DESCRIPTION =
  "Plan your San Francisco couples photo session with location ideas, outfit guidance, preparation tips, lighting advice, and couples photography resources from SoloXSnaps.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  keywords: [
    "San Francisco couples photographer",
    "Bay Area couples photographer",
    "San Francisco couples photography",
    "couples photoshoot San Francisco",
    "romantic photoshoot San Francisco",
    "outdoor couples photographer San Francisco",
    "engagement photos San Francisco",
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

export default async function CouplesGuidePage() {
  const { images } = await getPortfolioData();
  const galleryImages = images
    .filter((img) => img.category_slug === "couples" && img.image_url)
    .slice(0, 6)
    .map((img) => ({ image_url: img.image_url, alt: img.alt }));

  const locations = getCouplesLocationSummaries();

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "San Francisco Couples Photography Guide",
    description: DESCRIPTION,
    mainEntityOfPage: `${SITE_URL}${PATH}`,
    image: `${SITE_URL}${PATH}/opengraph-image`,
    author: { "@type": "Person", name: "Chris Solorzano" },
    publisher: { "@type": "Organization", name: "SoloXSnaps Photography", url: SITE_URL },
    dateModified: new Date().toISOString().slice(0, 10),
  };
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Couples Photography Guide", path: PATH },
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
      <CouplesGuideContent locations={locations} galleryImages={galleryImages} />
    </>
  );
}
