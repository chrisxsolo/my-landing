// COUPLES FAQ PAGE  →  soloxsnaps.com/couples-guide/faq
// Server component — metadata + FAQPage/Breadcrumb JSON-LD. The JSON-LD is built
// from the same FAQS array the page renders, so structured data matches the
// visible questions and answers exactly.

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/siteMetadata";
import CouplesFaqClient from "./CouplesFaqClient";
import { FAQS } from "./couplesFaqData";
import { buildFaqJsonLd } from "../../faq/faqSchema";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";

const PATH = "/couples-guide/faq";
const TITLE = "Couples Photography FAQ";
const DESCRIPTION =
  "Answers to common San Francisco and Bay Area couples photography questions — booking, posing, what to wear, locations, engagements, proposals, delivery, and fog.";

export const metadata: Metadata = buildPageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

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
