"use client";

import { getImageProps } from "next/image";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { PricingPhotoManifest, PricingPhotoRequest } from "@/lib/pricingPhotos";
import supabaseImageLoader from "@/lib/supabaseImageLoader";

const warmedPhotos = new Map<string, HTMLImageElement>();

function warmPhoto(request: PricingPhotoRequest) {
  const { props } = getImageProps({ ...request, alt: "", fill: true, loader: supabaseImageLoader });
  const key = `${props.srcSet ?? props.src}|${props.sizes}`;
  if (warmedPhotos.has(key)) return;
  const image = new window.Image();
  image.fetchPriority = "low";
  image.decoding = "async";
  image.sizes = props.sizes ?? "";
  image.srcset = props.srcSet ?? "";
  image.src = props.src;
  warmedPhotos.set(key, image);
  image.decode().catch((error) => {
    warmedPhotos.delete(key);
    console.error("[pricing-photos] Failed to warm photo", request.src, error);
  });
}

function warmRoute(manifest: PricingPhotoManifest, href: string) {
  manifest[href]?.forEach(warmPhoto);
}

function scheduleWarmup(callback: () => void) {
  let cancel = () => {};
  const schedule = () => {
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(callback, { timeout: 2000 });
      cancel = () => window.cancelIdleCallback(id);
    } else {
      const id = setTimeout(callback, 0);
      cancel = () => clearTimeout(id);
    }
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
  return () => { window.removeEventListener("load", schedule); cancel(); };
}

export default function PricingPhotoWarmup({ manifest }: { manifest: PricingPhotoManifest }) {
  const pathname = usePathname();
  useEffect(() => {
    // Current-page photos have already started loading; warm likely destinations
    // after the page finishes so background work cannot hold up its hero.
    return scheduleWarmup(() => {
      Object.entries(manifest).filter(([href]) => href !== pathname)
        .forEach(([, photos]) => photos.forEach(warmPhoto));
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
