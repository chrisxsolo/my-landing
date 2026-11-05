// COUPLES GUIDE HUB  →  soloxsnaps.com/couples-guide
// "The Ultimate Bay Area Couples Photography Guide". Server component — exports
// metadata + Article/Breadcrumb JSON-LD; the body is server-rendered in
// CouplesGuideContent. Photos come from the couples portfolio (one per session
// for variety) and the published couples location guides.

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/siteMetadata";
import CouplesGuideContent from "./CouplesGuideContent";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { getCouplesPortfolio, type CouplesPortfolioPhoto } from "@/lib/couplesPortfolio";
import { getFeaturedCouplesLocations } from "@/lib/couplesGuide/featuredLocations";

// Cached/ISR: refreshed hourly, or immediately on admin content saves
// (POST /api/admin/revalidate revalidates the root layout).
export const revalidate = 3600;

const SITE_URL = "https://www.soloxsnaps.com";
const PATH = "/couples-guide";
const HEADLINE = "The Ultimate Bay Area Couples Photography Guide";
// Bare title — the root layout's metadata template appends " | SoloXSnaps".
const TITLE = "Bay Area Couples Photography Guide";
const OG_TITLE = `${HEADLINE} | SoloXSnaps`;
const DESCRIPTION =
  "Plan your Bay Area couples photos: the best couples photoshoot locations, what to wear, golden hour timing, how posing works, pricing, and answers to common questions.";

// This route has its own opengraph-image.tsx, which Next injects as the share image.
export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  socialTitle: OG_TITLE,
  description: DESCRIPTION,
  path: PATH,
  type: "article",
  image: null,
  keywords: [
    "Bay Area couples photography guide",
    "best couples photoshoot locations Bay Area",
    "what to wear for couples photos",
    "San Francisco couples photography",
    "couples photoshoot tips",
    "golden hour couples photography",
  ],
});

// First photo of each session, so the photo band shows three different shoots.
function onePerSession(photos: CouplesPortfolioPhoto[], hero: CouplesPortfolioPhoto | null) {
  const seen = new Set<string>();
  const picks = [hero, ...photos].filter((photo): photo is CouplesPortfolioPhoto => {
    if (!photo) return false;
    const key = photo.session_label ?? `photo-${photo.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return picks.slice(0, 3).map((photo) => ({ image_url: photo.image_url, alt: photo.alt }));
}

export default async function CouplesGuidePage() {
  const [{ hero, photos }, locations] = await Promise.all([
    getCouplesPortfolio(),
    getFeaturedCouplesLocations(),
  ]);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: HEADLINE,
    description: DESCRIPTION,
    mainEntityOfPage: `${SITE_URL}${PATH}`,
    image: hero ? [hero.image_url] : `${SITE_URL}${PATH}/opengraph-image`,
    author: { "@type": "Person", name: "Chris Solorzano" },
    publisher: { "@type": "Organization", name: "SoloXSnaps Photography", url: SITE_URL },
    about: { "@type": "Service", name: "Couples photography", areaServed: "San Francisco Bay Area" },
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
      <CouplesGuideContent locations={locations} photos={onePerSession(photos, hero)} />
    </>
  );
}
