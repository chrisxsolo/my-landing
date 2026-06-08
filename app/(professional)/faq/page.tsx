// FAQ PAGE  →  soloxsnaps.com/faq
// Server component — exports metadata. Client interactivity lives in FAQClient.tsx.

import type { Metadata } from "next";
import FAQClient from "./FAQClient";
import { FAQS } from "./faqData";
import { buildFaqJsonLd } from "./faqSchema";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";

const FAQ_DESCRIPTION =
  "Common questions about photography sessions — booking, outfits, delivery, locations, and more, for portraits, couples, family, maternity, and creative shoots.";

export const metadata: Metadata = {
  title: "FAQ",
  description: FAQ_DESCRIPTION,
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "FAQ | soloxsnaps",
    description: FAQ_DESCRIPTION,
    type: "website",
    siteName: "soloxsnaps",
  },
};

export default function FAQPage() {
  const jsonLd = buildFaqJsonLd(FAQS);
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "FAQ", path: "/faq" },
  ]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }}
      />
      <FAQClient />
    </>
  );
}
