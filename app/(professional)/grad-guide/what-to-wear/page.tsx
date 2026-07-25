// WHAT TO WEAR  →  soloxsnaps.com/grad-guide/what-to-wear
// Server component — exports metadata + Article/Breadcrumb JSON-LD.
// Content is server-rendered in WhatToWearContent.tsx.

import type { Metadata } from "next";
import WhatToWearContent from "./WhatToWearContent";
import { getGradOutfitTips } from "@/lib/gradGuideData";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";

// ISR: content now server-fetches (cached); refresh hourly, sooner on admin
// revalidate. Previously this page was frozen static + client-fetched.
export const revalidate = 3600;

const SITE_URL = "https://www.soloxsnaps.com";
const PATH = "/grad-guide/what-to-wear";
const TITLE = "What to Wear for Graduation Photos — Bay Area Guide";
const DESCRIPTION =
  "What to wear for your graduation photos: the colors, fits, and styling that photograph beautifully under your cap and gown at Bay Area campuses.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "article",
    siteName: "soloxsnaps",
  },
};

export default async function WhatToWearPage() {
  const outfits = await getGradOutfitTips();
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESCRIPTION,
    mainEntityOfPage: `${SITE_URL}${PATH}`,
    author: { "@type": "Person", name: "Chris Solorzano" },
    publisher: { "@type": "Organization", name: "soloxsnaps" },
  };
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Graduation Photo Guide", path: "/grad-guide" },
    { name: "What to Wear", path: PATH },
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
      <WhatToWearContent outfits={outfits} />
    </>
  );
}
