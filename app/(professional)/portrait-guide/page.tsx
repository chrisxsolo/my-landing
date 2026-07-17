// PORTRAIT GUIDE HUB  →  soloxsnaps.com/portrait-guide
// Server component — exports metadata + Article/Breadcrumb JSON-LD. The body
// (headings, prose, internal links) is server-rendered in PortraitGuideContent.
// Portrait portfolio photos are fetched here on the server (ISR) and passed down.

import type { Metadata } from "next";
import PortraitGuideContent from "./PortraitGuideContent";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { getPortfolioData } from "@/lib/professionalData";
import { getPortraitLocationSummaries } from "@/lib/portraitGuide/locations";

// Cached/ISR: refreshed hourly, or immediately on admin content saves
// (POST /api/admin/revalidate revalidates the root layout).
export const revalidate = 3600;

const SITE_URL = "https://www.soloxsnaps.com";
const PATH = "/portrait-guide";
// Bare title — the root layout's metadata template appends " | SoloXSnaps".
const TITLE = "San Francisco Lifestyle Portrait Guide";
const OG_TITLE = "San Francisco Lifestyle Portrait Guide | SoloXSnaps";
const DESCRIPTION =
  "Plan your San Francisco lifestyle or individual portrait session with location ideas, outfit guidance, preparation tips, lighting advice, and portrait photography resources from SoloXSnaps.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  keywords: [
    "San Francisco portrait photographer",
    "Bay Area portrait photographer",
    "lifestyle portrait photography San Francisco",
    "individual portrait session San Francisco",
    "personal branding photos San Francisco",
    "outdoor portrait photographer San Francisco",
    "portrait photoshoot San Francisco",
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

export default async function PortraitGuidePage() {
  const { images } = await getPortfolioData();
  const galleryImages = images
    .filter((img) => img.category_slug === "portraits" && img.image_url)
    .slice(0, 6)
    .map((img) => ({ image_url: img.image_url, alt: img.alt }));

  const locations = getPortraitLocationSummaries();

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "San Francisco Lifestyle Portrait Guide",
    description: DESCRIPTION,
    mainEntityOfPage: `${SITE_URL}${PATH}`,
    image: `${SITE_URL}${PATH}/opengraph-image`,
    author: { "@type": "Person", name: "Chris Solorzano" },
    publisher: { "@type": "Organization", name: "SoloXSnaps Photography", url: SITE_URL },
    dateModified: new Date().toISOString().slice(0, 10),
  };
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Lifestyle Portrait Guide", path: PATH },
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
      <PortraitGuideContent locations={locations} galleryImages={galleryImages} />
    </>
  );
}
