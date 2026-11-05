"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getPublicPhotoHref, warmPublicPage } from "@/lib/publicPhotoWarmup";

// Prepares the photos of a public page the visitor is about to open: when they
// hover, focus, or touch its link. An earlier version also fetched every public
// page whose link scrolled into view, which on the homepage meant downloading a
// dozen pages and decoding all of their photos for nothing.
export default function PublicPhotoWarmup() {
  const pathname = usePathname();
  useEffect(() => {
    const onIntent = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      const href = link && getPublicPhotoHref(link.href, window.location.href);
      if (href) void warmPublicPage(href);
    };
    const events = ["pointerover", "focusin", "touchstart"] as const;
    events.forEach((event) => document.addEventListener(event, onIntent, { passive: true }));
    return () => events.forEach((event) => document.removeEventListener(event, onIntent));
  }, [pathname]);
  return null;
}
