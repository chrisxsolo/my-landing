// Typed fetch client for the per-post admin routes that work for EVERY blog
// post (Content Engine journals and legacy BlogTab posts alike): the published
// image inventory, gallery removal, cover replacement and revision history.
// Cookie auth rides along (same origin). Errors carry the server's message.
import type { PostImageInventory, RemoveGalleryImageResult, ReplaceCoverResult } from "@/lib/blog/publishedImages";
import type { RestoreResult, RevisionSummary } from "@/lib/blog/postRevisions";

const IMAGES_API = "/api/admin/blog-posts/images";
const REVISIONS_API = "/api/admin/blog-posts/revisions";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init, credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `request failed (${res.status})`);
  return body as T;
}

export const blogPostsApi = {
  images: (postId: number) => request<PostImageInventory>(`${IMAGES_API}?id=${postId}`),
  removeGalleryImage: (postId: number, url: string) =>
    request<RemoveGalleryImageResult>(IMAGES_API, { method: "DELETE", body: JSON.stringify({ id: postId, url }) }),
  replaceCover: (postId: number, url: string, keepOldInGallery: boolean) =>
    request<ReplaceCoverResult>(IMAGES_API, {
      method: "PATCH", body: JSON.stringify({ id: postId, action: "replace-cover", url, keepOldInGallery }),
    }),
  revisions: (postId: number) => request<{ revisions: RevisionSummary[] }>(`${REVISIONS_API}?id=${postId}`),
  restoreRevision: (postId: number, revisionId: number) =>
    request<RestoreResult>(REVISIONS_API, { method: "POST", body: JSON.stringify({ postId, revisionId }) }),
};
