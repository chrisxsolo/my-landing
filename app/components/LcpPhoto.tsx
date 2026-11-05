import { getImageProps } from "next/image";
import type { CSSProperties } from "react";
import supabaseImageLoader from "@/lib/supabaseImageLoader";

// The one photo a page paints first (hero or cover). Phones get a lighter
// encode of the same photo; larger screens keep the full-quality one. On the
// homepage hero that is 52 KB instead of 123 KB at the 750px phone width,
// which under mobile throttling is most of the LCP time. Each variant is
// preloaded behind its own media query, so a browser fetches only the one it
// will show. Desktop photography is untouched.

export const PHONE_MEDIA = "(max-width: 760px)";
export const LARGE_MEDIA = "(min-width: 761px)";
export const PHONE_HERO_QUALITY = 75;

type Props = {
  src: string;
  alt: string;
  /** Rendered width on screens above the phone breakpoint. */
  sizes: string;
  /** Rendered width on phones; the hero and cover fill the viewport. */
  phoneSizes?: string;
  quality?: 85 | 90;
  className?: string;
  style?: CSSProperties;
  objectPosition?: string;
};

export default function LcpPhoto({
  src, alt, sizes, phoneSizes = "100vw", quality = 90, className, style, objectPosition,
}: Props) {
  // next/image defaults to lazy loading without `preload`; this photo is the
  // first paint, so it loads eagerly and the preloads above fetch it earliest.
  const common = {
    src, alt, fill: true as const, loader: supabaseImageLoader,
    loading: "eager" as const, fetchPriority: "high" as const,
  };
  const { props: large } = getImageProps({ ...common, sizes, quality });
  const { props: phone } = getImageProps({ ...common, sizes: phoneSizes, quality: PHONE_HERO_QUALITY });
  const imgStyle: CSSProperties = {
    ...large.style,
    objectFit: "cover",
    ...(objectPosition ? { objectPosition } : {}),
    ...style,
  };

  return (
    <>
      <link rel="preload" as="image" imageSrcSet={phone.srcSet} imageSizes={phone.sizes} media={PHONE_MEDIA} fetchPriority="high" />
      <link rel="preload" as="image" imageSrcSet={large.srcSet} imageSizes={large.sizes} media={LARGE_MEDIA} fetchPriority="high" />
      <picture>
        <source media={PHONE_MEDIA} srcSet={phone.srcSet} sizes={phone.sizes} />
        {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from the spread props */}
        <img {...large} className={className} style={imgStyle} />
      </picture>
    </>
  );
}
