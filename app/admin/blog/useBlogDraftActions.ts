"use client";
// Draft-side actions of the Blog form (moved out of BlogTab.tsx): save as a
// private draft, schedule it (save first, then bind the schedule to that
// revision), or publish the draft now. None of these touches blog_posts until
// the explicit publish.
import type { BlogPostDraftDto } from "@/lib/contentPublishing/types";
import { publishingApi } from "@/app/admin/publishing/publishingApi";
import { describeScheduleDraft, toScheduleWhen, type ScheduleDraft } from "@/app/admin/publishing/ScheduleControl";
import { saveBlogDraft, type DraftFormFields, type DraftFormImages } from "@/app/admin/blog/saveBlogDraft";

export interface DraftActionDeps {
  form: DraftFormFields;
  images: () => DraftFormImages;
  editingDraft: BlogPostDraftDto | null;
  scheduleWhen: ScheduleDraft;
  showToast: (msg: string, ok?: boolean) => void;
  setSaving: (v: boolean) => void;
  /** Reloads the drafts panel. */
  draftsChanged: () => void;
  /** Resets the form. */
  close: () => void;
  /** Re-opens a draft in the form (after a failed step, so nothing typed is lost). */
  reopen: (draft: BlogPostDraftDto) => void;
  postsChanged: () => void;
}

export function useBlogDraftActions(d: DraftActionDeps) {
  // Save draft: everything stays private (text in blog_post_drafts, new photos
  // in the private bucket). Incomplete drafts save fine; they just cannot be
  // scheduled until they are complete.
  async function saveDraft(): Promise<BlogPostDraftDto | null> {
    d.setSaving(true);
    try {
      const saved = await saveBlogDraft(d.form, d.images(), d.editingDraft);
      d.draftsChanged();
      if (saved.scheduleCancelled) d.showToast("Its schedule was cancelled because the content changed — schedule it again when ready", false);
      return saved.draft;
    } catch (err) {
      d.showToast(err instanceof Error ? `Save failed — ${err.message}` : "Save failed", false);
      return null;
    } finally { d.setSaving(false); }
  }

  async function saveDraftAndClose() {
    const saved = await saveDraft();
    if (!saved) return;
    d.showToast(saved.incomplete ? `Draft saved (${saved.incomplete})` : "Draft saved — nothing is public");
    d.close();
  }

  // Schedule: save first (and wait), then bind the schedule to that exact revision.
  async function scheduleDraft() {
    const summary = describeScheduleDraft(d.scheduleWhen);
    if (!summary.ok) { d.showToast(summary.text, false); return; }
    const saved = await saveDraft();
    if (!saved) return;
    if (saved.incomplete) { d.reopen(saved); d.showToast(saved.incomplete, false); return; }
    try {
      await publishingApi.schedule({ kind: "blog_draft", id: saved.id }, toScheduleWhen(d.scheduleWhen), saved.revision);
      d.showToast(summary.text);
      d.draftsChanged();
      d.close();
    } catch (err) {
      d.reopen(saved);
      d.showToast(err instanceof Error ? err.message : "Could not schedule", false);
    }
  }

  // Publish now for a draft being edited: save, then publish that revision.
  async function publishDraftNow() {
    const saved = await saveDraft();
    if (!saved) return;
    if (saved.incomplete) { d.reopen(saved); d.showToast(saved.incomplete, false); return; }
    if (saved.schedule) { d.reopen(saved); d.showToast("This draft is scheduled — use Publish now on its schedule below", false); return; }
    if (!confirm(`Publish "${saved.title}" to the live site now?`)) { d.reopen(saved); return; }
    try {
      await publishingApi.publishDraftNow(saved.id, saved.revision);
      d.showToast("Post published!");
      d.draftsChanged();
      d.close(); d.postsChanged();
    } catch (err) {
      d.reopen(saved);
      d.showToast(err instanceof Error ? err.message : "Publish failed", false);
    }
  }

  return { saveDraftAndClose, scheduleDraft, publishDraftNow };
}
