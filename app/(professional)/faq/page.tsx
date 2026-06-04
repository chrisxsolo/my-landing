// FAQ PAGE  →  soloxsnaps.com/faq
// Server component — exports metadata. Client interactivity lives in FAQClient.tsx.

import type { Metadata } from "next";
import FAQClient from "./FAQClient";

const FAQ_DESCRIPTION =
  "Common questions about photography sessions — booking, outfits, delivery, locations, and more, for portraits, couples, family, maternity, and creative shoots.";

export const metadata: Metadata = {
  title: "FAQ | soloxsnaps",
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
  return <FAQClient />;
}
