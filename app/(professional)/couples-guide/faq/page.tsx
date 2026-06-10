// COUPLES FAQ PAGE  →  soloxsnaps.com/couples-guide/faq
// Server component — metadata + FAQPage/Breadcrumb JSON-LD. The JSON-LD is built
// from the same FAQS array the page renders, so structured data matches the
// visible questions and answers exactly.

import type { Metadata } from "next";
import CouplesFaqClient from "./CouplesFaqClient";
import { FAQS } from "./couplesFaqData";
import { buildFaqJsonLd } from "../../faq/faqSchema";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";

const PATH = "/couples-guide/faq";
const TITLE = "Couples Photography FAQ";
const DESCRIPTION =
  "Answers to common San Francisco and Bay Area couples photography questions — booking, posing, what to wear, locations, engagements, proposals, delivery, and fog.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { title: `${TITLE} | SoloXSnaps`, description: DESCRIPTION, url: PATH, type: "website", siteName: "soloxsnaps" },
  twitter: { card: "summary_large_image", title: `${TITLE} | SoloXSnaps`, description: DESCRIPTION },
};

export default function CouplesFaqPage() {
  const jsonLd = buildFaqJsonLd(FAQS);
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Couples Guide", path: "/couples-guide" },
    { name: "Couples FAQ", path: PATH },
  ]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <CouplesFaqClient />
    </>
  );
}
