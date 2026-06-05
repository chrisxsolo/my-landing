// GRAD GUIDE HUB  →  soloxsnaps.com/grad-guide
// Server component — exports metadata + breadcrumb JSON-LD.
// Interactive content (Supabase gallery) lives in GradGuideClient.tsx.
// Lives on the professional site and renders inside ProfessionalLayout.

import type { Metadata } from "next";
import GradGuideClient from "./GradGuideClient";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";

const DESCRIPTION =
  "Your complete guide to graduation photos in the Bay Area — posing tips, what to wear, how to prepare, and the best campus spots at SJSU, UC Berkeley, SF State, USF, and CSU East Bay.";

export const metadata: Metadata = {
  title: "Bay Area Graduation Photo Guide — Posing, Outfits & Prep | soloxsnaps",
  description: DESCRIPTION,
  alternates: { canonical: "/grad-guide" },
  openGraph: {
    title: "Bay Area Graduation Photo Guide | soloxsnaps",
    description: DESCRIPTION,
    type: "website",
    siteName: "soloxsnaps",
  },
};

export default function GradGuidePage() {
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Graduation Photo Guide", path: "/grad-guide" },
  ]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }}
      />
      <GradGuideClient />
    </>
  );
}
