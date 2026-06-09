// FAMILY FAQ PAGE  →  soloxsnaps.com/family-guide/faq
// Server component — metadata + FAQPage/Breadcrumb JSON-LD. The JSON-LD is built
// from the same FAQS array the page renders, so structured data matches the
// visible questions and answers exactly.

import type { Metadata } from "next";
import FamilyFaqClient from "./FamilyFaqClient";
import { FAQS } from "./familyFaqData";
import { buildFaqJsonLd } from "../../faq/faqSchema";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";

const PATH = "/family-guide/faq";
const TITLE = "Family Photography FAQ";
const DESCRIPTION =
  "Answers to common San Francisco and Bay Area family photography questions — booking, session length, what to wear, kids, grandparents, delivery, and fall timing.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { title: `${TITLE} | SoloXSnaps`, description: DESCRIPTION, url: PATH, type: "website", siteName: "soloxsnaps" },
  twitter: { card: "summary_large_image", title: `${TITLE} | SoloXSnaps`, description: DESCRIPTION },
};

export default function FamilyFaqPage() {
  const jsonLd = buildFaqJsonLd(FAQS);
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Family Guide", path: "/family-guide" },
    { name: "Family FAQ", path: PATH },
  ]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <FamilyFaqClient />
    </>
  );
}
