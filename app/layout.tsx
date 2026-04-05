import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

// DM Sans — clean geometric sans, modern and readable
// This replaces the default Geist font from the boilerplate
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
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
    <html lang="en" className="scroll-smooth">
      <body className={`${dmSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
