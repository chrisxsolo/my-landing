"use client";

import { getImageProps } from "next/image";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { PricingPhotoManifest, PricingPhotoRequest } from "@/lib/pricingPhotos";
import supabaseImageLoader from "@/lib/supabaseImageLoader";
import { schedulePhotoWarmup, warmPhoto } from "@/lib/photoWarmup";

function warmPricingPhoto(request: PricingPhotoRequest) {
  const { props } = getImageProps({ ...request, alt: "", fill: true, loader: supabaseImageLoader });
  return warmPhoto({ src: props.src, srcSet: props.srcSet, sizes: props.sizes });
}

function warmRoute(manifest: PricingPhotoManifest, href: string) {
  manifest[href]?.forEach(warmPricingPhoto);
}

export default function PricingPhotoWarmup({ manifest }: { manifest: PricingPhotoManifest }) {
  const pathname = usePathname();
  useEffect(() => {
    // Current-page photos have already started loading; warm likely destinations
    // after the page finishes so background work cannot hold up its hero.
    return schedulePhotoWarmup(() => {
      Object.entries(manifest).filter(([href]) => href !== pathname)
        .forEach(([, photos]) => photos.forEach(warmPricingPhoto));
    });
  }, [manifest, pathname]);

  useEffect(() => {
    const onIntent = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!link) return;
      const url = new URL(link.getAttribute("href")!, window.location.href);
      if (url.origin === window.location.origin) warmRoute(manifest, url.pathname);
    };
    const events = ["pointerover", "focusin", "touchstart"] as const;
    events.forEach((event) => document.addEventListener(event, onIntent, { passive: true }));
    return () => events.forEach((event) => document.removeEventListener(event, onIntent));
  }, [manifest]);
  return null;
}
