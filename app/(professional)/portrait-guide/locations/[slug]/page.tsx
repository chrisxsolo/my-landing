// INDIVIDUAL PORTRAIT LOCATION PAGE  →  /portrait-guide/locations/[slug]
// Statically generated from the location registry (one URL per config). Unknown
// slugs 404 (dynamicParams = false). Photos are fetched on the server (ISR) and
// passed into the shared template, so each page is fully indexable with its own
// metadata, canonical, and JSON-LD. Unpublished locations carry a noindex tag and
// are omitted from the sitemap until they have a credible set of photos.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PortraitLocationTemplate from "./PortraitLocationTemplate";
import { getPortraitLocation, getAllPortraitLocations } from "@/lib/portraitGuide/locations";
import { getPortraitLocationPhotos } from "@/lib/portraitGuide/photos";

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPortraitLocations().map((loc) => ({ slug: loc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = getPortraitLocation(slug);
  if (!data) return {};

  return {
    title: data.metaTitle,
    description: data.metaDescription,
    alternates: { canonical: data.canonicalPath },
    keywords: data.keywords,
    // Until a location has a credible set of photos, keep it out of search:
    // noindex (but follow internal links). Flip `published: true` to make it
    // indexable; it also enters the sitemap at that point.
    ...(data.published ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      title: data.metaTitle,
      description: data.metaDescription,
      url: data.canonicalPath,
      type: "article",
      siteName: "soloxsnaps",
    },
    twitter: { card: "summary_large_image", title: data.metaTitle, description: data.metaDescription },
  };
}

export default async function PortraitLocationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = getPortraitLocation(slug);
  if (!data) notFound();

  const photos = await getPortraitLocationPhotos(data.slug);
  return <PortraitLocationTemplate data={data} photos={photos} />;
}
