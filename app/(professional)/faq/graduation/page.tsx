// GRADUATION FAQ PAGE  →  soloxsnaps.com/faq/graduation
// Server component — exports metadata. Client interactivity lives in GraduationFAQClient.tsx.

import type { Metadata } from "next";
import GraduationFAQClient from "./GraduationFAQClient";
import { FAQS } from "./graduationFaqData";
import { buildFaqJsonLd } from "../faqSchema";

const FAQ_DESCRIPTION =
  "Everything about graduation photography sessions — booking, caps & gowns, campus locations, props, delivery, and more.";

export const metadata: Metadata = {
  title: "Graduation FAQ | soloxsnaps",
  description: FAQ_DESCRIPTION,
  alternates: { canonical: "/faq/graduation" },
  openGraph: {
    title: "Graduation FAQ | soloxsnaps",
    description: FAQ_DESCRIPTION,
    type: "website",
    siteName: "soloxsnaps",
  },
};

export default function GraduationFAQPage() {
  const jsonLd = buildFaqJsonLd(FAQS);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <GraduationFAQClient />
    </>
  );
}
