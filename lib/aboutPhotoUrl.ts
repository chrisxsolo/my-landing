// lib/aboutPhotoUrl.ts
// Central, defensive resolver for About-page fact photo references. The
// about_photos table currently stores a complete Supabase public URL in
// image_url, but this helper also accepts a bare Storage object path (e.g.
// "running/uuid-img.jpg") and builds the correct public URL via the Storage
// API — so the page renders the same correct, fully URL-encoded URL no matter
// which form the DB holds. Returns null for empty/unusable input so callers can
// render an intentional fallback instead of a broken <img>.
//
// Server-only (imports supabaseServer). Do not import from client components.

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { ABOUT_PHOTOS_BUCKET } from "@/lib/aboutFacts";

export function resolveAboutPhotoUrl(ref: string | null | undefined): string | null {
  if (typeof ref !== "string") return null;
  const trimmed = ref.trim();
  if (!trimmed) return null;

  // Already a complete URL (the current schema stores the full public URL).
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // Otherwise treat it as a Storage object path and build the public URL.
  // getPublicUrl URL-encodes path segments, so spaces/special characters in
  // filenames are handled correctly.
  const path = trimmed.replace(/^\/+/, "");
  const { data } = createSupabaseServerClient().storage
    .from(ABOUT_PHOTOS_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl || null;
}
