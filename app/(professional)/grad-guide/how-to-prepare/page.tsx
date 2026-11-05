// HOW TO PREPARE  →  soloxsnaps.com/grad-guide/how-to-prepare
// Server component — exports metadata + Article/Breadcrumb JSON-LD.
// Content is server-rendered in HowToPrepareContent.tsx.

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/siteMetadata";
import HowToPrepareContent from "./HowToPrepareContent";
import { getGradPrepTips } from "@/lib/gradGuideData";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { businessRef, personRef } from "@/lib/seo/schema";

// ISR: content now server-fetches (cached); refresh hourly, sooner on admin
// revalidate. Previously this page was frozen static + client-fetched.
export const revalidate = 3600;

const SITE_URL = "https://www.soloxsnaps.com";
const PATH = "/grad-guide/how-to-prepare";
const TITLE = "How to Prepare for Graduation Photos — Bay Area Guide";
const DESCRIPTION =
  "How to prepare for your graduation photo session — steaming your gown, hair and makeup, props, timing, and everything to do before shoot day.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  type: "article",
});

export default async function HowToPreparePage() {
  const tips = await getGradPrepTips();
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESCRIPTION,
    mainEntityOfPage: `${SITE_URL}${PATH}`,
    author: personRef(),
    publisher: businessRef(),
  };
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Graduation Photo Guide", path: "/grad-guide" },
    { name: "How to Prepare", path: PATH },
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
      <HowToPrepareContent tips={tips} />
    </>
  );
}
