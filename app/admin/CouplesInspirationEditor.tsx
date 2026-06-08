"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { C } from "@/lib/colors";
import {
  COUPLES_IMAGE_TYPES,
  COUPLES_INSPIRATION_CATEGORIES,
  MAX_COUPLES_IMAGE_BYTES,
  type CouplesPosingPrompt,
} from "@/lib/couplesPosingGuide";

export type AdminInspirationImage = {
  id: string;
  storage_path: string | null;
  external_source_url: string | null;
  image_url: string | null;
  title: string;
  internal_notes: string | null;
  client_notes: string | null;
  creator_name: string | null;
  attribution_text: string | null;
  categories: string[];
  tags: string[];
  related_prompt_number: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  visibility: "private" | "client_shareable" | "public";
  is_published: boolean;
  display_order: number;
  rights_confirmed: boolean;
  created_at: string;
  updated_at: string;
};

type Props = {
  editing: AdminInspirationImage | null;
  prompts: CouplesPosingPrompt[];
  onSaved: () => void;
  onCancel: () => void;
  showToast: (message: string, ok?: boolean) => void;
};

type Draft = {
  title: string;
  internal_notes: string;
  client_notes: string;
  creator_name: string;
  attribution_text: string;
  external_source_url: string;
  categories: string[];
  tags: string;
  related_prompt_number: string;
  alt_text: string;
  visibility: "private" | "client_shareable" | "public";
  is_published: boolean;
  display_order: string;
  rights_confirmed: boolean;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  internal_notes: "",
  client_notes: "",
  creator_name: "",
  attribution_text: "",
  external_source_url: "",
  categories: [],
  tags: "",
  related_prompt_number: "",
  alt_text: "",
  visibility: "private",
  is_published: false,
  display_order: "0",
  rights_confirmed: false,
};

const inputClass = "w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-700";

function draftFromImage(image: AdminInspirationImage): Draft {
  return {
    title: image.title,
    internal_notes: image.internal_notes ?? "",
    client_notes: image.client_notes ?? "",
    creator_name: image.creator_name ?? "",
    attribution_text: image.attribution_text ?? "",
    external_source_url: image.external_source_url ?? "",
    categories: image.categories,
    tags: image.tags.join(", "),
    related_prompt_number: image.related_prompt_number?.toString() ?? "",
    alt_text: image.alt_text ?? "",
    visibility: image.visibility,
    is_published: image.is_published,
    display_order: image.display_order.toString(),
    rights_confirmed: image.rights_confirmed,
  };
}

async function readDimensions(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  } catch {
    return { width: null, height: null };
  }
}

