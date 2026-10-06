"use client";

import { useEffect } from "react";
import { getImageProps } from "next/image";
import { schedulePhotoWarmup, warmPhoto } from "@/lib/photoWarmup";
import supabaseImageLoader from "@/lib/supabaseImageLoader";

type InspirationPhoto = { image_url: string | null; width: number | null; height: number | null };

// The lightbox uses a larger responsive variant than the grid. Prepare that
// variant too, so opening a photo or using next/previous reuses decoded images.
export default function useInspirationPhotoWarmup(images: InspirationPhoto[]) {
  useEffect(() => schedulePhotoWarmup(() => {
    images.forEach((image) => {
      if (!image.image_url) return;
      const { props } = getImageProps({
        src: image.image_url, alt: "", width: image.width || 1600,
        height: image.height || 2000, sizes: "95vw", loader: supabaseImageLoader,
      });
      void warmPhoto({ src: props.src, srcSet: props.srcSet, sizes: props.sizes });
    });
  }), [images]);
}
