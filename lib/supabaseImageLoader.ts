"use client";

// Custom next/image loader (next.config.ts → images.loaderFile). Routes every
// Supabase Storage image through Supabase's on-the-fly transformation endpoint
// (render/image/public) instead of Vercel's /_next/image optimizer, which was
// returning HTTP 402 once the account's optimization quota was exhausted.
//
// Supabase resizes close to storage, auto-negotiates WebP/AVIF from the
// browser's Accept header, and next/image still builds the responsive srcset —
// so each viewport downloads only the width it needs. Requires Supabase Pro
// (image transformations are a Pro feature).

const SUPABASE_HOST = "dmtslzwglpezympptqls.supabase.co";
const OBJECT_PREFIX = "/storage/v1/object/public/";
const RENDER_PREFIX = "/storage/v1/render/image/public/";
// Supabase transformations cap output at 2500px per dimension; larger requests
// (e.g. next's 3840px device size) error, so clamp before asking.
const MAX_TRANSFORM_WIDTH = 2500;

interface LoaderArgs {
  src: string;
  width: number;
  quality?: number;
}

export default function supabaseImageLoader({ src, width, quality }: LoaderArgs): string {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    // Relative/local asset — leave it for next's default handling.
    return src;
  }

  // Only transform our own public Storage objects. Signed URLs, already-rendered
  // URLs, and external hosts pass through untouched.
  if (url.hostname !== SUPABASE_HOST || !url.pathname.startsWith(OBJECT_PREFIX)) {
    return src;
  }

  url.pathname = url.pathname.replace(OBJECT_PREFIX, RENDER_PREFIX);
  url.searchParams.set("width", String(Math.min(width, MAX_TRANSFORM_WIDTH)));
  url.searchParams.set("quality", String(quality ?? 75));
  return url.toString();
}