export default function CouplesInspirationEditor({
  editing,
  prompts,
  onSaved,
  onCancel,
  showToast,
}: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [externalMode, setExternalMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(editing ? draftFromImage(editing) : EMPTY_DRAFT);
    setExternalMode(Boolean(editing?.external_source_url));
    setFiles([]);
    setPreviews(editing?.image_url ? [editing.image_url] : []);
  }, [editing]);

  useEffect(() => {
    return () => previews
      .filter((url) => url.startsWith("blob:"))
      .forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  const canSave = useMemo(() => {
    if (!draft.title.trim()) return false;
    if (editing) return true;
    return externalMode ? Boolean(draft.external_source_url.trim()) : files.length > 0;
  }, [draft.external_source_url, draft.title, editing, externalMode, files.length]);

  function selectFiles(selected: File[]) {
    const valid = selected.filter((file) => {
      if (!COUPLES_IMAGE_TYPES.includes(file.type as (typeof COUPLES_IMAGE_TYPES)[number])) {
        showToast(`${file.name}: unsupported image type`, false);
        return false;
      }
      if (file.size > MAX_COUPLES_IMAGE_BYTES) {
        showToast(`${file.name}: images must be 6 MB or smaller`, false);
        return false;
      }
      return true;
    });
    setFiles(valid);
    setPreviews(valid.map((file) => URL.createObjectURL(file)));
  }

  function toggleCategory(category: string) {
    setDraft((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
  }

  function metadata(dimensions?: { width: number | null; height: number | null }) {
    return {
      ...draft,
      tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      related_prompt_number: draft.related_prompt_number
        ? Number(draft.related_prompt_number)
        : null,
      display_order: Number(draft.display_order) || 0,
      width: dimensions?.width ?? editing?.width ?? null,
      height: dimensions?.height ?? editing?.height ?? null,
    };
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      let response: Response;
      if (editing) {
        response = await fetch("/api/admin/couples-posing-guide", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [editing.id], updates: metadata() }),
        });
      } else if (externalMode) {
        response = await fetch("/api/admin/couples-posing-guide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...metadata(),
            visibility: "private",
            is_published: false,
            rights_confirmed: false,
          }),
        });
      } else {
        const dimensions = await readDimensions(files[0]);
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("metadata", JSON.stringify(metadata(dimensions)));
        response = await fetch("/api/admin/couples-posing-guide", {
          method: "POST",
          body: formData,
        });
      }

      const json = await response.json();
      if (!response.ok) {
        showToast(json.error ?? "Could not save inspiration image", false);
        return;
      }
      showToast(editing ? "Inspiration image updated" : `${externalMode ? 1 : files.length} reference${files.length === 1 ? "" : "s"} added`);
      setDraft(EMPTY_DRAFT);
      setFiles([]);
      setPreviews([]);
      onSaved();
    } catch (error) {
      console.error("[couples-guide-admin] save failed", error);
      showToast("Could not save inspiration image", false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="h-1" style={{ background: C.proAccent }} />
      <div className="p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: C.proAccent }}>
              {editing ? "Edit reference" : "Add inspiration"}
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              {editing ? editing.title : externalMode ? "Add external reference" : "Upload images"}
            </h2>
          </div>
          <div className="flex gap-2">
            {!editing && (
              <button
                type="button"
                onClick={() => { setExternalMode((value) => !value); setFiles([]); setPreviews([]); }}
                className="min-h-11 rounded-xl border px-3 text-sm font-bold"
                style={{ borderColor: C.proAccentBorder, color: C.proAccent }}
              >
                {externalMode ? "Upload files" : "Add external reference"}
              </button>
            )}
            {editing && <button type="button" onClick={onCancel} className="min-h-11 rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-600">Cancel</button>}
          </div>
        </div>

        {!editing && !externalMode && (
          <div
            className="mb-5 grid min-h-40 cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-5 text-center"
            style={{ borderColor: C.proAccentBorder, background: C.proAccentSoft }}
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); selectFiles(Array.from(event.dataTransfer.files)); }}
          >
            <div>
              <p className="font-black text-slate-900">Drop images here or tap to browse</p>
              <p className="mt-1 text-sm text-slate-500">JPEG, PNG, WebP, or AVIF · 6 MB maximum · multiple files supported</p>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept={COUPLES_IMAGE_TYPES.join(",")}
              multiple
              className="hidden"
              onChange={(event) => selectFiles(Array.from(event.target.files ?? []))}
            />
          </div>
        )}

        {previews.length > 0 && (
          <div className="mb-5 grid grid-cols-3 gap-2 md:grid-cols-6">
            {previews.map((url) => (
              // Blob previews and arbitrary private reference URLs are not suitable
              // for the Next image optimizer.
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="aspect-square w-full rounded-xl object-cover" />
            ))}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-bold text-slate-500">Title<input className={inputClass} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          {externalMode && <label className="grid gap-1.5 text-xs font-bold text-slate-500">Original source URL<input className={inputClass} type="url" value={draft.external_source_url} onChange={(event) => setDraft({ ...draft, external_source_url: event.target.value })} /></label>}
          <label className="grid gap-1.5 text-xs font-bold text-slate-500">Creator or photographer<input className={inputClass} value={draft.creator_name} onChange={(event) => setDraft({ ...draft, creator_name: event.target.value })} /></label>
          <label className="grid gap-1.5 text-xs font-bold text-slate-500">Attribution text<input className={inputClass} value={draft.attribution_text} onChange={(event) => setDraft({ ...draft, attribution_text: event.target.value })} /></label>
          <label className="grid gap-1.5 text-xs font-bold text-slate-500">Alt text<input className={inputClass} value={draft.alt_text} onChange={(event) => setDraft({ ...draft, alt_text: event.target.value })} /></label>
          <label className="grid gap-1.5 text-xs font-bold text-slate-500">Tags, comma separated<input className={inputClass} value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} /></label>
          <label className="grid gap-1.5 text-xs font-bold text-slate-500">Related prompt<select className={inputClass} value={draft.related_prompt_number} onChange={(event) => setDraft({ ...draft, related_prompt_number: event.target.value })}><option value="">None</option>{prompts.map((item) => <option key={item.number} value={item.number}>{item.number}. {item.title}</option>)}</select></label>
          <label className="grid gap-1.5 text-xs font-bold text-slate-500">Display order<input className={inputClass} type="number" min="0" value={draft.display_order} onChange={(event) => setDraft({ ...draft, display_order: event.target.value })} /></label>
          <label className="grid gap-1.5 text-xs font-bold text-slate-500">Private notes<textarea className={inputClass} rows={4} value={draft.internal_notes} onChange={(event) => setDraft({ ...draft, internal_notes: event.target.value })} /></label>
          <label className="grid gap-1.5 text-xs font-bold text-slate-500">Client-facing notes<textarea className={inputClass} rows={4} value={draft.client_notes} onChange={(event) => setDraft({ ...draft, client_notes: event.target.value })} /></label>
        </div>

        <fieldset className="mt-5">
          <legend className="text-xs font-bold text-slate-500">Categories</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {COUPLES_INSPIRATION_CATEGORIES.map((category) => (
              <button key={category} type="button" onClick={() => toggleCategory(category)} className="min-h-10 rounded-full border px-3 text-xs font-bold" style={draft.categories.includes(category) ? { background: C.proAccent, color: C.white, borderColor: C.proAccent } : { background: C.white, color: C.inkSoft, borderColor: C.proBorder }}>{category}</button>
            ))}
          </div>
        </fieldset>

        {!externalMode && (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <label className="grid gap-1.5 text-xs font-bold text-slate-500">Visibility<select className={inputClass} value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as Draft["visibility"] })}><option value="private">Private</option><option value="client_shareable">Client Shareable</option><option value="public">Public</option></select></label>
            <label className="flex min-h-11 items-center gap-2 self-end rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={draft.is_published} onChange={(event) => setDraft({ ...draft, is_published: event.target.checked })} /> Published</label>
            {draft.visibility === "public" && <label className="flex min-h-11 items-center gap-2 self-end rounded-xl border px-3 text-sm font-bold" style={{ borderColor: C.proAccentBorder, color: C.proAccentDark }}><input type="checkbox" checked={draft.rights_confirmed} onChange={(event) => setDraft({ ...draft, rights_confirmed: event.target.checked })} /> I own this image or have permission to display it publicly</label>}
          </div>
        )}

        <p className="mt-5 rounded-xl p-3 text-xs font-bold leading-relaxed" style={{ background: C.proAccentSoft, color: C.proAccentDark }}>
          Only publish images you created, licensed, or have permission to display. Internet inspiration images should remain private unless publication rights are confirmed
        </p>
        <button type="button" disabled={!canSave || saving} onClick={save} className="mt-4 min-h-12 w-full rounded-xl text-sm font-black text-white disabled:opacity-50" style={{ background: C.proAccent }}>
          {saving ? "Saving..." : editing ? "Save changes" : externalMode ? "Save private reference" : `Upload ${files.length || ""} image${files.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </section>
  );
}
