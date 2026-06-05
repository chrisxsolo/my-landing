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
  title: "Chris Solorzano",
  description:
    "Photographer, developer, and curious person based in San Francisco, CA.",
  // Open Graph — controls how the link looks when shared on Instagram/iMessage
  openGraph: {
    title: "Chris Solorzano",
    description: "Photographer · Developer · San Francisco",
    type: "website",
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
