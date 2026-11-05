// One builder for every public page's search and share metadata.
//
// Next.js merges metadata objects shallowly: a page that defines its own
// `openGraph` replaces the root layout's whole block, so a root fallback image
// never reaches a page that sets its own title there. Pages therefore build
// their metadata here, where the canonical, the absolute og:url, the share
// image, and the large Twitter card are always filled in together.

import type { Metadata } from "next";

export const SITE_URL = "https://www.soloxsnaps.com";
export const SITE_NAME = "SoloXSnaps";

/** 1200×630 brand image used when a page has no share image of its own. */
export const DEFAULT_SOCIAL_IMAGE: SocialImage = {
  url: `${SITE_URL}/images/about/chris-solorzano-sunset-beach-og.jpg`,
  width: 1200,
  height: 630,
  alt: "Bay Area photographer Chris Solorzano at sunset on a San Francisco beach",
};

export type SocialImage = { url: string; width?: number; height?: number; alt?: string };

export type PageMetadataInput = {
  /** Search title; the root template appends " | SoloXSnaps". */
  title: string;
  description: string;
  /** Site-relative path, e.g. "/pricing/grads". Becomes the canonical and og:url. */
  path: string;
  /** Share title. Defaults to the title with the site name appended. */
  socialTitle?: string;
  type?: "website" | "article" | "profile";
  /**
   * Share image. Omit for the brand default; pass `null` on a route that has
   * its own opengraph-image file, which Next injects on its own.
   */
  image?: SocialImage | string | null;
  keywords?: string | string[];
  robots?: Metadata["robots"];
  publishedTime?: string;
};

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function resolveImage(image: PageMetadataInput["image"]): SocialImage | null {
  if (image === null) return null;
  if (image === undefined) return DEFAULT_SOCIAL_IMAGE;
  if (typeof image === "string") return { url: absoluteUrl(image) };
  return { ...image, url: absoluteUrl(image.url) };
}

export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const socialTitle = input.socialTitle ?? `${input.title} | ${SITE_NAME}`;
  const image = resolveImage(input.image);
  const type = input.type ?? "website";
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    ...(input.keywords ? { keywords: input.keywords } : {}),
    ...(input.robots ? { robots: input.robots } : {}),
    openGraph: {
      title: socialTitle,
      description: input.description,
      url: absoluteUrl(input.path),
      siteName: SITE_NAME,
      locale: "en_US",
      type,
      ...(type === "article" && input.publishedTime ? { publishedTime: input.publishedTime } : {}),
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: input.description,
      ...(image ? { images: [image.url] } : {}),
    },
  };
}
