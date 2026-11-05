"use client";

import { getImageProps } from "next/image";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { PricingPhotoManifest, PricingPhotoRequest } from "@/lib/pricingPhotos";
import supabaseImageLoader from "@/lib/supabaseImageLoader";
import { warmPhoto } from "@/lib/photoWarmup";

function warmPricingPhoto(request: PricingPhotoRequest) {
  const { props } = getImageProps({ ...request, alt: "", fill: true, loader: supabaseImageLoader });
  return warmPhoto({ src: props.src, srcSet: props.srcSet, sizes: props.sizes });
}

function warmRoute(manifest: PricingPhotoManifest, href: string) {
  manifest[href]?.forEach(warmPricingPhoto);
}

// Warms a rates page's photos only when a visitor shows intent to open it
// (hovering, focusing, or touching its link). Warming every rates route after
// load used to download photos for five pages most visitors never reached.
export default function PricingPhotoWarmup({ manifest }: { manifest: PricingPhotoManifest }) {
  const pathname = usePathname();
  useEffect(() => {
    const onIntent = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!link) return;
      const url = new URL(link.getAttribute("href")!, window.location.href);
      if (url.origin === window.location.origin && url.pathname !== pathname) warmRoute(manifest, url.pathname);
    };
    const events = ["pointerover", "focusin", "touchstart"] as const;
    events.forEach((event) => document.addEventListener(event, onIntent, { passive: true }));
    return () => events.forEach((event) => document.removeEventListener(event, onIntent));
  }, [manifest, pathname]);
  return null;
}
