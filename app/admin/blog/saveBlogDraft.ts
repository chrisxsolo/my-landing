// Saves the Blog tab's form as a PRIVATE draft: text fields first (a create
// returns the id the uploads need), then every new photo to the private
// blog-drafts bucket through a signed URL, then the ordered image list. Kept
// images are matched by the preview URL the form shows; new ones are blobs.
import { uploadToSignedTarget } from "@/lib/adminSignedUpload";
import type { BlogPostDraftDto, DraftImageRef } from "@/lib/contentPublishing/types";
import { publishingApi } from "@/app/admin/publishing/publishingApi";

export interface DraftFormFields {
  title: string;
  body: string;
  slug: string;
  meta_description: string;
  meta_keywords: string;
}

export interface DraftFormImages {
  coverFile: File | null;
  coverPreview: string | null;
  extraFiles: File[];
  /** Every gallery preview, kept existing URLs and blob: URLs for new files, in display order. */
  extraPreviews: string[];
}

/** The existing image behind each preview URL (signed preview or public URL). */
export function imageByPreview(draft: BlogPostDraftDto | null): Map<string, DraftImageRef> {
  const map = new Map<string, DraftImageRef>();
  if (!draft) return map;
  draft.images.forEach((img, i) => {
    const url = draft.previewUrls[i];
    if (url) map.set(url, img);
  });
  return map;
}

async function uploadPrivate(draftId: string, file: File): Promise<DraftImageRef> {
  const { path } = await uploadToSignedTarget("blog-draft", draftId, file);
  return { path, alt: "" };
}

/**
 * Rebuilds the ordered image list: the cover first, then the gallery in the
 * order shown. Existing images keep their alt text; new files are uploaded.
 */
export async function buildDraftImages(draftId: string, existing: BlogPostDraftDto | null, images: DraftFormImages): Promise<DraftImageRef[]> {
  const known = imageByPreview(existing);
  const out: DraftImageRef[] = [];
  if (images.coverFile) out.push(await uploadPrivate(draftId, images.coverFile));
  else if (images.coverPreview && known.has(images.coverPreview)) out.push(known.get(images.coverPreview)!);
  else if (images.coverPreview && /^https?:\/\//.test(images.coverPreview) && !images.coverPreview.includes("/object/sign/")) {
    out.push({ url: images.coverPreview, alt: "" });
  }
  let blobIndex = 0;
  for (const preview of images.extraPreviews) {
    if (preview.startsWith("blob:")) {
      const file = images.extraFiles[blobIndex++];
      if (file) out.push(await uploadPrivate(draftId, file));
    } else if (known.has(preview)) {
      out.push(known.get(preview)!);
    } else if (/^https?:\/\//.test(preview) && !preview.includes("/object/sign/")) {
      out.push({ url: preview, alt: "" });
    }
  }
  return out;
}

const textFields = (f: DraftFormFields) => ({
  title: f.title, body: f.body, slug: f.slug,
  meta_description: f.meta_description.trim() || null, meta_keywords: f.meta_keywords.trim() || null,
});

export interface SavedDraft { draft: BlogPostDraftDto; scheduleCancelled: boolean }

/** Creates or updates the draft and returns the saved copy (with fresh previews). Never publishes. */
export async function saveBlogDraft(form: DraftFormFields, images: DraftFormImages, existing: BlogPostDraftDto | null): Promise<SavedDraft> {
  let draft = existing;
  if (!draft) {
    draft = (await publishingApi.createDraft(textFields(form))).draft;
  }
  const imageList = await buildDraftImages(draft.id, existing, images);
  const saved = await publishingApi.updateDraft(draft.id, draft.revision, { ...textFields(form), images: imageList });
  return { draft: saved.draft, scheduleCancelled: saved.scheduleCancelled };
}
