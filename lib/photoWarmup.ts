"use client";

export type PhotoRequest = { src: string; srcSet?: string; sizes?: string };
const MAX_DECODED_PHOTOS = 64;
const MAX_CONCURRENT_WARMUPS = 3;
const warmedPhotos = new Map<string, Promise<void>>();
const pendingWarmups: (() => Promise<void>)[] = [];
let activeWarmups = 0;

// Hold decoded images until navigation can reuse them, with a bound on memory
// when visitors browse many galleries in one session.
const decodedPhotos = new Map<string, HTMLImageElement>();

async function decodePhoto({ src, srcSet, sizes }: PhotoRequest, key: string) {
  const image = new window.Image();
  image.fetchPriority = "low";
  image.decoding = "async";
  image.sizes = sizes ?? "";
  image.srcset = srcSet ?? "";
  image.src = src;
  decodedPhotos.set(key, image);
  await image.decode().catch((error) => {
    warmedPhotos.delete(key);
    decodedPhotos.delete(key);
    console.error("[photo-warmup] Failed to warm photo", src, error);
  });
  if (decodedPhotos.size > MAX_DECODED_PHOTOS) {
    const oldest = decodedPhotos.keys().next().value!;
    decodedPhotos.delete(oldest);
    warmedPhotos.delete(oldest);
  }
}

function drainWarmups() {
  while (activeWarmups < MAX_CONCURRENT_WARMUPS && pendingWarmups.length) {
    const prepare = pendingWarmups.shift()!;
    activeWarmups++;
    void prepare().finally(() => { activeWarmups--; drainWarmups(); });
  }
}

export function warmPhoto(request: PhotoRequest): Promise<void> {
  const key = `${request.srcSet ?? request.src}|${request.sizes ?? ""}`;
  const existing = warmedPhotos.get(key);
  if (existing) return existing;
  const ready = new Promise<void>((resolve) => {
    pendingWarmups.push(async () => { await decodePhoto(request, key); resolve(); });
  });
  warmedPhotos.set(key, ready);
  drainWarmups();
  return ready;
}

export function schedulePhotoWarmup(callback: () => void) {
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
