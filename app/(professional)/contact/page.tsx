// ─────────────────────────────────────────────────────────────────────────────
// CONTACT PAGE  →  soloxsnaps.com/contact   (server wrapper for SEO metadata)
// ─────────────────────────────────────────────────────────────────────────────
// The interactive form lives in ContactClient.tsx ("use client"). This server
// component exists only to export metadata — client components can't.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import ContactClient from "./ContactClient";

const TITLE = "Book a Bay Area Photography Session | soloxsnaps";
const DESCRIPTION =
  "Inquire about graduation, couples, family, and event photography in the Bay Area. Send Chris Solorzano your date, location, and session type — replies within 24 hours.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "soloxsnaps" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function ContactPage() {
  return <ContactClient />;
}
