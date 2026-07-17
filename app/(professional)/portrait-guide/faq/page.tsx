// PORTRAIT FAQ PAGE  →  soloxsnaps.com/portrait-guide/faq
// Server component — metadata + FAQPage/Breadcrumb JSON-LD. The JSON-LD is built
// from the same FAQS array the page renders, so structured data matches the
// visible questions and answers exactly.

import type { Metadata } from "next";
import PortraitFaqClient from "./PortraitFaqClient";
import { FAQS } from "./portraitFaqData";
import { buildFaqJsonLd } from "../../faq/faqSchema";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";

const PATH = "/portrait-guide/faq";
const TITLE = "Portrait Photography FAQ";
const DESCRIPTION =
  "Answers to common San Francisco and Bay Area portrait photography questions — booking, posing nerves, what to wear, locations, branding photos, delivery, and fog.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { title: `${TITLE} | SoloXSnaps`, description: DESCRIPTION, url: PATH, type: "website", siteName: "soloxsnaps" },
  twitter: { card: "summary_large_image", title: `${TITLE} | SoloXSnaps`, description: DESCRIPTION },
};

export default function PortraitFaqPage() {
  const jsonLd = buildFaqJsonLd(FAQS);
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Portrait Guide", path: "/portrait-guide" },
    { name: "Portrait FAQ", path: PATH },
  ]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <PortraitFaqClient />
    </>
  );
}
