// GRAD GUIDE HUB  →  soloxsnaps.com/grad-guide
// Server component — exports metadata + Article/Breadcrumb JSON-LD.
// All body content (headings, prose, internal links, and the photo gallery) is
// server-rendered in GradGuideContent.tsx / GradGallery.tsx.
// Lives on the professional site and renders inside ProfessionalLayout.

import type { Metadata } from "next";
import GradGuideContent from "./GradGuideContent";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";

// ISR: the gallery now server-fetches (cached); refresh hourly, sooner on
// admin revalidate. Previously this page was frozen static + client-fetched.
export const revalidate = 3600;

const SITE_URL = "https://www.soloxsnaps.com";
const PATH = "/grad-guide";
const TITLE = "Bay Area Graduation Photo Guide — Posing, Outfits & Prep";
const DESCRIPTION =
  "Your complete guide to graduation photos in the Bay Area — posing tips, what to wear, how to prepare, and the best campus spots at SJSU, UC Berkeley, SF State, USF, and CSU East Bay.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    title: "Bay Area Graduation Photo Guide | soloxsnaps",
    description: DESCRIPTION,
    url: PATH,
    type: "website",
    siteName: "soloxsnaps",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bay Area Graduation Photo Guide | soloxsnaps",
    description: DESCRIPTION,
  },
};

export default function GradGuidePage() {
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Bay Area Graduation Photo Guide",
    description: DESCRIPTION,
    mainEntityOfPage: `${SITE_URL}${PATH}`,
    image: `${SITE_URL}${PATH}/opengraph-image`,
    author: { "@type": "Person", name: "Chris Solorzano" },
    publisher: {
      "@type": "Organization",
      name: "SoloXSnaps Photography",
      url: SITE_URL,
    },
    dateModified: new Date().toISOString().slice(0, 10),
  };
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Graduation Photo Guide", path: PATH },
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
      <GradGuideContent />
    </>
  );
}
