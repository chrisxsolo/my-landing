import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

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
    default: "SoloXSnaps | Bay Area Graduation & Portrait Photographer",
    template: "%s | SoloXSnaps",
  },
  description:
    "Bay Area graduation, couples, family, and portrait photography by Chris Solorzano.",
  applicationName: "SoloXSnaps",
  // Open Graph — controls how the link looks when shared on Instagram/iMessage
  openGraph: {
    siteName: "SoloXSnaps",
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" data-scroll-behavior="smooth">
      <body className={`${dmSans.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
