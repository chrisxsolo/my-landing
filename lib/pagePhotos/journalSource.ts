// Legacy journal galleries as a photo source. Pure — pool.ts loads the rows.
//
// Before the Content Engine, graduation sessions were published only as
// journal posts (blog_posts.cover_image_url + extra_image_urls). Those photos
// are public today, yet nothing read them as candidates, so a school page
// could show two Content Engine sessions and none of the fifty SJSU frames
// that live in its posts. Here each live post's images become candidates for
// the school page the POST names — the school comes from the post's own
// category tags, title and slug through the same detector every other source
// uses (resolve.ts), never from a guess about the photo.
//
// A photo already known to another source is left to that source: a Content
// Engine derivative (whether or not the photographer excluded it) and a
// Portfolio image are never duplicated here, by URL and by content hash.
import { normalizeCategoryTag } from "@/lib/blog/postCategories";
import { resolvePostService } from "@/lib/blog/postService";
import type { SchoolSlug } from "@/lib/contentEngine/taxonomy";
import { schoolPageKey } from "@/lib/pagePhotos/pageKeys";
import { inferSchoolFromText } from "@/lib/pagePhotos/resolve";

export interface JournalPostRow {
  id: number;
  slug: string;
  title: string;
  category: string | null;
  sites: readonly string[];
  /** ISO timestamp; null or in the future = not live. */
  publishedAt: string | null;
  coverUrl: string | null;
  coverAlt: string | null;
  extraUrls: readonly string[];
  extraAlts: readonly string[];
}

export interface LegacyJournalPhoto {
  /** `journal:<post id>:<index>`; the cover is index 0. */
  id: string;
  url: string;
  alt: string;
  contentHash: string | null;
  postId: number;
  postSlug: string;
  postTitle: string;
  role: "cover" | "gallery";
  publishedAt: string;
  /** The post's service (grads, couples…) from its tags, title and slug. */
  serviceType: string | null;
  school: SchoolSlug | null;
  /** Why a grads post placed nothing (shown in admin), else null. */
  schoolNote: string | null;
  /** One group per post: a post is one shoot. */
  sessionKey: string;
  /** Page keys this photo is automatically offered to. */
  pages: string[];
}

export interface JournalSourceExclusions {
  /** Every Content Engine derivative URL (excluded photos included). */
  engineUrls: ReadonlySet<string>;
  portfolioUrls: ReadonlySet<string>;
  portfolioHashes: ReadonlySet<string>;
}

const GRADS = "grads";

export const journalSessionKey = (postId: number): string => `post:${postId}`;

export function isLivePost(post: Pick<JournalPostRow, "publishedAt">, now = Date.now()): boolean {
  if (!post.publishedAt) return false;
  const at = Date.parse(post.publishedAt);
  return Number.isFinite(at) && at <= now;
}

function postSchool(post: JournalPostRow, serviceType: string | null) {
  if (serviceType !== GRADS) return { school: null, note: null };
  const inferred = inferSchoolFromText(`${post.title} ${post.slug.replace(/-/g, " ")}`);
  return { school: inferred.school, note: inferred.note };
}

function postPhotos(post: JournalPostRow): LegacyJournalPhoto[] {
  const serviceType = resolvePostService({
    categoryTags: [...post.sites, post.category], tagToCategory: (tag) => normalizeCategoryTag(tag)?.slug ?? null,
    text: `${post.title} ${post.slug}`,
  });
  const { school, note } = postSchool(post, serviceType);
  const images: { url: string | null; alt: string | null; role: "cover" | "gallery" }[] = [
    { url: post.coverUrl, alt: post.coverAlt, role: "cover" },
    ...post.extraUrls.map((url, i) => ({ url, alt: post.extraAlts[i] ?? null, role: "gallery" as const })),
  ];
  return images.flatMap((image, index) => (image.url ? [{
    id: `journal:${post.id}:${index}`, url: image.url, alt: image.alt?.trim() || post.title, contentHash: null,
    postId: post.id, postSlug: post.slug, postTitle: post.title, role: image.role,
    publishedAt: post.publishedAt as string, serviceType, school, schoolNote: note,
    sessionKey: journalSessionKey(post.id), pages: school ? [schoolPageKey(school)] : [],
  }] : []));
}

/**
 * Every image of every live post, newest post first, once per URL, minus the
 * images another source already owns. Photos of a post that is not live
 * (unpublished, scheduled, or deleted) are not public and never appear.
 */
export function legacyJournalPhotos(
  posts: readonly JournalPostRow[], exclusions: JournalSourceExclusions, now = Date.now(),
): LegacyJournalPhoto[] {
  const live = posts.filter((post) => isLivePost(post, now))
    .sort((a, b) => (b.publishedAt as string).localeCompare(a.publishedAt as string) || a.id - b.id);
  const seen = new Set<string>();
  return live.flatMap(postPhotos).filter((photo) => {
    if (seen.has(photo.url) || exclusions.engineUrls.has(photo.url) || exclusions.portfolioUrls.has(photo.url)) return false;
    if (photo.contentHash && exclusions.portfolioHashes.has(photo.contentHash)) return false;
    seen.add(photo.url);
    return true;
  });
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

/** A blog_posts row (pool.ts BLOG_POST_COLUMNS) as a JournalPostRow. */
export function toJournalPostRow(row: Record<string, unknown>): JournalPostRow | null {
  const id = Number(row.id);
  const slug = text(row.slug);
  if (!Number.isInteger(id) || !slug) return null;
  return {
    id, slug, title: text(row.title) ?? slug, category: text(row.category), sites: strings(row.sites),
    publishedAt: text(row.published_at), coverUrl: text(row.cover_image_url), coverAlt: text(row.cover_image_alt),
    extraUrls: strings(row.extra_image_urls), extraAlts: strings(row.extra_image_alts),
  };
}
