// Journal photo membership (pure, no I/O). Once a journal post is published,
// the live blog_posts row (cover_image_url + extra_image_urls) is the ONE
// authoritative list of what the post shows. These helpers turn that row into
// the editor's view, remove a single gallery image, and derive the engine
// item's payload.photo_ids from the live row so the two never drift.

export type LivePhotoRole = "cover" | "gallery";

export interface SessionPhotoMatch {
  id: string;
  original_filename: string | null;
  excluded: boolean;
}

export interface LiveJournalPhoto {
  url: string;
  role: LivePhotoRole;
  alt: string;
  /** null = the URL is not any of this session's photos (added by hand). */
  photoId: string | null;
  filename: string | null;
  /** The matched photo is excluded in the session library (still live here). */
  excludedInLibrary: boolean;
}

export interface LivePostImages {
  cover_image_url: string | null;
  cover_image_alt: string | null;
  extra_image_urls: string[] | null;
  extra_image_alts: string[] | null;
}

export function buildLivePhotoList(
  post: LivePostImages,
  matchByUrl: Map<string, SessionPhotoMatch>,
): LiveJournalPhoto[] {
  const toPhoto = (url: string, role: LivePhotoRole, alt: string): LiveJournalPhoto => {
    const match = matchByUrl.get(url);
    return {
      url, role, alt,
      photoId: match?.id ?? null,
      filename: match?.original_filename ?? null,
      excludedInLibrary: match?.excluded ?? false,
    };
  };
  const extras = post.extra_image_urls ?? [];
  const alts = post.extra_image_alts ?? [];
  return [
    ...(post.cover_image_url ? [toPhoto(post.cover_image_url, "cover", post.cover_image_alt ?? "")] : []),
    ...extras.map((url, i) => toPhoto(url, "gallery", alts[i] ?? "")),
  ];
}

export interface GalleryArrays {
  urls: string[];
  alts: string[];
}

/** Drops every occurrence of `url`, keeping urls and alts index-aligned. */
export function removeGalleryUrl(gallery: GalleryArrays, url: string): GalleryArrays & { removed: number } {
  const kept = gallery.urls
    .map((u, i) => ({ url: u, alt: gallery.alts[i] ?? "" }))
    .filter((entry) => entry.url !== url);
  return {
    urls: kept.map((k) => k.url),
    alts: kept.map((k) => k.alt),
    removed: gallery.urls.length - kept.length,
  };
}

/**
 * payload.photo_ids derived from the live post: the cover first (the payload
 * schema requires it to be a member), then every matched gallery photo in live
 * order, deduped. Unmatched URLs have no id and stay only on the live row.
 */
export function photoIdsFromLive(coverPhotoId: string | null, live: LiveJournalPhoto[]): string[] {
  const ids = [
    ...(coverPhotoId ? [coverPhotoId] : []),
    ...live.filter((p) => p.role === "gallery" && p.photoId).map((p) => p.photoId as string),
  ];
  return [...new Set(ids)];
}
