// INDIVIDUAL COUPLES LOCATION PAGE  →  /couples-guide/locations/[slug]
// Statically generated from the location registry (one URL per config). Unknown
// slugs 404 (dynamicParams = false). Photos are fetched on the server (ISR) and
// passed into the shared template, so each page is fully indexable with its own
// metadata, canonical, and JSON-LD. Unpublished locations carry a noindex tag and
// are omitted from the sitemap until they have a credible set of photos.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CouplesLocationTemplate from "./CouplesLocationTemplate";
import { getCouplesLocation, getAllCouplesLocations } from "@/lib/couplesGuide/locations";
import { getCouplesLocationPhotos } from "@/lib/couplesGuide/photos";

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllCouplesLocations().map((loc) => ({ slug: loc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = getCouplesLocation(slug);
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

export default async function CouplesLocationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = getCouplesLocation(slug);
  if (!data) notFound();

  const photos = await getCouplesLocationPhotos(data.slug);
  return <CouplesLocationTemplate data={data} photos={photos} />;
}
