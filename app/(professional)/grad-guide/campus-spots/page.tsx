// CAMPUS SPOTS  →  soloxsnaps.com/grad-guide/campus-spots
// Server component — exports metadata + Article/Breadcrumb JSON-LD.
// Interactive content lives in CampusSpotsClient.tsx.

import type { Metadata } from "next";
import CampusSpotsClient from "./CampusSpotsClient";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";

const SITE_URL = "https://soloxsnaps.com";
const PATH = "/grad-guide/campus-spots";
const TITLE = "Best Campus Spots for Graduation Photos — Bay Area Guide";
const DESCRIPTION =
  "Where to shoot your graduation photos at SJSU, UC Berkeley, SF State, Cal State East Bay, and USF — the best spots on each Bay Area campus and when to show up.";

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

export default function CampusSpotsPage() {
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
    { name: "Campus Spots", path: PATH },
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
      <CampusSpotsClient />
    </>
  );
}
