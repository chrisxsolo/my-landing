// INDIVIDUAL FAMILY LOCATION PAGE  →  /family-guide/locations/[slug]
// Statically generated from the published location registry (one URL per config).
// Unknown/unpublished slugs 404 (dynamicParams = false). Photos are fetched on
// the server (ISR) and passed into the shared template, so each page is fully
// indexable with its own metadata, canonical, and JSON-LD.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FamilyLocationTemplate from "./FamilyLocationTemplate";
import { getFamilyLocation, getAllFamilyLocations } from "@/lib/familyGuide/locations";
import { getFamilyLocationPhotos } from "@/lib/familyGuide/photos";

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  // All locations are statically generated and reachable. Unpublished ones carry
  // a noindex robots tag (set in generateMetadata) and are omitted from the sitemap.
  return getAllFamilyLocations().map((loc) => ({ slug: loc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = getFamilyLocation(slug);
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

export default async function FamilyLocationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = getFamilyLocation(slug);
  if (!data) notFound();

  const photos = await getFamilyLocationPhotos(data.slug);
  return <FamilyLocationTemplate data={data} photos={photos} />;
}
