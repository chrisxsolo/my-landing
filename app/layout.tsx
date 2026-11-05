import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE, SITE_NAME } from "@/lib/seo/siteMetadata";
import { DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { preconnect, prefetchDNS } from "react-dom";
import "./globals.css";

// Every photo on the site comes from Supabase's image endpoint. Opening that
// connection while the HTML is still parsing takes DNS + TCP + TLS off the
// hero image's critical path (Lighthouse showed ~0.6-0.9 s of LCP "load
// delay" that was mostly connection setup). Images are no-cors requests, so
// no crossOrigin attribute.
const SUPABASE_ORIGIN = "https://dmtslzwglpezympptqls.supabase.co";

// DM Sans — clean geometric sans, modern and readable
// This replaces the default Geist font from the boilerplate
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.soloxsnaps.com"),
  title: {
    default: "SoloXSnaps | Bay Area Graduation & Couples Photographer",
    template: "%s | SoloXSnaps",
  },
  description:
    "Bay Area graduation and couples photographer Chris Solorzano, with guided family and portrait sessions also available.",
  applicationName: "SoloXSnaps",
  // Share defaults for any route that sets no openGraph of its own. Pages that
  // do set one replace this whole block (Next merges shallowly), so they build
  // theirs with buildPageMetadata, which fills in the same image and card.
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [DEFAULT_SOCIAL_IMAGE.url] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  preconnect(SUPABASE_ORIGIN);
  prefetchDNS(SUPABASE_ORIGIN);
  return (
    <html lang="en" className="scroll-smooth" data-scroll-behavior="smooth">
      <body className={`${dmSans.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
