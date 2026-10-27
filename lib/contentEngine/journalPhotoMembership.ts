// Journal photo membership (pure, no I/O). Once a journal post is published,
// the live blog_posts row (cover_image_url + extra_image_urls + og_image_url)
// is the ONE authoritative list of what the post shows. These helpers turn
// that row into the editor's inventory — every image the public page renders,
// each pointing at the column to edit — remove a single gallery image, swap
// the cover, and derive the engine item's payload.photo_ids from the live row
// so the two never drift.

export type LivePhotoRole = "cover" | "gallery" | "og";

export type ImageSourceColumn = "cover_image_url" | "extra_image_urls" | "og_image_url";

/** The record and column a public image is read from — what to edit to change it. */
export interface ImageSource {
  table: "blog_posts";
  postId: number;
  column: ImageSourceColumn;
  /** extra_image_urls only: position in the array. */
  index?: number;
}

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
  source: ImageSource;
  /** og only: og_image_url is empty, so the page's social image is the cover. */
  fallback: boolean;
}

export interface LivePostImages {
  id: number;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  extra_image_urls: string[] | null;
  extra_image_alts: string[] | null;
  og_image_url: string | null;
}

/**
 * Every image the public post page renders, in page order: the cover (hero),
 * the gallery, then the social (og) image — which is og_image_url when set
 * and otherwise falls back to the cover, exactly as generateMetadata does.
 */
export function buildLivePhotoList(
  post: LivePostImages,
  matchByUrl: Map<string, SessionPhotoMatch>,
): LiveJournalPhoto[] {
  const toPhoto = (url: string, role: LivePhotoRole, alt: string, source: ImageSource, fallback = false): LiveJournalPhoto => {
    const match = matchByUrl.get(url);
    return {
      url, role, alt,
      photoId: match?.id ?? null,
      filename: match?.original_filename ?? null,
      excludedInLibrary: match?.excluded ?? false,
      source, fallback,
    };
  };
  const extras = post.extra_image_urls ?? [];
  const alts = post.extra_image_alts ?? [];
  const cover = post.cover_image_url;
  const og = post.og_image_url || cover;
  return [
    ...(cover ? [toPhoto(cover, "cover", post.cover_image_alt ?? "", { table: "blog_posts", postId: post.id, column: "cover_image_url" })] : []),
    ...extras.map((url, i) => toPhoto(url, "gallery", alts[i] ?? "", { table: "blog_posts", postId: post.id, column: "extra_image_urls", index: i })),
    ...(og ? [toPhoto(og, "og", post.cover_image_alt ?? "", { table: "blog_posts", postId: post.id, column: "og_image_url" }, !post.og_image_url)] : []),
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

export interface CoverSwap {
  cover_image_url: string;
  cover_image_alt: string;
  og_image_url: string;
  extra_image_urls: string[];
  extra_image_alts: string[];
}

/**
 * The live row after `next` becomes the cover: the cover and the social image
 * change together (a post is never shared with a photo it no longer shows),
 * the new cover leaves the gallery so it is not shown twice, and the old
 * cover either moves to the front of the gallery or leaves the post.
 */
export function swapCover(post: LivePostImages, next: { url: string; alt: string | null }, keepOldInGallery: boolean): CoverSwap {
  const gallery = removeGalleryUrl({ urls: post.extra_image_urls ?? [], alts: post.extra_image_alts ?? [] }, next.url);
  const old = post.cover_image_url;
  const keepOld = keepOldInGallery && old && old !== next.url && !gallery.urls.includes(old);
  return {
    cover_image_url: next.url,
    cover_image_alt: next.alt || post.cover_image_alt || "",
    og_image_url: next.url,
    extra_image_urls: keepOld ? [old, ...gallery.urls] : gallery.urls,
    extra_image_alts: keepOld ? [post.cover_image_alt ?? "", ...gallery.alts] : gallery.alts,
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

export interface PayloadDrift {
  /** Selected in the saved draft but not on the live page. */
  missingFromLive: string[];
  /** On the live page but not selected in the saved draft. */
  missingFromPayload: string[];
  /** The live cover is a session photo other than the draft's cover. */
  coverMismatch: boolean;
  inSync: boolean;
}

/** Where the saved engine draft (payload) and the live page disagree. */
export function payloadDrift(payload: Record<string, unknown>, live: LiveJournalPhoto[]): PayloadDrift {
  const payloadIds = Array.isArray(payload.photo_ids)
    ? payload.photo_ids.filter((id): id is string => typeof id === "string") : [];
  const liveIds = [...new Set(live.filter((p) => p.role !== "og" && p.photoId).map((p) => p.photoId as string))];
  const liveCover = live.find((p) => p.role === "cover")?.photoId ?? null;
  const missingFromLive = payloadIds.filter((id) => !liveIds.includes(id));
  const missingFromPayload = liveIds.filter((id) => !payloadIds.includes(id));
  const coverMismatch = liveCover !== null && payload.cover_photo_id !== liveCover;
  return {
    missingFromLive, missingFromPayload, coverMismatch,
    inSync: missingFromLive.length === 0 && missingFromPayload.length === 0 && !coverMismatch,
  };
}
