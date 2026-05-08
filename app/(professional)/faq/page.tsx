// FAQ PAGE  →  soloxsnaps.com/faq
// Server component — exports metadata. Client interactivity lives in FAQClient.tsx.

import type { Metadata } from "next";
import FAQClient from "./FAQClient";

export const metadata: Metadata = {
  title: "FAQ | soloxsnaps",
  description:
    "Common questions about graduation photography sessions — booking, outfits, delivery, locations, and more.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "FAQ | soloxsnaps",
    description: "Common questions about graduation photography sessions — booking, outfits, delivery, locations, and more.",
    type: "website",
    siteName: "soloxsnaps",
  },
};

export default function FAQPage() {
  return <FAQClient />;
}
