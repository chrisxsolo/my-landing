"use client";

import { useEffect } from "react";
import { getImageProps } from "next/image";
import { warmPhoto } from "@/lib/photoWarmup";
import supabaseImageLoader from "@/lib/supabaseImageLoader";

type InspirationPhoto = { image_url: string | null; width: number | null; height: number | null };

// The lightbox shows a larger responsive variant than the grid tile. Prepare
// that variant only when a visitor signals intent (hovering or focusing a
// tile) or is already in the lightbox, where next/previous are one tap away.
// Decoding the whole gallery up front cost megabytes on a page most people
// only skim.
export function warmInspirationPhoto(image: InspirationPhoto) {
  if (!image.image_url) return;
  const { props } = getImageProps({
    src: image.image_url, alt: "", width: image.width || 1600,
    height: image.height || 2000, sizes: "95vw", loader: supabaseImageLoader,
  });
  void warmPhoto({ src: props.src, srcSet: props.srcSet, sizes: props.sizes });
}

/** Indices the lightbox can move to from `active`: the next and previous photo. */
export function adjacentInspirationIndices(active: number | null, total: number): number[] {
  if (active === null || total < 2) return [];
  const next = (active + 1) % total;
  const previous = (active - 1 + total) % total;
  return next === previous ? [next] : [next, previous];
}

export default function useInspirationPhotoWarmup(images: InspirationPhoto[], active: number | null) {
  useEffect(() => {
    adjacentInspirationIndices(active, images.length).forEach((index) => warmInspirationPhoto(images[index]));
  }, [active, images]);
}
