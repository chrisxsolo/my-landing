// HOW TO PREPARE  →  soloxsnaps.com/grad-guide/how-to-prepare
// Server component — exports metadata + Article/Breadcrumb JSON-LD.
// Interactive content lives in HowToPrepareClient.tsx.

import type { Metadata } from "next";
import HowToPrepareClient from "./HowToPrepareClient";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";

const SITE_URL = "https://soloxsnaps.com";
const PATH = "/grad-guide/how-to-prepare";
const TITLE = "How to Prepare for Graduation Photos — Bay Area Guide";
const DESCRIPTION =
  "How to prepare for your graduation photo session — steaming your gown, hair and makeup, props, timing, and everything to do before shoot day.";

export const metadata: Metadata = {
  title: `${TITLE} | soloxsnaps`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "article",
    siteName: "soloxsnaps",
  },
};

export default function HowToPreparePage() {
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
      <HowToPrepareClient />
    </>
  );
}
