"use client";

import { warmPhoto, type PhotoRequest } from "@/lib/photoWarmup";

const PUBLIC_PHOTO_PATHS = [
  "/about", "/availability", "/portfolio", "/pricing", "/blog", "/contact",
  "/grad-guide", "/grads", "/family-guide", "/couples-guide", "/portrait-guide",
  "/bay-area-locations", "/couples-posing-guide", "/faq", "/terms", "/privacy",
];
const PAGE_CACHE_MS = 5 * 60 * 1000;
const MAX_CACHED_PAGES = 32;
const pageWarmups = new Map<string, { started: number; ready: Promise<void> }>();

export function getPublicPhotoHref(href: string, currentHref: string): string | null {
  const current = new URL(currentHref);
  let url: URL;
  try { url = new URL(href, current); }
  catch { return null; }
  if (url.origin !== current.origin) return null;
  const publicPath = url.pathname === "/" || PUBLIC_PHOTO_PATHS.some(
    (path) => url.pathname === path || url.pathname.startsWith(`${path}/`),
  );
  if (!publicPath || (url.pathname === current.pathname && url.search === current.search)) return null;
  return `${url.pathname}${url.search}`;
}

export function readPagePhotos(html: string, pageUrl: string): PhotoRequest[] {
  // Template contents stay inert: scripts are never executed and the fetched
  // page is never inserted into the live document.
  const template = document.createElement("template");
  template.innerHTML = html;
  return Array.from(template.content.querySelectorAll<HTMLImageElement>("main img"))
    .flatMap((image) => {
      const src = image.getAttribute("src");
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return [];
      const url = new URL(src, pageUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") return [];
      return [{ src: url.href, srcSet: image.getAttribute("srcset") ?? undefined,
        sizes: image.getAttribute("sizes") ?? undefined }];
    });
}

async function fetchPagePhotos(href: string) {
  const url = new URL(href, window.location.origin);
  const response = await fetch(url, { credentials: "omit", priority: "low" });
  if (!response.ok) throw new Error(`Photo prefetch returned ${response.status}`);
  const finalUrl = response.url || url.href;
  if (!getPublicPhotoHref(finalUrl, window.location.href)
    || !response.headers.get("content-type")?.includes("text/html")) return;
  const photos = readPagePhotos(await response.text(), finalUrl);
  await Promise.all(photos.map(warmPhoto));
}

export function warmPublicPage(href: string): Promise<void> {
  const cached = pageWarmups.get(href);
  if (cached && Date.now() - cached.started < PAGE_CACHE_MS) return cached.ready;
  const ready = fetchPagePhotos(href).catch((error) => {
    pageWarmups.delete(href);
    console.error("[photo-warmup] Failed to prepare page photos", href, error);
  });
  pageWarmups.set(href, { started: Date.now(), ready });
  if (pageWarmups.size > MAX_CACHED_PAGES) pageWarmups.delete(pageWarmups.keys().next().value!);
  return ready;
}
